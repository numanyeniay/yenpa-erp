'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { type CiktiTuru } from '@/types'
import { hesaplaFiyat, adetAgirligiHesapla, fasonFiyatBul, mamulKgM2, type FiyatGirdisi, type FiyatCiktisi } from '@/lib/fiyatlama'

const CIKTI_LABEL: Record<CiktiTuru, string> = {
  bobin: 'Bobin', doypack: 'Doypack', quadro: 'Quadro', flat_bottom: 'Flat bottom',
  sirt_kaynak: 'Sirt kaynak', yan_kesim: 'Yan kesim', katlama_torba: 'Katlama torba', diger: 'Diger',
}

const PARCA_TURLERI: CiktiTuru[] = ['doypack', 'quadro', 'flat_bottom', 'sirt_kaynak', 'yan_kesim', 'katlama_torba']
const FASON_TURLERI: CiktiTuru[] = ['doypack', 'quadro', 'flat_bottom', 'sirt_kaynak']

interface KatmanSatir {
  malzeme_id: string
  mikron: string
  baskili: boolean
  baski_yuzde: string // 0-100, sadece baskili=true iken kullanilir
  laminasyon_onceki: boolean
}

// Kenar fire% sabitlenince hesaplaFiyat() motoruna gercekci ama uydurma bir
// bobin/net en cifti veriyoruz — sonuc sadece orandan etkilendigi icin
// gercek mm'lere hic ihtiyac yok, satisci kato eni girmek zorunda kalmiyor.
const SENTETIK_BOBIN_EN_MM = 10000

