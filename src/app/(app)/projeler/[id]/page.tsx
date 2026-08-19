'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { hesaplaFiyat, adetAgirligiHesapla, fasonFiyatBul, KAZAN_CAPLARI, fotoselHesapla, type FiyatGirdisi } from '@/lib/fiyatlama'
import { yeniProformaNo, yeniPoNo } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

// Siparis onaylandiginda (musteri_onayladi ve sonrasi) stok kontrolu bu durumlarda calisir.
const STOK_KONTROL_DURUMLARI = ['musteri_onayladi', 'uretimde', 'tamamlandi']
// Genis bobin, dilimlenerek daraltilabilir: ihtiyac duyulan enin en fazla %10 uzeri kabul edilir.
const EN_TOLERANS_PCT = 10

// Bir siparis icin katman basina gereken ham malzeme miktarini (kg) hesaplar.
// Hem sayfa yuklenirken (otomatik satin alma kontrolu) hem render sirasinda (Stok durumu karti)
// ayni mantikla kullanilabilsin diye component disinda, parametreye bagli saf bir fonksiyon.
function hesaplaGerekliMiktarlar(p: any, kats: any[], tekliflerListesi: any[], proformalarListesi: any[]) {
  if (!p?.kato_eni_mm || kats.length === 0) return []

  const onayli = proformalarListesi.find((pf: any) => pf.durum === 'onaylandi')
  const kaynakProforma = onayli || proformalarListesi[0]
  let miktarKg = 0
  let toleransPct = 0
  if (kaynakProforma) {
    miktarKg = Number(kaynakProforma.secilen_miktar_kg) || 0
    toleransPct = Number(kaynakProforma.tolerans_pct) || 0
  } else if (tekliflerListesi[0]) {
    miktarKg = Number(tekliflerListesi[0].miktar_kg) || 0
    toleransPct = Number(tekliflerListesi[0].tolerans_pct) || 0
  }
  if (miktarKg <= 0) return []

  // En yakin miktarli proje_fiyat kaydinin kenar fire oranini kullan (net en'i geri hesaplamak icin)
  const enYakinTeklif = tekliflerListesi.length > 0
    ? tekliflerListesi.reduce((best: any, t: any) =>
        Math.abs(Number(t.miktar_kg) - miktarKg) < Math.abs(Number(best.miktar_kg) - miktarKg) ? t : best)
    : null
  const fireOrani = enYakinTeklif ? Number(enYakinTeklif.fire_orani_pct) || 0 : 0
  const netEn = p.kato_eni_mm * (1 - fireOrani / 100)
  // Tolerans dahil en kotu senaryoya gore ham madde ayir (eksik kalmasin diye)
  const gerekliToplamKg = miktarKg * (1 + toleransPct / 100)

  const lam = kats.filter((k: any) => k.laminasyon_onceki).length
  const baskili = kats.some((k: any) => k.baskili)
  const katmanGirdileri = kats.map((k: any) => ({
    malzeme_adi: k.malzeme?.ad || '', malzeme_tur: k.malzeme?.tur || '',
    mikron: k.mikron, yogunluk: k.malzeme?.yogunluk || 0.92, birim_fiyat: 0, baskili: k.baskili,
  }))
  const sonuc = hesaplaFiyat({
    katmanlar: katmanGirdileri, laminasyon_sayisi: lam, siparis_kg: gerekliToplamKg,
    bobin_en_mm: p.kato_eni_mm, kullanilabilir_en_mm: netEn, kenar_tirasi_mm: 0,
    boya_fiyat_kg: 0, tutkal_fiyat_kg: 0, iscilik_kg: 0, baslangic_fire_kg: 0, kar_pct: 0, fason_birim_fiyat_kg: 0,
  })
  return sonuc.katmanlar.map((kd, i) => ({
    malzeme_id: kats[i].malzeme_id, mikron: kats[i].mikron, malzeme_adi: kd.malzeme_adi, gerekli_kg: kd.toplam_kg,
  }))
}

const DURUM_BADGE: Record<string,string> = {
  taslak:'badge-gray', fiyatlama:'badge-blue',
  proforma_gonderildi:'badge-amber', musteri_onayladi:'badge-green',
  tamamlandi:'badge-green', iptal:'badge-red'
}
const DURUM_LABEL: Record<string,string> = {
  taslak:'Taslak', fiyatlama:'Fiyatlama',
  proforma_gonderildi:'Proforma Gonderildi', musteri_onayladi:'Musteri Onayladi',
  tamamlandi:'Tamamlandi', iptal:'Iptal'
}
const ADIM_RENK: Record<string,string> = {
  baski:'bg-blue-100 text-blue-800',
  laminasyon_1:'bg-teal-100 text-teal-800', laminasyon_2:'bg-teal-100 text-teal-800', laminasyon_3:'bg-teal-100 text-teal-800',
  kurleme_1:'bg-amber-100 text-amber-800', kurleme_2:'bg-amber-100 text-amber-800', kurleme_3:'bg-amber-100 text-amber-800',
  dilimleme:'bg-green-100 text-green-800', katlama:'bg-purple-100 text-purple-800',
  yan_kesim:'bg-red-100 text-red-800', doypack:'bg-gray-100 text-gray-700',
  quadro:'bg-gray-100 text-gray-700', flat_bottom:'bg-gray-100 text-gray-700',
  sirt_kaynak:'bg-gray-100 text-gray-700', sonic:'bg-pink-100 text-pink-800',
}
const ADIM_LABEL: Record<string,string> = {
  baski:'Baski', laminasyon_1:'Laminasyon 1', laminasyon_2:'Laminasyon 2', laminasyon_3:'Laminasyon 3',
  kurleme_1:'Kurleme 1 (24-48 saat)', kurleme_2:'Kurleme 2 (24-48 saat)', kurleme_3:'Kurleme 3 (24-48 saat)',
  dilimleme:'Dilimleme', katlama:'Katlama', yan_kesim:'Yan Kesim',
  doypack:'Doypack (Fason)', quadro:'Quadro (Fason)', flat_bottom:'Flat Bottom (Fason)',
  sirt_kaynak:'Sirt Kaynak (Fason)', sonic:'Sonic',
}

