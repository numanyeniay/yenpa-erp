'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ADIM_LABEL, KALITE_ALANLARI, sonrakiAdimiAc } from '@/lib/uretimAkis'

// Bir uretim adimi bitirilirken kullanilan, bobin bazinda giris formu.
// Tablet Paneli ve Uretim Takibi sayfalarinda ortak kullanilir.
//
// Her fiziksel cikti (cok bantli makinede 1,2,3,4 gibi) ayri bir satir olarak
// girilir — ayni adima ait satirlar birbirinin "kardesi" sayilir. Her satirda
// ayrica bu cikti hangi girdiden (onceki bir uretim ciktisi ya da depodaki bir
// hammadde lotu) uretildigi de secilebilir ya da elle yazilabilir (listede
// yoksa serbest metin olarak saklanir) — boylece ileride geriye donuk izlenebilir.

type GirdiSecenek = { display: string; girdi_bobin_id?: string; girdi_stok_id?: string }
type BobinSatiri = { bobin_no: number; kg: string; metre: string; girdi: string; kalite: string }

interface Props {
  projeId: string
  planId: string
  adimId: string
  adimSira: number
  adimTur: string
  baslangic: string
  onTamamla: () => void
  onIptal: () => void
}

export default function BobinGirisFormu({ projeId, planId, adimId, adimSira, adimTur, baslangic, onTamamla, onIptal }: Props) {
  const [bobinlar, setBobinlar] = useState<BobinSatiri[]>([{ bobin_no: 1, kg: '', metre: '', girdi: '', kalite: '' }])
  const [durusDk, setDurusDk] = useState('0')
  const [notlar, setNotlar] = useState('')
  const [secenekler, setSecenekler] = useState<GirdiSecenek[]>([])
  const [saving, setSaving] = useState(false)
  const [hata, setHata] = useState('')

  const kaliteAlan = KALITE_ALANLARI[adimTur] || null
  const datalistId = `girdi-secenekleri-${adimId}`

  useEffect(() => { loadSecenekler() }, [projeId])

  async function loadSecenekler() {
    // Bu isin daha once uretilmis ciktilari (onceki adimlarin bobinleri) — soy agaci girdisi olarak.
    const { data: adimlar } = await supabase.from('uretim_adim').select('id, plan:uretim_plani(adim_tur)').eq('proje_id', projeId)
    const adimIdler = (adimlar || []).map((a: any) => a.id).filter((id: string) => id !== adimId)
    const adimTurMap: Record<string, string> = Object.fromEntries((adimlar || []).map((a: any) => [a.id, a.plan?.adim_tur]))

    const [{ data: oncekiler }, { data: katmanlar }] = await Promise.all([
      adimIdler.length > 0
        ? supabase.from('uretim_cikti_bobin').select('*').in('adim_id', adimIdler).order('olusturma', { ascending: false }).limit(50)
        : Promise.resolve({ data: [] as any[] }),
      supabase.from('proje_katman').select('malzeme_id, malzeme:malzeme_tanim(ad)').eq('proje_id', projeId),
    ])

    const malzemeIdler = Array.from(new Set((katmanlar || []).map((k: any) => k.malzeme_id)))
    const { data: lotlar } = malzemeIdler.length > 0
      ? await supabase.from('depo_stok').select('*, malzeme:malzeme_tanim(ad)').in('malzeme_id', malzemeIdler).gt('agirlik_kg', 0).order('en_mm')
      : { data: [] as any[] }

    const secenekListesi: GirdiSecenek[] = [
      ...(oncekiler || []).map((o: any) => ({
        display: `${ADIM_LABEL[adimTurMap[o.adim_id]] || 'Adim'} · Bobin ${o.bobin_no} · ${o.uretilen_kg ?? '?'} kg`,
        girdi_bobin_id: o.id,
      })),
      ...(lotlar || []).map((l: any) => ({
        display: `${l.malzeme?.ad || 'Malzeme'} ${l.mikron ? l.mikron + 'μm' : ''} · Lot ${l.lot_no || '-'} · ${l.en_mm || '?'}mm · ${l.agirlik_kg} kg`,
        girdi_stok_id: l.id,
      })),
    ]
    setSecenekler(secenekListesi)
  }

  function satirGuncelle(i: number, alan: keyof BobinSatiri, deger: string) {
    setBobinlar(prev => prev.map((b, idx) => idx === i ? { ...b, [alan]: deger } : b))
  }

  function bobinEkle() {
    setBobinlar(prev => [...prev, { bobin_no: prev.length + 1, kg: '', metre: '', girdi: '', kalite: '' }])
  }

  function bobinSil(i: number) {
    setBobinlar(prev => prev.filter((_, idx) => idx !== i).map((b, idx) => ({ ...b, bobin_no: idx + 1 })))
  }

  async function tamamla() {
    setHata('')
    const gecerliBobinlar = bobinlar.filter(b => b.kg || b.metre)
    if (gecerliBobinlar.length === 0) { setHata('En az bir bobin icin kg veya metre girilmeli.'); return }

    setSaving(true)
    const bitis = new Date()
    const baslangicD = new Date(baslangic)
    const sureDk = Math.max(1, Math.round((bitis.getTime() - baslangicD.getTime()) / 60000))
    const toplamKg = gecerliBobinlar.reduce((s, b) => s + (parseFloat(b.kg) || 0), 0)
    const toplamMetre = gecerliBobinlar.reduce((s, b) => s + (parseFloat(b.metre) || 0), 0)

    const { error: e1 } = await supabase.from('uretim_adim').update({
      bitis: bitis.toISOString(), sure_dk: sureDk,
      uretilen_kg: toplamKg || null, uretilen_metre: toplamMetre || null,
      hiz_m_dk: sureDk > 0 && toplamMetre > 0 ? toplamMetre / sureDk : null,
      durus_dk: parseInt(durusDk) || 0, notlar: notlar || null,
    }).eq('id', adimId)
    if (e1) { setHata('Hata: ' + e1.message); setSaving(false); return }

    const kayitlar = gecerliBobinlar.map(b => {
      const secim = secenekler.find(s => s.display === b.girdi)
      const kalite = kaliteAlan && b.kalite ? { [kaliteAlan.key]: parseFloat(b.kalite) } : null
      return {
        adim_id: adimId, bobin_no: b.bobin_no,
        uretilen_kg: parseFloat(b.kg) || null, uretilen_metre: parseFloat(b.metre) || null,
        girdi_bobin_id: secim?.girdi_bobin_id || null,
        girdi_stok_id: secim?.girdi_stok_id || null,
        girdi_lot_no: !secim && b.girdi ? b.girdi : null,
        kalite_verisi: kalite,
      }
    })
    const { error: e2 } = await supabase.from('uretim_cikti_bobin').insert(kayitlar)
    if (e2) { setHata('Hata (bobin kaydi): ' + e2.message); setSaving(false); return }

    await supabase.from('uretim_plani').update({ durum: 'tamamlandi' }).eq('id', planId)
    await sonrakiAdimiAc(projeId, adimSira)
    setSaving(false)
    onTamamla()
  }

  return (
    <div className="space-y-3">
      <datalist id={datalistId}>
        {secenekler.map((s, i) => <option key={i} value={s.display} />)}
      </datalist>

      {hata && <p className="text-sm text-red-600">{hata}</p>}

      <div className="space-y-2">
        {bobinlar.map((b, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-end bg-gray-50 rounded-lg p-2">
            <div className="col-span-1 text-center text-sm text-gray-500 font-medium">#{b.bobin_no}</div>
            <div className="col-span-2">
              <label className="!text-xs">Metre</label>
              <input type="number" value={b.metre} onChange={e => satirGuncelle(i, 'metre', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="!text-xs">Kg</label>
              <input type="number" value={b.kg} onChange={e => satirGuncelle(i, 'kg', e.target.value)} />
            </div>
            <div className={kaliteAlan ? 'col-span-4' : 'col-span-6'}>
              <label className="!text-xs">Girdi (bobin/lot)</label>
              <input list={datalistId} value={b.girdi} onChange={e => satirGuncelle(i, 'girdi', e.target.value)}
                placeholder="Sec veya yaz..." />
            </div>
            {kaliteAlan && (
              <div className="col-span-2">
                <label className="!text-xs">{kaliteAlan.label} ({kaliteAlan.birim})</label>
                <input type="number" value={b.kalite} onChange={e => satirGuncelle(i, 'kalite', e.target.value)} />
              </div>
            )}
            <div className="col-span-1 text-right">
              {bobinlar.length > 1 && (
                <button type="button" onClick={() => bobinSil(i)} className="text-gray-400 hover:text-red-600 text-sm px-2">✕</button>
              )}
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={bobinEkle} className="btn btn-sm">+ Bobin ekle</button>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="!text-xs">Durus (dk, varsa)</label>
          <input type="number" value={durusDk} onChange={e => setDurusDk(e.target.value)} />
        </div>
        <div>
          <label className="!text-xs">Not (opsiyonel)</label>
          <input value={notlar} onChange={e => setNotlar(e.target.value)} placeholder="Ornek: renk sapmasi oldu..." />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onIptal} className="btn flex-1 justify-center">Geri</button>
        <button type="button" onClick={tamamla} disabled={saving} className="btn btn-primary flex-1 justify-center disabled:opacity-50">
          {saving ? '...' : 'Tamamla'}
        </button>
      </div>
    </div>
  )
}