export default function HesapMakinesiPage() {
  const { user } = useAuth()
  const [malzemeler, setMalzemeler] = useState<any[]>([])
  const [fiyatlar, setFiyatlar] = useState<any[]>([])
  const [fasonFiyatlar, setFasonFiyatlar] = useState<any[]>([])
  const [parametre, setParametre] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [ciktiTuru, setCiktiTuru] = useState<CiktiTuru>('doypack')
  const [enMm, setEnMm] = useState('200')
  const [boyMm, setBoyMm] = useState('300')
  const [kurekMm, setKurekMm] = useState('50')
  const [yanKurekMm, setYanKurekMm] = useState('0') // sadece flat_bottom: yan korugun eni
  const [bobinEnMm, setBobinEnMm] = useState('350') // sadece cikti turu=bobin icin: satilan urunun kendi eni

  const [katmanlar, setKatmanlar] = useState<KatmanSatir[]>([
    { malzeme_id: '', mikron: '20', baskili: true, baski_yuzde: '100', laminasyon_onceki: false },
    { malzeme_id: '', mikron: '70', baskili: false, baski_yuzde: '100', laminasyon_onceki: true },
  ])

  const [siparisKg, setSiparisKg] = useState('500')
  const [karPct, setKarPct] = useState('25')
  const [zipVar, setZipVar] = useState(false)
  const [fasonKullan, setFasonKullan] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: m }, { data: f }, { data: ff }, { data: p }] = await Promise.all([
      supabase.from('malzeme_tanim').select('*').eq('aktif', true).order('ad'),
      supabase.from('malzeme_fiyat').select('*').order('gecerlilik_tarihi', { ascending: false }),
      supabase.from('fason_fiyat').select('*').eq('aktif', true).order('tur').order('min_gram'),
      supabase.from('referans_parametre').select('*').eq('id', 1).single(),
    ])
    setMalzemeler(m || [])
    setFiyatlar(f || [])
    setFasonFiyatlar(ff || [])
    setParametre(p)
    setLoading(false)
  }

  function guncelFiyat(malzeme_id: string): number {
    const kayit = fiyatlar.find(f => f.malzeme_id === malzeme_id)
    return kayit ? Number(kayit.birim_fiyat) : 0
  }

  function katmanEkle() {
    setKatmanlar([...katmanlar, { malzeme_id: '', mikron: '', baskili: false, baski_yuzde: '100', laminasyon_onceki: false }])
  }
  function katmanSil(i: number) {
    setKatmanlar(katmanlar.filter((_, idx) => idx !== i))
  }
  function katmanGuncelle(i: number, patch: Partial<KatmanSatir>) {
    setKatmanlar(katmanlar.map((k, idx) => idx === i ? { ...k, ...patch } : k))
  }

  const isParca = PARCA_TURLERI.includes(ciktiTuru)
  const fireYuzdesi = parametre ? Number(parametre.ortalama_kenar_fire_pct) : 2

  const hesap = useMemo(() => {
    if (!parametre) return null
    const gecerliKatmanlar = katmanlar.filter(k => k.malzeme_id && parseFloat(k.mikron) > 0)
    if (gecerliKatmanlar.length === 0) return null

    const katmanGirdi = gecerliKatmanlar.map(k => {
      const malzeme = malzemeler.find(m => m.id === k.malzeme_id)
      return {
        malzeme_adi: malzeme?.ad || '',
        malzeme_tur: malzeme?.tur || '',
        mikron: parseFloat(k.mikron) || 0,
        yogunluk: Number(malzeme?.yogunluk) || 0,
        birim_fiyat: guncelFiyat(k.malzeme_id),
        baskili: k.baskili,
        baski_kaplama_yuzdesi: k.baskili ? (parseFloat(k.baski_yuzde) || 0) : undefined,
      }
    })

    const laminasyonSayisi = gecerliKatmanlar.filter(k => k.laminasyon_onceki).length
    const mamulKgM2Deger = mamulKgM2(katmanGirdi, laminasyonSayisi)

    // Fason: sadece parca urunlerde ve kullanici secmisse. Adet agirligini
    // her zaman hesapliyoruz ki tanimli fiyat olmasa bile agirligi gosterebilelim.
    let adetGram = 0
    let fasonBirimFiyat = 0
    let fasonUygulanabilir = false
    if (FASON_TURLERI.includes(ciktiTuru)) {
      fasonUygulanabilir = true
      adetGram = adetAgirligiHesapla({
        cikti_turu: ciktiTuru,
        en_mm: parseFloat(enMm) || 0,
        boy_mm: parseFloat(boyMm) || 0,
        kurek_mm: parseFloat(kurekMm) || 0,
        yan_kurek_mm: parseFloat(yanKurekMm) || 0,
        mamul_kg_m2: mamulKgM2Deger,
        zip_var: zipVar,
      })
      if (fasonKullan) {
        fasonBirimFiyat = fasonFiyatBul(ciktiTuru, adetGram, fasonFiyatlar.map(f => ({
          tur: f.tur, min_gram: Number(f.min_gram), max_gram: f.max_gram === null ? null : Number(f.max_gram), birim_fiyat_kg: Number(f.birim_fiyat_kg),
        })))
      }
    }
    const fasonTanimYok = fasonUygulanabilir && fasonKullan && fasonBirimFiyat === 0

    // Sentetik bobin/net en cifti: sadece kenar_fire_pct'yi sabit yuzdeye
    // esitlemek icin var, gercek mm anlami tasimiyor.
    const sentetikNetEn = SENTETIK_BOBIN_EN_MM * (1 - fireYuzdesi / 100)

    const girdi: FiyatGirdisi = {
      katmanlar: katmanGirdi,
      laminasyon_sayisi: laminasyonSayisi,
      siparis_kg: parseFloat(siparisKg) || 0,
      bobin_en_mm: SENTETIK_BOBIN_EN_MM,
      kullanilabilir_en_mm: sentetikNetEn,
      kenar_tirasi_mm: 0,
      boya_fiyat_kg: Number(parametre.boya_fiyat_kg),
      tutkal_fiyat_kg: Number(parametre.tutkal_fiyat_kg),
      iscilik_kg: Number(parametre.iscilik_fiyat_kg),
      baslangic_fire_kg: Number(parametre.baslangic_fire_kg),
      kar_pct: parseFloat(karPct) || 0,
      fason_birim_fiyat_kg: fasonBirimFiyat,
    }

    const sonuc = hesaplaFiyat(girdi)

    // Adet bazli gosterim (parca urunler icin metre yerine daha anlamli)
    let adetSayisi = 0
    let adetBasiSatis = 0
    if (isParca && adetGram > 0) {
      adetSayisi = (girdi.siparis_kg * 1000) / adetGram
      adetBasiSatis = adetSayisi > 0 ? sonuc.satis_fiyati_toplam / adetSayisi : 0
    }

    // Bobin icin gercek metre: satisci gercek bobin enini biliyor, o yuzden
    // burada gercek deger kullaniliyor (sentetik degil).
    let bobinMetre = 0
    if (ciktiTuru === 'bobin') {
      const bobinEn = parseFloat(bobinEnMm) || 0
      bobinMetre = bobinEn > 0 ? (sonuc.net_m2 / (bobinEn / 1000)) : 0
    }

    return { sonuc, adetGram, fasonTanimYok, fasonUygulanabilir, adetSayisi, adetBasiSatis, bobinMetre }
  }, [katmanlar, malzemeler, fiyatlar, fasonFiyatlar, parametre, ciktiTuru, enMm, boyMm, kurekMm, yanKurekMm, bobinEnMm,
      siparisKg, karPct, zipVar, fasonKullan, isParca, fireYuzdesi])

  if (loading) return <div className="p-8 text-gray-400 text-sm">Yukleniyor...</div>

  const sonuc: FiyatCiktisi | null = hesap?.sonuc || null

  return (
    <div className="p-6 max-w-5xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">Hizli Hesap Makinesi</h1>
          <p className="text-gray-500 text-xs mt-0.5">
            Proje kaydi acmadan aninda maliyet/satis fiyati hesabi. Kato eni, kenar tirasi gibi uretim/planlama
            detaylarini girmene gerek yok — sadece satacagin urunun kendi olculerini gir.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SOL: GIRDILER */}
        <div className="space-y-4">

          <div className="card card-body space-y-3">
            <div className="font-medium text-sm mb-1">Satilan urun</div>
            <div>
              <label className="text-xs text-gray-400">Cikti turu</label>
              <select value={ciktiTuru} onChange={e => setCiktiTuru(e.target.value as CiktiTuru)} className="w-full">
                {(Object.keys(CIKTI_LABEL) as CiktiTuru[]).map(c => (
                  <option key={c} value={c}>{CIKTI_LABEL[c]}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {ciktiTuru === 'bobin' ? (
                <div>
                  <label className="text-xs text-gray-400">Bobin eni (mm) — satilan urunun kendi eni</label>
                  <input type="number" value={bobinEnMm} onChange={e => setBobinEnMm(e.target.value)} />
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-xs text-gray-400">En (mm)</label>
                    <input type="number" value={enMm} onChange={e => setEnMm(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Boy (mm)</label>
                    <input type="number" value={boyMm} onChange={e => setBoyMm(e.target.value)} />
                  </div>
                  {(ciktiTuru === 'doypack' || ciktiTuru === 'flat_bottom' || ciktiTuru === 'quadro' || ciktiTuru === 'yan_kesim' || ciktiTuru === 'katlama_torba') && (
                    <div>
                      <label className="text-xs text-gray-400">{ciktiTuru === 'flat_bottom' ? 'Alt koruk (mm)' : 'Koruk (mm)'}</label>
                      <input type="number" value={kurekMm} onChange={e => setKurekMm(e.target.value)} />
                    </div>
                  )}
                  {ciktiTuru === 'flat_bottom' && (
                    <div>
                      <label className="text-xs text-gray-400">Yan koruk eni (mm)</label>
                      <input type="number" value={yanKurekMm} onChange={e => setYanKurekMm(e.target.value)} />
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="text-xs text-gray-400 pt-2 border-t border-gray-100">
              Kenar firesi (ortalama, Referanslar'dan): <span className="font-mono text-gray-600">%{fireYuzdesi.toFixed(1)}</span>
              {' '}— kato eni planlama tarafindan belirlenince gercek fire orani degisebilir.
            </div>
          </div>

          <div className="card card-body space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-medium text-sm">Katmanlar</div>
              <button onClick={katmanEkle} className="btn btn-sm">+ Katman ekle</button>
            </div>
            {katmanlar.map((k, i) => (
              <div key={i} className="flex items-center gap-2 flex-wrap border-b border-gray-50 pb-2">
                <select value={k.malzeme_id} onChange={e => katmanGuncelle(i, { malzeme_id: e.target.value })} className="flex-1 min-w-[160px]">
                  <option value="">Malzeme sec...</option>
                  {malzemeler.map(m => (
                    <option key={m.id} value={m.id}>{m.ad} (${guncelFiyat(m.id).toFixed(4)}/kg)</option>
                  ))}
                </select>
                <input type="number" value={k.mikron} onChange={e => katmanGuncelle(i, { mikron: e.target.value })} placeholder="mikron" className="!w-20" />
                <label className="text-xs flex items-center gap-1 whitespace-nowrap">
                  <input type="checkbox" checked={k.baskili} onChange={e => katmanGuncelle(i, { baskili: e.target.checked })} /> Baskili
                </label>
                {k.baskili && (
                  <label className="text-xs flex items-center gap-1 whitespace-nowrap">
                    Kaplama
                    <input type="number" min={0} max={100} value={k.baski_yuzde}
                      onChange={e => katmanGuncelle(i, { baski_yuzde: e.target.value })} className="!w-14" />%
                  </label>
                )}
                <label className="text-xs flex items-center gap-1 whitespace-nowrap">
                  <input type="checkbox" checked={k.laminasyon_onceki} onChange={e => katmanGuncelle(i, { laminasyon_onceki: e.target.checked })} /> Lamine (bir onceki katmana)
                </label>
                <button onClick={() => katmanSil(i)} className="btn btn-sm btn-danger">Sil</button>
              </div>
            ))}
          </div>

          <div className="card card-body space-y-3">
            <div className="font-medium text-sm mb-1">Siparis</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400">Siparis miktari (kg)</label>
                <input type="number" value={siparisKg} onChange={e => setSiparisKg(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-gray-400">Kar marji (%)</label>
                <input type="number" step="0.5" value={karPct} onChange={e => setKarPct(e.target.value)} />
              </div>
            </div>
            {FASON_TURLERI.includes(ciktiTuru) && (
              <div className="flex items-center gap-4 pt-2 border-t border-gray-100">
                <label className="text-xs flex items-center gap-1">
                  <input type="checkbox" checked={fasonKullan} onChange={e => setFasonKullan(e.target.checked)} /> Fason kesim maliyetini dahil et
                </label>
                <label className="text-xs flex items-center gap-1">
                  <input type="checkbox" checked={zipVar} onChange={e => setZipVar(e.target.checked)} /> Zip var
                </label>
              </div>
            )}
            <div className="text-xs text-gray-400 pt-2 border-t border-gray-100 flex items-center justify-between">
              <span>
                Boya ${parametre ? Number(parametre.boya_fiyat_kg).toFixed(2) : '—'}/kg · Tutkal ${parametre ? Number(parametre.tutkal_fiyat_kg).toFixed(2) : '—'}/kg
                {' '}· Iscilik ${parametre ? Number(parametre.iscilik_fiyat_kg).toFixed(2) : '—'}/kg · Baslangic firesi {parametre ? Number(parametre.baslangic_fire_kg).toFixed(0) : '—'} kg
              </span>
              {user?.rol === 'admin' && <Link href="/referanslar" className="text-blue-600 hover:underline whitespace-nowrap ml-2">degistir →</Link>}
            </div>
          </div>
        </div>

        {/* SAG: SONUC */}
        <div className="space-y-4">
          {!sonuc || !hesap ? (
            <div className="card card-body text-sm text-gray-400 text-center py-12">
              En az bir katmana malzeme ve mikron girince sonuc burada aninda gorunur.
            </div>
          ) : (
            <>
              {hesap.fasonTanimYok && (
                <div className="card card-body bg-red-50 border border-red-200 text-xs text-red-700">
                  ⚠ Bu urun icin 1 adet agirligi ~{hesap.adetGram.toFixed(1)} g — {CIKTI_LABEL[ciktiTuru]} icin bu agirlikta
                  tanimli fason fiyati yok, fason maliyeti $0 olarak hesaplandi. Gercek maliyet daha yuksek olabilir.
                  {user?.rol === 'admin' ? (
                    <> <Link href="/referanslar" className="underline font-medium">Referanslar'dan ekle →</Link></>
                  ) : (
                    <> Yoneticinden Referanslar sayfasina bu araligi eklemesini iste.</>
                  )}
                </div>
              )}

              <div className="card card-body">
                <div className="font-medium text-sm mb-3">Sonuc</div>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <span className="text-gray-400">Net m² (tahmini, %{fireYuzdesi.toFixed(1)} fire dahil)</span><span className="text-right font-mono">{sonuc.net_m2.toLocaleString('tr-TR')}</span>
                  <span className="text-gray-400">Mamul kg</span><span className="text-right font-mono">{sonuc.mamul_kg.toFixed(1)}</span>
                  {ciktiTuru === 'bobin' ? (
                    <>
                      <span className="text-gray-400">Tahmini metre</span><span className="text-right font-mono">{hesap.bobinMetre.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</span>
                    </>
                  ) : hesap.adetGram > 0 && (
                    <>
                      <span className="text-gray-400">1 adet agirligi</span><span className="text-right font-mono">{hesap.adetGram.toFixed(1)} g</span>
                      <span className="text-gray-400">Tahmini adet sayisi</span><span className="text-right font-mono">{hesap.adetSayisi.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-header"><span className="font-medium text-sm">Maliyet detayi</span></div>
                <table className="table-base">
                  <tbody>
                    {sonuc.katmanlar.map((k, i) => (
                      <tr key={i}>
                        <td className="text-xs text-gray-500">{k.malzeme_adi} ({k.mikron}µ)</td>
                        <td className="text-right font-mono text-xs">{k.toplam_kg.toFixed(1)} kg</td>
                        <td className="text-right font-mono text-xs">${k.tutar.toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr><td className="text-xs text-gray-500">Boya</td><td className="text-right font-mono text-xs">{sonuc.boya_kullanilan_kg.toFixed(2)} kg</td><td className="text-right font-mono text-xs">${sonuc.boya_tutar.toFixed(2)}</td></tr>
                    <tr><td className="text-xs text-gray-500">Tutkal</td><td className="text-right font-mono text-xs">{sonuc.tutkal_kg.toFixed(2)} kg</td><td className="text-right font-mono text-xs">${sonuc.tutkal_tutar.toFixed(2)}</td></tr>
                    <tr><td className="text-xs text-gray-500">Iscilik</td><td></td><td className="text-right font-mono text-xs">${sonuc.iscilik_tutar.toFixed(2)}</td></tr>
                    {hesap.fasonUygulanabilir && (
                      <tr>
                        <td className="text-xs text-gray-500">Fason {hesap.fasonTanimYok ? '(tanimsiz)' : ''}</td>
                        <td></td>
                        <td className="text-right font-mono text-xs">${sonuc.fason_tutar.toFixed(2)}</td>
                      </tr>
                    )}
                    <tr className="border-t border-gray-200">
                      <td className="text-xs font-medium">Uretim maliyeti</td><td></td>
                      <td className="text-right font-mono text-xs font-medium">${sonuc.uretim_maliyeti.toFixed(2)}</td>
                    </tr>
                    <tr><td className="text-xs text-gray-500">Baslangic fire</td><td></td><td className="text-right font-mono text-xs">${sonuc.baslangic_fire_tutar.toFixed(2)}</td></tr>
                    <tr><td className="text-xs text-gray-500">Kenar fire (%{fireYuzdesi.toFixed(1)}, tahmini)</td><td></td><td className="text-right font-mono text-xs">${sonuc.kenar_fire_tutar.toFixed(2)}</td></tr>
                    <tr className="border-t-2 border-gray-800">
                      <td className="text-sm font-semibold">Toplam maliyet</td><td></td>
                      <td className="text-right font-mono text-sm font-semibold">${sonuc.toplam_maliyet.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="card card-body bg-green-50 border border-green-100">
                <div className="font-medium text-sm mb-3 text-green-800">Satis fiyati (%{sonuc.kar_pct} kar)</div>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <span className="text-green-700">USD/kg</span><span className="text-right font-mono font-semibold">${sonuc.satis_fiyati_kg.toFixed(4)}</span>
                  {isParca && hesap.adetBasiSatis > 0 && (
                    <><span className="text-green-700">USD/adet</span><span className="text-right font-mono font-semibold">${hesap.adetBasiSatis.toFixed(4)}</span></>
                  )}
                  {ciktiTuru === 'bobin' && hesap.bobinMetre > 0 && (
                    <><span className="text-green-700">USD/metre</span><span className="text-right font-mono font-semibold">${(sonuc.satis_fiyati_toplam / hesap.bobinMetre).toFixed(4)}</span></>
                  )}
                  <span className="text-green-700">Toplam</span><span className="text-right font-mono font-semibold">${sonuc.satis_fiyati_toplam.toFixed(2)}</span>
                  <span className="text-green-700">Kar tutari</span><span className="text-right font-mono font-semibold">${sonuc.kar_tutar.toFixed(2)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