const VARSAYILAN_MIKTARLAR = [500, 1000, 3000]

export default function ProjeDetayPage() {
  const { id } = useParams()
  const router = useRouter()
  const [proje, setProje] = useState<any>(null)
  const [katmanlar, setKatmanlar] = useState<any[]>([])
  const [teklifler, setTeklifler] = useState<any[]>([])
  const [malzemeFiyatlari, setMalzemeFiyatlari] = useState<any[]>([])
  const [fasonFiyatlar, setFasonFiyatlar] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [fiyatModal, setFiyatModal] = useState(false)
  const [hesaplanan, setHesaplanan] = useState<any[]>([])
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [msg, setMsg] = useState('')
  const [proformalar, setProformalar] = useState<any[]>([])
  const [proformaOlusturuluyor, setProformaOlusturuluyor] = useState<string | null>(null)
  const { user } = useAuth()
  const [depoStok, setDepoStok] = useState<any[]>([])
  const [satinalmaKalemleri, setSatinalmaKalemleri] = useState<any[]>([])
  const [rezerveEdiliyor, setRezerveEdiliyor] = useState<string | null>(null)
  const [baglanmisLotlar, setBaglanmisLotlar] = useState<Set<string>>(new Set())

  // Fiyat parametreleri
  const [hamBobin, setHamBobin] = useState('')
  const [netEn, setNetEn] = useState('')
  const [baslangicFire, setBaslangicFire] = useState('50')
  const [kazanCap, setKazanCap] = useState('')
  const [otomatikKazan, setOtomatikKazan] = useState(true)
  const [boyaFiyat, setBoyaFiyat] = useState('4.50')
  const [tutkalFiyat, setTutkalFiyat] = useState('4.50')
  const [iscilik, setIscilik] = useState('0.50')
  const [karPct, setKarPct] = useState('25')
  const [toleransPct, setToleransPct] = useState('15')

  // Hesaplanacak miktarlar (kg) — standart 3 kademe + musterinin istedigi ozel miktar(lar)
  const [miktarlar, setMiktarlar] = useState<number[]>(VARSAYILAN_MIKTARLAR)
  const [ozelMiktarDeger, setOzelMiktarDeger] = useState('')
  const [ozelMiktarBirim, setOzelMiktarBirim] = useState<'kg' | 'metre'>('kg')

  useEffect(() => { load() }, [id])

  async function load() {
    const [{ data: p }, { data: k }, { data: t }, { data: mf }, { data: ff }, { data: pr }] = await Promise.all([
      supabase.from('proje').select('*, musteri:musteri_tanim(ad,para_birimi)').eq('id', id).single(),
      supabase.from('proje_katman').select('*, malzeme:malzeme_tanim(ad,tur,yogunluk)').eq('proje_id', id).order('sira'),
      supabase.from('proje_fiyat').select('*').eq('proje_id', id).order('olusturma', {ascending:false}),
      supabase.from('malzeme_fiyat').select('*, malzeme:malzeme_tanim(id,tur)').order('gecerlilik_tarihi', {ascending:false}),
      supabase.from('fason_fiyat').select('*').eq('aktif', true).order('tur').order('min_gram'),
      supabase.from('proforma').select('*').eq('proje_id', id).order('olusturma', {ascending:false}),
    ])
    setProje(p)
    setKatmanlar(k || [])
    setTeklifler(t || [])
    setMalzemeFiyatlari(mf || [])
    setFasonFiyatlar(ff || [])
    setProformalar(pr || [])
    if (p?.kato_eni_mm) setHamBobin(String(p.kato_eni_mm))

    const malzemeIdler = Array.from(new Set((k || []).map((x: any) => x.malzeme_id)))
    if (malzemeIdler.length > 0) {
      const [{ data: ds }, { data: sak }] = await Promise.all([
        supabase.from('depo_stok').select('*').in('malzeme_id', malzemeIdler).order('en_mm'),
        supabase.from('satinalma_kalem').select('*, siparis:satinalma_siparis(po_no,durum)').eq('proje_id', id),
      ])
      setDepoStok(ds || [])
      setSatinalmaKalemleri(sak || [])

      if (p && STOK_KONTROL_DURUMLARI.includes(p.durum)) {
        await otomatikSatinAlmaKontrol(p, k || [], ds || [], sak || [], t || [], pr || [])
      }
    } else {
      setDepoStok([])
      setSatinalmaKalemleri([])
    }
    setLoading(false)
  }

  // Eksik malzeme icin, ayni proje+malzeme+mikron icin zaten aktif bir talep yoksa
  // tek bir "talep" durumunda satin alma siparisi olusturur (idempotent: DB'den kontrol eder).
  async function otomatikSatinAlmaKontrol(p: any, kats: any[], ds: any[], sak: any[], tekliflerListesi: any[], proformalarListesi: any[]) {
    const gerekliListe = hesaplaGerekliMiktarlar(p, kats, tekliflerListesi, proformalarListesi)
    if (gerekliListe.length === 0) return
    const maxEn = p.kato_eni_mm * (1 + EN_TOLERANS_PCT / 100)

    const eksikler = gerekliListe.map(g => {
      const uygunStok = ds
        .filter((d: any) => d.malzeme_id === g.malzeme_id && d.mikron === g.mikron && d.en_mm != null && d.en_mm >= p.kato_eni_mm && d.en_mm <= maxEn)
        .reduce((s: number, l: any) => s + Number(l.agirlik_kg || 0), 0)
      const eksikKg = Math.max(0, g.gerekli_kg - uygunStok)
      const zatenTalepVar = sak.some((kl: any) => kl.malzeme_id === g.malzeme_id && kl.mikron === g.mikron && kl.siparis?.durum !== 'iptal')
      return { ...g, eksikKg, zatenTalepVar }
    }).filter(g => g.eksikKg > 0.5 && !g.zatenTalepVar)

    if (eksikler.length === 0) return

    const po_no = await yeniPoNo()
    const { data: yeniSiparis, error: e1 } = await supabase.from('satinalma_siparis').insert({
      po_no, tedarikci_id: null, durum: 'talep', para_birimi: 'USD',
      notlar: `Otomatik olusturuldu — ${p.proje_no} (${p.ad}) siparisi icin eksik hammadde.`,
    }).select().single()
    if (e1 || !yeniSiparis) return

    await supabase.from('satinalma_kalem').insert(
      eksikler.map(g => ({
        siparis_id: yeniSiparis.id, malzeme_id: g.malzeme_id, proje_id: p.id,
        mikron: g.mikron, en_mm: Math.ceil(p.kato_eni_mm), miktar_kg: Math.ceil(g.eksikKg),
      }))
    )
  }

  async function lotBagla(lot: any, satir: any) {
    if (!user) return
    setRezerveEdiliyor(lot.id)
    const miktar = Math.min(Number(lot.agirlik_kg), satir.gerekli_kg)
    const { error } = await supabase.from('depo_hareket').insert({
      stok_id: lot.id, proje_id: proje.id, tur: 'rezerve', miktar_kg: miktar,
      aciklama: `${proje.proje_no} icin ayrildi (${satir.malzeme_adi} ${satir.mikron}μm)`,
      kullanici_id: user.id,
    })
    setRezerveEdiliyor(null)
    if (!error) setBaglanmisLotlar(prev => new Set(prev).add(lot.id))
  }

  async function proformaOlustur(f: any) {
    setProformaOlusturuluyor(f.id)
    const proforma_no = await yeniProformaNo()
    const gecerlilik = new Date()
    gecerlilik.setDate(gecerlilik.getDate() + 14)
    const { data, error } = await supabase.from('proforma').insert({
      proforma_no, proje_id: id, musteri_id: proje.musteri_id,
      secilen_miktar_kg: f.miktar_kg,
      satis_fiyati_kg: f.satis_fiyati_kg,
      para_birimi: (proje.musteri as any)?.para_birimi || 'USD',
      toplam_tutar: f.satis_fiyati_kg * f.miktar_kg,
      gecerlilik_tarihi: gecerlilik.toISOString().split('T')[0],
      durum: 'gonderildi',
      tolerans_pct: f.tolerans_pct ?? 15,
      secilen_metre: f.metre || null,
    }).select().single()
    setProformaOlusturuluyor(null)
    if (error || !data) { setMsg('Proforma olusturulamadi: ' + error?.message); return }
    if (proje.durum === 'taslak' || proje.durum === 'fiyatlama') {
      await supabase.from('proje').update({ durum: 'proforma_gonderildi' }).eq('id', id)
    }
    router.push(`/proforma/${data.id}`)
  }

  function sonFiyatBul(malzeme_id: string): number {
    return parseFloat(malzemeFiyatlari.find(f => f.malzeme_id === malzeme_id)?.birim_fiyat || '0')
  }

  function laminasyonSayisi(): number {
    return katmanlar.filter(k => k.laminasyon_onceki).length
  }

  function mamulKgM2(): number {
    const baskili = katmanlar.some(k => k.baskili)
    const filmGm2 = katmanlar.reduce((s, k) => s + (k.mikron * (k.malzeme?.yogunluk || 0.92)), 0)
    const boyaGm2 = baskili ? 2.2 : 0
    const tutkalGm2 = laminasyonSayisi() * 2.0
    return (filmGm2 + boyaGm2 + tutkalGm2) / 1000
  }

  // Metre -> kg donusumu (hesaplaFiyat'daki ham_m2/net_m2/metre formulunun tersi).
  // Musteri "1350 metre istiyorum" derse bunu siparis kg'sine cevirip miktarlar listesine ekler.
  function metreyiKgyeCevir(metre: number): number {
    const hamBobinMm = parseFloat(hamBobin)
    const netEnMm = parseFloat(netEn)
    if (!hamBobinMm || !netEnMm || metre <= 0) return 0
    const kenarFirePct = ((hamBobinMm - netEnMm) / hamBobinMm) * 100
    const netM2 = metre * (netEnMm / 1000)
    const hamM2 = netM2 / (1 - kenarFirePct / 100)
    return Math.round(hamM2 * mamulKgM2())
  }

  function miktarEkle() {
    const deger = parseFloat(ozelMiktarDeger)
    if (!deger || deger <= 0) { setMsg('Gecerli bir miktar girin.'); return }
    let kg = deger
    if (ozelMiktarBirim === 'metre') {
      kg = metreyiKgyeCevir(deger)
      if (!kg) { setMsg('Metreyi kg\'a cevirmek icin once ham bobin eni ve net kullanilabilir eni girin.'); return }
    }
    kg = Math.round(kg)
    if (miktarlar.includes(kg)) { setMsg('Bu miktar zaten listede.'); return }
    setMsg('')
    setMiktarlar(m => [...m, kg].sort((a, b) => a - b))
    setOzelMiktarDeger('')
  }

  function miktarSil(kg: number) {
    setMiktarlar(m => m.filter(x => x !== kg))
  }

  function fasonCiktiTuru(): string | null {
    const ct = proje?.cikti_turu
    if (['doypack','quadro','flat_bottom','sirt_kaynak'].includes(ct)) return ct
    return null
  }

  function hesaplaAdetGram(): number {
    if (!proje) return 0
    return adetAgirligiHesapla({
      cikti_turu: proje.cikti_turu,
      en_mm: proje.en_mm || 0,
      boy_mm: proje.boy_mm || 0,
      kurek_mm: proje.kurek_mm || 0,
      mamul_kg_m2: mamulKgM2(),
      zip_var: proje.zip_var || false,
    })
  }

  function hesapla() {
    if (!netEn || !hamBobin) { setMsg('Ham bobin eni ve net kullanilabilir en giriniz.'); return }
    setMsg('')

    const lam = laminasyonSayisi()
    const baskili = katmanlar.some(k => k.baskili)
    const adetGram = hesaplaAdetGram()
    const fasonTur = fasonCiktiTuru()
    const fasonBirimFiyat = fasonTur
      ? fasonFiyatBul(fasonTur, adetGram, fasonFiyatlar)
      : 0

    const katmanGirdileri = katmanlar.map(k => ({
      malzeme_adi: k.malzeme?.ad || '',
      malzeme_tur: k.malzeme?.tur || '',
      mikron: k.mikron,
      yogunluk: k.malzeme?.yogunluk || 0.92,
      birim_fiyat: sonFiyatBul(k.malzeme_id),
      baskili: k.baskili,
    }))

    const sonuclar = miktarlar.map(miktar => {
      const girdi: FiyatGirdisi = {
        katmanlar: katmanGirdileri,
        laminasyon_sayisi: lam,
        siparis_kg: miktar,
        bobin_en_mm: parseFloat(hamBobin),
        kullanilabilir_en_mm: parseFloat(netEn),
        kenar_tirasi_mm: (parseFloat(hamBobin) - parseFloat(netEn)) / 2,
        boya_fiyat_kg: parseFloat(boyaFiyat),
        tutkal_fiyat_kg: parseFloat(tutkalFiyat),
        iscilik_kg: parseFloat(iscilik),
        baslangic_fire_kg: parseFloat(baslangicFire),
        kar_pct: parseFloat(karPct),
        fason_birim_fiyat_kg: fasonBirimFiyat,
      }
      const sonuc = hesaplaFiyat(girdi)
      return { miktar, adet_gram: adetGram, fason_birim_fiyat: fasonBirimFiyat, ...sonuc }
    })
    setHesaplanan(sonuclar)
  }

  async function kaydet() {
    if (hesaplanan.length === 0) return
    setKaydediliyor(true)
    for (const f of hesaplanan) {
      await supabase.from('proje_fiyat').insert({
        proje_id: id,
        miktar_kg: f.miktar,
        film_maliyet: f.film_tutar,
        boya_maliyet: f.boya_tutar,
        tutkal_maliyet: f.tutkal_tutar,
        iscilik_maliyet: f.iscilik_tutar,
        fason_maliyet: f.fason_tutar,
        fire_orani_pct: f.kenar_fire_pct,
        baslangic_fire_kg: parseFloat(baslangicFire),
        toplam_maliyet: f.toplam_maliyet,
        kar_marji_pct: parseFloat(karPct),
        satis_fiyati_kg: f.satis_fiyati_kg,
        satis_fiyati_m2: f.satis_fiyati_m2,
        para_birimi: proje?.musteri?.para_birimi || 'USD',
        gecerlilik_tarihi: new Date().toISOString().split('T')[0],
        tolerans_pct: parseFloat(toleransPct) || 0,
        metre: f.metre,
      })
    }
    // Sadece ilk fiyatlamada durumu ilerlet; zaten proforma gonderilmis/onaylanmis
    // bir siparis icin yeni fiyat secenegi eklemek durumu geriye almamali.
    if (proje.durum === 'taslak') {
      await supabase.from('proje').update({ durum: 'fiyatlama' }).eq('id', id)
    }
    setFiyatModal(false)
    setHesaplanan([])
    load()
    setKaydediliyor(false)
  }

  async function durumGuncelle(yeniDurum: string) {
    await supabase.from('proje').update({ durum: yeniDurum }).eq('id', id)
    load()
  }

  if (loading) return <div className="p-8 text-gray-400">Yukleniyor...</div>
  if (!proje) return <div className="p-8 text-red-500">Proje bulunamadi</div>

  const fasonTur = fasonCiktiTuru()
  const adetGram = hesaplaAdetGram()

  const stokKontrolGoster = STOK_KONTROL_DURUMLARI.includes(proje.durum)
  const stokDurumuListesi = stokKontrolGoster && proje.kato_eni_mm
    ? hesaplaGerekliMiktarlar(proje, katmanlar, teklifler, proformalar).map(g => {
        const maxEn = proje.kato_eni_mm * (1 + EN_TOLERANS_PCT / 100)
        const uygunLotlar = depoStok
          .filter((d: any) => d.malzeme_id === g.malzeme_id && d.mikron === g.mikron && d.en_mm != null && d.en_mm >= proje.kato_eni_mm && d.en_mm <= maxEn)
          .sort((a: any, b: any) => a.en_mm - b.en_mm)
        const toplamStok = uygunLotlar.reduce((s: number, l: any) => s + Number(l.agirlik_kg || 0), 0)
        const eksikKg = Math.max(0, g.gerekli_kg - toplamStok)
        const durum = eksikKg <= 0.5 ? 'yeterli' : toplamStok > 0 ? 'kismi' : 'yok'
        const eslesenTalep = satinalmaKalemleri.find((k: any) => k.malzeme_id === g.malzeme_id && k.mikron === g.mikron && k.siparis?.durum !== 'iptal')
        return { ...g, uygunLotlar, toplamStok, eksikKg, durum, zatenTalepVar: !!eslesenTalep, talepPoNo: eslesenTalep?.siparis?.po_no }
      })
    : []

  return (
    <div className="p-6 max-w-5xl">
      {/* Baslik */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/projeler" className="text-gray-400 hover:text-gray-600 text-xs">← Projeler</Link>
            <span className="text-gray-300">/</span>
            <span className="font-mono text-xs text-blue-600">{proje.proje_no}</span>
          </div>
          <h1 className="page-title">{proje.ad}</h1>
          <p className="text-gray-500 text-xs mt-0.5">{(proje.musteri as any)?.ad} · {proje.cikti_turu}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`badge ${DURUM_BADGE[proje.durum]||'badge-gray'}`}>{DURUM_LABEL[proje.durum]||proje.durum}</span>
          <button onClick={() => setFiyatModal(true)} className="btn btn-primary">Fiyat hesapla</button>
          {proje.durum === 'fiyatlama' && (
            <button onClick={() => durumGuncelle('proforma_gonderildi')} className="btn btn-warning">Proforma gonderildi</button>
          )}
          {proje.durum === 'proforma_gonderildi' && (
            <button onClick={() => durumGuncelle('musteri_onayladi')} className="btn btn-success">Siparis onaylandi, uretime al</button>
          )}
        </div>
      </div>
      {proje.durum === 'proforma_gonderildi' && (
        <div className="text-xs text-gray-400 -mt-3 mb-4">
          Bu butona basildiginda siparis planlamacinin onune "Planlamasi yapilmamis siparisler" listesine dusecek.
        </div>
      )}
      {proje.durum === 'musteri_onayladi' && (
        <div className="text-xs text-green-600 -mt-3 mb-4">
          Siparis uretime alindi — Uretim Planlama sayfasinda "Plani olusturulmamis onayli projeler" listesinde planlamaciyi bekliyor.
        </div>
      )}

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 space-y-4">

          {/* Urun yapisi */}
          <div className="card">
            <div className="card-header"><span className="font-medium text-sm">Urun yapisi</span></div>
            <div className="card-body">
              <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm mb-4">
                {proje.en_mm && <div className="flex justify-between py-1 border-b border-gray-50"><span className="text-gray-500">En</span><span>{proje.en_mm} mm</span></div>}
                {proje.boy_mm && <div className="flex justify-between py-1 border-b border-gray-50"><span className="text-gray-500">Boy</span><span>{proje.boy_mm} mm</span></div>}
                {proje.kurek_mm && <div className="flex justify-between py-1 border-b border-gray-50"><span className="text-gray-500">Kurek</span><span>{proje.kurek_mm} mm</span></div>}
                {proje.kato_eni_mm && <div className="flex justify-between py-1 border-b border-gray-50"><span className="text-gray-500">Kato eni (ana bobin)</span><span className="font-medium text-blue-600">{proje.kato_eni_mm} mm</span></div>}
                {proje.urun_bobin_en_mm && <div className="flex justify-between py-1 border-b border-gray-50"><span className="text-gray-500">Urun (bitmis) bobin eni</span><span className="font-medium text-blue-600">{proje.urun_bobin_en_mm} mm</span></div>}
                {proje.bant_sayisi && <div className="flex justify-between py-1 border-b border-gray-50"><span className="text-gray-500">Bant sayisi</span><span>{proje.bant_sayisi}</span></div>}
                {proje.renk_sayisi && <div className="flex justify-between py-1 border-b border-gray-50"><span className="text-gray-500">Renk</span><span>{proje.renk_sayisi} renk</span></div>}
                {proje.kazan_cap_mm && <div className="flex justify-between py-1 border-b border-gray-50"><span className="text-gray-500">Kazan capi</span><span>{proje.kazan_cap_mm} mm</span></div>}
                {proje.fotosel_cm && <div className="flex justify-between py-1 border-b border-gray-50"><span className="text-gray-500">Fotosel</span><span>{proje.fotosel_cm} cm</span></div>}
              </div>
              <div className="flex gap-2 flex-wrap mb-4">
                {proje.baskili && <span className="badge badge-blue">{proje.baskili_yuz === 'alt' ? 'Alt baski' : 'Ust baski'}</span>}
                {proje.zip_var && <span className="badge badge-purple">Zip</span>}
                {proje.sonic_var && <span className="badge badge-purple">Sonic</span>}
                {proje.mexika_deligi && <span className="badge badge-gray">Meksika deligi</span>}
                {proje.kargo_bandi && <span className="badge badge-gray">Kargo bandi</span>}
                {proje.numune_var && <span className="badge badge-green">Numune var</span>}
              </div>

              {/* Film katmanlari */}
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500">Film katmanlari</div>
                {katmanlar.map(k => (
                  <div key={k.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center flex-shrink-0">{k.sira}</div>
                    <div className="flex-1">
                      <span className="font-medium text-sm">{k.malzeme?.ad}</span>
                      <span className="text-gray-400 text-xs ml-2">{k.mikron} μm · {k.malzeme?.yogunluk} g/cm³</span>
                    </div>
                    <div className="flex gap-1.5">
                      {k.baskili && <span className="badge badge-blue text-xs">Baskili</span>}
                      {k.laminasyon_onceki && <span className="badge text-xs" style={{background:'#ccfbf1',color:'#0f766e'}}>Lamine</span>}
                    </div>
                    <div className="text-xs text-right">
                      {sonFiyatBul(k.malzeme_id) > 0
                        ? <span className="text-green-700 font-medium">${sonFiyatBul(k.malzeme_id).toFixed(4)}/kg</span>
                        : <span className="text-red-500">Fiyat girilmemis!</span>
                      }
                    </div>
                  </div>
                ))}
              </div>

              {/* Fason bilgisi */}
              {fasonTur && adetGram > 0 && (
                <div className="mt-3 bg-amber-50 rounded-lg px-4 py-3 text-xs text-amber-800">
                  <span className="font-medium">Fason kesim:</span> {fasonTur} · 1 adet ≈ {adetGram.toFixed(2)} gram
                  {proje.zip_var && <span className="ml-2">(zip dahil)</span>}
                  {fasonFiyatBul(fasonTur, adetGram, fasonFiyatlar) > 0
                    ? <span className="ml-2 font-medium">${fasonFiyatBul(fasonTur, adetGram, fasonFiyatlar).toFixed(4)}/kg</span>
                    : <span className="ml-2 text-red-600">Fason fiyat bulunamadi!</span>
                  }
                </div>
              )}
            </div>
          </div>

          {/* Stok durumu — siparis onaylandiktan sonra kalici olarak gorunur */}
          {stokKontrolGoster && (
            <div className="card">
              <div className="card-header"><span className="font-medium text-sm">Stok durumu</span></div>
              <div className="card-body space-y-3">
                {stokDurumuListesi.length === 0 ? (
                  <div className="text-gray-400 text-sm text-center py-4">Miktar veya kato eni bilgisi eksik, stok kontrolu yapilamiyor.</div>
                ) : stokDurumuListesi.map((s: any) => (
                  <div key={s.malzeme_id + '-' + s.mikron} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-medium text-sm">{s.malzeme_adi} ({s.mikron}μm)</span>
                      <span className={`badge ${s.durum === 'yeterli' ? 'badge-green' : s.durum === 'kismi' ? 'badge-amber' : 'badge-red'}`}>
                        {s.durum === 'yeterli' ? 'Stok yeterli' : s.durum === 'kismi' ? 'Kismi stok' : 'Stokta yok'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mb-2">
                      Gerekli: {s.gerekli_kg.toFixed(0)} kg (tolerans dahil) · Uygun genislikte stok: {s.toplamStok.toFixed(0)} kg
                    </div>
                    {s.uygunLotlar.length > 0 && (
                      <div className="space-y-1">
                        {s.uygunLotlar.map((l: any) => (
                          <div key={l.id} className="flex items-center justify-between bg-gray-50 rounded px-2.5 py-1.5 text-xs">
                            <span>
                              {l.lot_no} · {l.en_mm} mm · {Number(l.agirlik_kg).toFixed(0)} kg
                              {l.en_mm > proje.kato_eni_mm && <span className="text-amber-600 ml-1">(dilimlenecek)</span>}
                            </span>
                            {baglanmisLotlar.has(l.id) ? (
                              <span className="badge badge-green text-xs">Baglandi ✓</span>
                            ) : (
                              <button onClick={() => lotBagla(l, s)} disabled={rezerveEdiliyor === l.id} className="btn btn-sm">
                                {rezerveEdiliyor === l.id ? '...' : 'Bu ise bagla'}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {s.eksikKg > 0.5 && (
                      <div className="text-xs text-red-600 mt-2">
                        {s.zatenTalepVar
                          ? `Eksik ${s.eksikKg.toFixed(0)} kg icin satin alma talebi mevcut${s.talepPoNo ? ` (${s.talepPoNo})` : ''}.`
                          : `Eksik ${s.eksikKg.toFixed(0)} kg icin otomatik satin alma talebi olusturuldu.`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fiyat teklifleri */}
          <div className="card">
            <div className="card-header">
              <span className="font-medium text-sm">Fiyat teklifleri</span>
              <span className="text-xs text-gray-400">{teklifler.length} kayit</span>
            </div>
            {teklifler.length === 0 ? (
              <div className="card-body text-center text-gray-400 text-sm py-8">
                Henuz fiyat hesaplanmamis
                <div className="mt-3"><button onClick={() => setFiyatModal(true)} className="btn btn-primary btn-sm">Fiyat hesapla</button></div>
              </div>
            ) : (
              <div className="overflow-hidden">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Miktar</th>
                      <th>Metre</th>
                      <th>Satis/kg</th>
                      {proje.cikti_turu !== 'bobin' && <th>Adet agirlik</th>}
                      <th>m² fiyati</th>
                      <th>Kar marji</th>
                      <th>Tarih</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {teklifler.slice(0, 9).map((f, i) => (
                      <tr key={f.id} className={i === 0 ? 'bg-green-50' : ''}>
                        <td className="font-medium">
                          {parseFloat(f.miktar_kg).toLocaleString('tr-TR')} kg
                          {f.tolerans_pct > 0 && <span className="text-gray-400 text-xs ml-1">(±%{f.tolerans_pct})</span>}
                        </td>
                        <td className="text-gray-500 text-xs">{f.metre ? Number(f.metre).toLocaleString('tr-TR') + ' m' : '—'}</td>
                        <td className="font-semibold text-green-700">${parseFloat(f.satis_fiyati_kg || 0).toFixed(4)}</td>
                        {proje.cikti_turu !== 'bobin' && (
                          <td className="text-gray-500 text-xs">{adetGram.toFixed(2)} gr</td>
                        )}
                        <td className="text-gray-600">${parseFloat(f.satis_fiyati_m2 || 0).toFixed(4)}</td>
                        <td>%{f.kar_marji_pct}</td>
                        <td className="text-gray-400 text-xs">{new Date(f.olusturma).toLocaleDateString('tr-TR')}</td>
                        <td>
                          <button onClick={() => proformaOlustur(f)} disabled={proformaOlusturuluyor === f.id} className="btn btn-sm btn-primary">
                            {proformaOlusturuluyor === f.id ? '...' : 'Proforma olustur'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {proformalar.length > 0 && (
            <div className="card">
              <div className="card-header"><span className="font-medium text-sm">Olusturulan proformalar</span></div>
              <div>
                {proformalar.map(pf => (
                  <Link key={pf.id} href={`/proforma/${pf.id}`}
                    className="flex items-center justify-between px-5 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 no-underline">
                    <div>
                      <span className="font-mono text-sm font-medium text-blue-700">{pf.proforma_no}</span>
                      <span className="text-xs text-gray-500 ml-2">
                        {Number(pf.secilen_miktar_kg).toLocaleString('tr-TR')} kg
                        {pf.tolerans_pct > 0 && ` (±%${pf.tolerans_pct})`} · ${Number(pf.toplam_tutar).toFixed(2)}
                      </span>
                    </div>
                    <span className={`badge ${pf.durum === 'onaylandi' ? 'badge-green' : pf.durum === 'reddedildi' ? 'badge-red' : 'badge-amber'}`}>{pf.durum}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sag panel - Durum */}
        <div className="space-y-4">
          <div className="card">
            <div className="card-header"><span className="font-medium text-sm">Durum akisi</span></div>
            <div className="card-body space-y-2">
              {[
                {d:'taslak', l:'Taslak'},
                {d:'fiyatlama', l:'Fiyat hesaplandi'},
                {d:'proforma_gonderildi', l:'Proforma gonderildi'},
                {d:'musteri_onayladi', l:'Musteri onayladi'},
                {d:'tamamlandi', l:'Tamamlandi'},
              ].map((s, i) => {
                const sirali = ['taslak','fiyatlama','proforma_gonderildi','musteri_onayladi','tamamlandi']
                const mevcutIdx = sirali.indexOf(proje.durum)
                const hedefIdx = sirali.indexOf(s.d)
                const gecti = mevcutIdx > hedefIdx
                const aktif = mevcutIdx === hedefIdx
                return (
                  <div key={s.d} className={`flex items-center gap-3 p-2.5 rounded-lg ${aktif ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'}`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium
                      ${gecti ? 'bg-green-500 text-white' : aktif ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
                      {gecti ? '✓' : i+1}
                    </div>
                    <span className={`text-xs ${aktif ? 'font-medium text-blue-800' : gecti ? 'text-green-700' : 'text-gray-400'}`}>{s.l}</span>
                  </div>
                )
              })}
            </div>
          </div>
          {proje.notlar && (
            <div className="card">
              <div className="card-header"><span className="font-medium text-sm">Notlar</span></div>
              <div className="card-body text-sm text-gray-700">{proje.notlar}</div>
            </div>
          )}
        </div>
      </div>

      {/* FİYATLAMA MODALI */}
      {fiyatModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="font-semibold text-gray-900 text-lg">Fiyat hesapla</div>
              <div className="text-sm text-gray-500 mt-0.5">{proje.ad} — {miktarlar.map(m => m.toLocaleString('tr-TR')).join(' / ')} kg</div>
            </div>
            <div className="p-6 space-y-5">

              {/* Miktarlar */}
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Hesaplanacak miktarlar</div>
                <div className="flex gap-2 flex-wrap mb-3">
                  {miktarlar.map(m => (
                    <span key={m} className="badge badge-blue flex items-center gap-1.5 text-xs">
                      {m.toLocaleString('tr-TR')} kg
                      <button onClick={() => miktarSil(m)} className="text-blue-500 hover:text-blue-800 font-bold leading-none">×</button>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" value={ozelMiktarDeger} onChange={e => setOzelMiktarDeger(e.target.value)}
                    placeholder="Musteri siparis miktari" className="text-sm flex-1" />
                  <select value={ozelMiktarBirim} onChange={e => setOzelMiktarBirim(e.target.value as 'kg' | 'metre')} className="text-sm w-28">
                    <option value="kg">kg</option>
                    <option value="metre">metre</option>
                  </select>
                  <button onClick={miktarEkle} className="btn btn-sm">Ekle</button>
                </div>
                <div className="mt-3">
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Tolerans (%)</label>
                  <input type="number" value={toleransPct} onChange={e => setToleransPct(e.target.value)}
                    placeholder="15" className="text-sm w-24" />
                  <span className="text-xs text-gray-400 ml-2">Proformada "miktar (±%tolerans)" olarak gosterilir</span>
                </div>
              </div>

              {/* Bobin bilgileri */}
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Bobin bilgileri</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Ham bobin eni / Kato eni (mm)</label>
                    <input type="number" value={hamBobin} onChange={e => setHamBobin(e.target.value)}
                      placeholder="700" className="text-sm" />
                    {proje.kato_eni_mm && <div className="text-xs text-gray-400 mt-1">Projeden: {proje.kato_eni_mm} mm</div>}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Net kullanilabilir en (mm)</label>
                    <input type="number" value={netEn} onChange={e => setNetEn(e.target.value)} placeholder="680" className="text-sm" />
                    {hamBobin && netEn && (
                      <div className="text-xs text-amber-600 mt-1">
                        Kenar fire: %{(((parseFloat(hamBobin) - parseFloat(netEn)) / parseFloat(hamBobin)) * 100).toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Kazan çapı */}
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Kazan çapı</div>
                <div className="flex items-center gap-3 mb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={otomatikKazan} onChange={e => setOtomatikKazan(e.target.checked)} className="w-auto" />
                    <span className="text-sm text-gray-600">Otomatik hesapla (fotoselden)</span>
                  </label>
                </div>
                {otomatikKazan ? (
                  <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-600">
                    Kazan çapı proje oluşturulurken girilir. Fotosel = π × (çap/10) cm
                  </div>
                ) : (
                  <select value={kazanCap} onChange={e => setKazanCap(e.target.value)} className="text-sm">
                    <option value="">Secin...</option>
                    {KAZAN_CAPLARI.map(c => (
                      <option key={c} value={c}>{c} mm — Fotosel: {fotoselHesapla(c).toFixed(1)} cm</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Fire ve parametreler */}
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Uretim parametreleri</div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Baslangic fire (kg)</label>
                    <input type="number" value={baslangicFire} onChange={e => setBaslangicFire(e.target.value)} placeholder="50" className="text-sm" />
                    <div className="text-xs text-gray-400 mt-1">Makine ayar firesi</div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Boya (USD/kg)</label>
                    <input type="number" step="0.01" value={boyaFiyat} onChange={e => setBoyaFiyat(e.target.value)} className="text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Tutkal (USD/kg)</label>
                    <input type="number" step="0.01" value={tutkalFiyat} onChange={e => setTutkalFiyat(e.target.value)} className="text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Iscilik (USD/kg)</label>
                    <input type="number" step="0.01" value={iscilik} onChange={e => setIscilik(e.target.value)} className="text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Kar marji (%)</label>
                    <input type="number" value={karPct} onChange={e => setKarPct(e.target.value)} className="text-sm" />
                    <div className="text-xs text-gray-400 mt-1">Satis uzerinden</div>
                  </div>
                </div>
              </div>

              {/* Malzeme fiyat özeti */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-xs font-medium text-gray-500 mb-2">Guncel malzeme fiyatlari</div>
                {katmanlar.map(k => (
                  <div key={k.id} className="flex justify-between text-sm py-1 border-b border-gray-100 last:border-0">
                    <span className="text-gray-600">{k.malzeme?.ad} ({k.mikron}μm)</span>
                    {sonFiyatBul(k.malzeme_id) > 0
                      ? <span className="font-medium text-gray-900">${sonFiyatBul(k.malzeme_id).toFixed(4)}/kg</span>
                      : <span className="text-red-500 font-medium">FIYAT YOK!</span>
                    }
                  </div>
                ))}
                {fasonTur && (
                  <div className="flex justify-between text-sm py-1 mt-1 border-t border-gray-200">
                    <span className="text-amber-600">Fason ({fasonTur}) · {adetGram.toFixed(2)}gr/adet</span>
                    <span className="font-medium text-amber-700">${fasonFiyatBul(fasonTur, adetGram, fasonFiyatlar).toFixed(4)}/kg</span>
                  </div>
                )}
              </div>

              {msg && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{msg}</div>}

              <button onClick={hesapla} className="btn btn-primary w-full justify-center">Hesapla</button>

              {/* Sonuçlar */}
              {hesaplanan.length > 0 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Miktar</th>
                        <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Metre</th>
                        <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Net m²</th>
                        <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Kenar fire</th>
                        <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Maliyet/kg</th>
                        <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Satis/kg</th>
                        <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Toplam</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hesaplanan.map(f => (
                        <tr key={f.miktar} className="border-t border-gray-100">
                          <td className="px-4 py-3 font-medium">{f.miktar.toLocaleString('tr-TR')} kg</td>
                          <td className="px-4 py-3 text-gray-600">{f.metre ? Number(f.metre).toLocaleString('tr-TR') + ' m' : '—'}</td>
                          <td className="px-4 py-3 text-gray-600">{f.net_m2.toLocaleString('tr-TR')}</td>
                          <td className="px-4 py-3 text-amber-600">%{f.kenar_fire_pct.toFixed(2)}</td>
                          <td className="px-4 py-3 text-gray-600">${f.maliyet_kg.toFixed(4)}</td>
                          <td className="px-4 py-3 font-semibold text-green-700">${f.satis_fiyati_kg.toFixed(4)}</td>
                          <td className="px-4 py-3 font-semibold">${f.satis_fiyati_toplam.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {hesaplanan[0] && (
                    <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 grid grid-cols-3 gap-4">
                      <div>Baslangic fire: <span className="font-medium text-gray-700">{baslangicFire} kg · ${hesaplanan[0].baslangic_fire_tutar.toFixed(2)}</span></div>
                      <div>Kenar fire: <span className="font-medium text-gray-700">%{hesaplanan[0].kenar_fire_pct.toFixed(2)}</span></div>
                      <div>Laminasyon: <span className="font-medium text-gray-700">{laminasyonSayisi()} adet · 2.0 g/m² x{laminasyonSayisi()}</span></div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button onClick={() => { setFiyatModal(false); setHesaplanan([]); setMsg('') }} className="btn flex-1 justify-center">Iptal</button>
              {hesaplanan.length > 0 && (
                <button onClick={kaydet} disabled={kaydediliyor} className="btn btn-primary flex-1 justify-center">
                  {kaydediliyor ? 'Kaydediliyor...' : 'Fiyatlari kaydet'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
