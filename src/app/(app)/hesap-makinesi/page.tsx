'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { katoEniHesapla, type CiktiTuru } from '@/types'
import { hesaplaFiyat, adetAgirligiHesapla, fasonFiyatBul, type FiyatGirdisi, type FiyatCiktisi } from '@/lib/fiyatlama'

const CIKTI_LABEL: Record<CiktiTuru, string> = {
  bobin: 'Bobin', doypack: 'Doypack', quadro: 'Quadro', flat_bottom: 'Flat bottom',
  sirt_kaynak: 'Sirt kaynak', yan_kesim: 'Yan kesim', katlama_torba: 'Katlama torba', diger: 'Diger',
}

interface KatmanSatir {
  malzeme_id: string
  mikron: string
  baskili: boolean
  laminasyon_onceki: boolean
}

export default function HesapMakinesiPage() {
  const [malzemeler, setMalzemeler] = useState<any[]>([])
  const [fiyatlar, setFiyatlar] = useState<any[]>([])
  const [fasonFiyatlar, setFasonFiyatlar] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [ciktiTuru, setCiktiTuru] = useState<CiktiTuru>('doypack')
  const [enMm, setEnMm] = useState('200')
  const [boyMm, setBoyMm] = useState('300')
  const [kurekMm, setKurekMm] = useState('50')
  const [kapakMm, setKapakMm] = useState('50')
  const [bobinEnMm, setBobinEnMm] = useState('350')
  const [kenarTirasiMm, setKenarTirasiMm] = useState('5')
  const [netEnManuel, setNetEnManuel] = useState('')

  const [katmanlar, setKatmanlar] = useState<KatmanSatir[]>([
    { malzeme_id: '', mikron: '20', baskili: true, laminasyon_onceki: false },
    { malzeme_id: '', mikron: '70', baskili: false, laminasyon_onceki: true },
  ])

  const [siparisKg, setSiparisKg] = useState('500')
  const [baslangicFireKg, setBaslangicFireKg] = useState('50')
  const [boyaFiyat, setBoyaFiyat] = useState('4.50')
  const [tutkalFiyat, setTutkalFiyat] = useState('4.50')
  const [iscilik, setIscilik] = useState('0.50')
  const [karPct, setKarPct] = useState('25')
  const [zipVar, setZipVar] = useState(false)
  const [fasonKullan, setFasonKullan] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: m }, { data: f }, { data: ff }] = await Promise.all([
      supabase.from('malzeme_tanim').select('*').eq('aktif', true).order('ad'),
      supabase.from('malzeme_fiyat').select('*').order('gecerlilik_tarihi', { ascending: false }),
      supabase.from('fason_fiyat').select('*').eq('aktif', true).order('tur').order('min_gram'),
    ])
    setMalzemeler(m || [])
    setFiyatlar(f || [])
    setFasonFiyatlar(ff || [])
    setLoading(false)
  }

  // Her malzeme icin en guncel fiyat (gecerlilik_tarihi'ne gore ilk kayit)
  function guncelFiyat(malzeme_id: string): number {
    const kayit = fiyatlar.find(f => f.malzeme_id === malzeme_id)
    return kayit ? Number(kayit.birim_fiyat) : 0
  }

  const katoEni = useMemo(() => katoEniHesapla({
    cikti_turu: ciktiTuru,
    en_mm: parseFloat(enMm) || 0,
    boy_mm: parseFloat(boyMm) || 0,
    kurek_mm: parseFloat(kurekMm) || 0,
    kapak_mm: parseFloat(kapakMm) || 0,
    bobin_en_mm: parseFloat(bobinEnMm) || 0,
  }), [ciktiTuru, enMm, boyMm, kurekMm, kapakMm, bobinEnMm])

  const netEnHesap = useMemo(() => {
    if (netEnManuel) return parseFloat(netEnManuel) || 0
    const tiras = parseFloat(kenarTirasiMm) || 0
    return Math.max(0, katoEni - tiras * 2)
  }, [katoEni, kenarTirasiMm, netEnManuel])

  function katmanEkle() {
    setKatmanlar([...katmanlar, { malzeme_id: '', mikron: '', baskili: false, laminasyon_onceki: false }])
  }
  function katmanSil(i: number) {
    setKatmanlar(katmanlar.filter((_, idx) => idx !== i))
  }
  function katmanGuncelle(i: number, patch: Partial<KatmanSatir>) {
    setKatmanlar(katmanlar.map((k, idx) => idx === i ? { ...k, ...patch } : k))
  }

  const sonuc: FiyatCiktisi | null = useMemo(() => {
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
      }
    })

    const laminasyonSayisi = gecerliKatmanlar.filter(k => k.laminasyon_onceki).length

    // Fason: sadece doypack/quadro/flat_bottom/sirt_kaynak icin ve kullanici secmisse
    let fasonBirimFiyat = 0
    const fasonUygulanir = fasonKullan && ['doypack', 'quadro', 'flat_bottom', 'sirt_kaynak'].includes(ciktiTuru)
    if (fasonUygulanir) {
      const filmKgM2 = katmanGirdi.reduce((s, k) => s + (k.mikron * k.yogunluk) / 1000, 0)
      const adetGram = adetAgirligiHesapla({
        cikti_turu: ciktiTuru,
        en_mm: parseFloat(enMm) || 0,
        boy_mm: parseFloat(boyMm) || 0,
        kurek_mm: parseFloat(kurekMm) || 0,
        mamul_kg_m2: filmKgM2,
        zip_var: zipVar,
      })
      fasonBirimFiyat = fasonFiyatBul(ciktiTuru, adetGram, fasonFiyatlar.map(f => ({
        tur: f.tur, min_gram: Number(f.min_gram), max_gram: f.max_gram === null ? null : Number(f.max_gram), birim_fiyat_kg: Number(f.birim_fiyat_kg),
      })))
    }

    const girdi: FiyatGirdisi = {
      katmanlar: katmanGirdi,
      laminasyon_sayisi: laminasyonSayisi,
      siparis_kg: parseFloat(siparisKg) || 0,
      bobin_en_mm: katoEni,
      kullanilabilir_en_mm: netEnHesap,
      kenar_tirasi_mm: parseFloat(kenarTirasiMm) || 0,
      boya_fiyat_kg: parseFloat(boyaFiyat) || 0,
      tutkal_fiyat_kg: parseFloat(tutkalFiyat) || 0,
      iscilik_kg: parseFloat(iscilik) || 0,
      baslangic_fire_kg: parseFloat(baslangicFireKg) || 0,
      kar_pct: parseFloat(karPct) || 0,
      fason_birim_fiyat_kg: fasonBirimFiyat,
    }

    return hesaplaFiyat(girdi)
  }, [katmanlar, malzemeler, fiyatlar, fasonFiyatlar, ciktiTuru, enMm, boyMm, kurekMm, siparisKg,
      katoEni, netEnHesap, kenarTirasiMm, boyaFiyat, tutkalFiyat, iscilik, baslangicFireKg, karPct, zipVar, fasonKullan])

  if (loading) return <div className="p-8 text-gray-400 text-sm">Yukleniyor...</div>

  return (
    <div className="p-6 max-w-5xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">Hizli Hesap Makinesi</h1>
          <p className="text-gray-500 text-xs mt-0.5">
            Proje kaydi acmadan aninda maliyet/satis fiyati hesabi — ayni fiyatlama.ts motoru, Excel'e ihtiyac yok.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SOL: GIRDILER */}
        <div className="space-y-4">

          <div className="card card-body space-y-3">
            <div className="font-medium text-sm mb-1">Cikti ve ebatlar</div>
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
                  <label className="text-xs text-gray-400">Bobin eni (mm)</label>
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
                      <label className="text-xs text-gray-400">Koruk (mm)</label>
                      <input type="number" value={kurekMm} onChange={e => setKurekMm(e.target.value)} />
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
              <div>
                <label className="text-xs text-gray-400">Kato eni (otomatik)</label>
                <div className="font-mono text-sm py-1.5">{katoEni.toFixed(0)} mm</div>
              </div>
              <div>
                <label className="text-xs text-gray-400">Kenar tirasi (her taraf, mm)</label>
                <input type="number" value={kenarTirasiMm} onChange={e => setKenarTirasiMm(e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-400">Net kullanilabilir en — otomatik {(katoEni - (parseFloat(kenarTirasiMm)||0)*2).toFixed(0)}mm, gerekirse elle degistir</label>
                <input type="number" value={netEnManuel} onChange={e => setNetEnManuel(e.target.value)} placeholder={`${(katoEni - (parseFloat(kenarTirasiMm)||0)*2).toFixed(0)}`} />
              </div>
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
                <label className="text-xs flex items-center gap-1 whitespace-nowrap">
                  <input type="checkbox" checked={k.laminasyon_onceki} onChange={e => katmanGuncelle(i, { laminasyon_onceki: e.target.checked })} /> Lamine (bir onceki katmana)
                </label>
                <button onClick={() => katmanSil(i)} className="btn btn-sm btn-danger">Sil</button>
              </div>
            ))}
          </div>

          <div className="card card-body space-y-3">
            <div className="font-medium text-sm mb-1">Siparis ve maliyet parametreleri</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400">Siparis miktari (kg)</label>
                <input type="number" value={siparisKg} onChange={e => setSiparisKg(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-gray-400">Baslangic firesi (kg)</label>
                <input type="number" value={baslangicFireKg} onChange={e => setBaslangicFireKg(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-gray-400">Boya fiyati (USD/kg)</label>
                <input type="number" step="0.01" value={boyaFiyat} onChange={e => setBoyaFiyat(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-gray-400">Tutkal fiyati (USD/kg)</label>
                <input type="number" step="0.01" value={tutkalFiyat} onChange={e => setTutkalFiyat(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-gray-400">Iscilik (USD/kg)</label>
                <input type="number" step="0.01" value={iscilik} onChange={e => setIscilik(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-gray-400">Kar marji (%)</label>
                <input type="number" step="0.5" value={karPct} onChange={e => setKarPct(e.target.value)} />
              </div>
            </div>
            {['doypack', 'quadro', 'flat_bottom', 'sirt_kaynak'].includes(ciktiTuru) && (
              <div className="flex items-center gap-4 pt-2 border-t border-gray-100">
                <label className="text-xs flex items-center gap-1">
                  <input type="checkbox" checked={fasonKullan} onChange={e => setFasonKullan(e.target.checked)} /> Fason kesim maliyetini dahil et
                </label>
                <label className="text-xs flex items-center gap-1">
                  <input type="checkbox" checked={zipVar} onChange={e => setZipVar(e.target.checked)} /> Zip var
                </label>
              </div>
            )}
          </div>
        </div>

        {/* SAG: SONUC */}
        <div className="space-y-4">
          {!sonuc ? (
            <div className="card card-body text-sm text-gray-400 text-center py-12">
              En az bir katmana malzeme ve mikron girince sonuc burada aninda gorunur.
            </div>
          ) : (
            <>
              <div className="card card-body">
                <div className="font-medium text-sm mb-3">Sonuc</div>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <span className="text-gray-400">Net m²</span><span className="text-right font-mono">{sonuc.net_m2.toLocaleString('tr-TR')}</span>
                  <span className="text-gray-400">Metre</span><span className="text-right font-mono">{sonuc.metre.toLocaleString('tr-TR')}</span>
                  <span className="text-gray-400">Kenar fire</span><span className="text-right font-mono">%{sonuc.kenar_fire_pct.toFixed(2)}</span>
                  <span className="text-gray-400">Mamul kg</span><span className="text-right font-mono">{sonuc.mamul_kg.toFixed(1)}</span>
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
                    {sonuc.fason_tutar > 0 && (
                      <tr><td className="text-xs text-gray-500">Fason</td><td></td><td className="text-right font-mono text-xs">${sonuc.fason_tutar.toFixed(2)}</td></tr>
                    )}
                    <tr className="border-t border-gray-200">
                      <td className="text-xs font-medium">Uretim maliyeti</td><td></td>
                      <td className="text-right font-mono text-xs font-medium">${sonuc.uretim_maliyeti.toFixed(2)}</td>
                    </tr>
                    <tr><td className="text-xs text-gray-500">Baslangic fire</td><td></td><td className="text-right font-mono text-xs">${sonuc.baslangic_fire_tutar.toFixed(2)}</td></tr>
                    <tr><td className="text-xs text-gray-500">Kenar fire</td><td></td><td className="text-right font-mono text-xs">${sonuc.kenar_fire_tutar.toFixed(2)}</td></tr>
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
                  <span className="text-green-700">USD/m²</span><span className="text-right font-mono font-semibold">${sonuc.satis_fiyati_m2.toFixed(4)}</span>
                  <span className="text-green-700">USD/metre</span><span className="text-right font-mono font-semibold">${sonuc.satis_fiyati_metre.toFixed(4)}</span>
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
