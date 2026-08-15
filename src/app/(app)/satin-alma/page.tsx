'use client'
import { Fragment, useEffect, useState } from 'react'
import { supabase, yeniPoNo } from '@/lib/supabase'

const DURUM_BADGE: Record<string, string> = {
  talep: 'badge-amber', taslak: 'badge-gray', onaylandi: 'badge-blue', gonderildi: 'badge-amber',
  kismi_teslim: 'badge-amber', teslim_alindi: 'badge-green', iptal: 'badge-red',
}
const DURUM_LABEL: Record<string, string> = {
  talep: 'Talep (onay bekliyor)', taslak: 'Taslak', onaylandi: 'Onaylandi', gonderildi: 'Gonderildi',
  kismi_teslim: 'Kismi teslim', teslim_alindi: 'Teslim alindi', iptal: 'Iptal',
}

type Kalem = { malzeme_id: string; mikron: string; en_mm: string; miktar_kg: string; birim_fiyat: string }

export default function SatinAlmaPage() {
  const [siparisler, setSiparisler] = useState<any[]>([])
  const [kalemler, setKalemler] = useState<any[]>([])
  const [malzemeler, setMalzemeler] = useState<any[]>([])
  const [tedarikciler, setTedarikciler] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [acikId, setAcikId] = useState<string | null>(null)
  const [teslimForm, setTeslimForm] = useState<{ kalemId: string; miktar: string; lotNo: string; raf: string } | null>(null)

  const [yeniPO, setYeniPO] = useState({ tedarikci_id: '', ihtiyac_tarihi: '', notlar: '', para_birimi: 'USD', talepOlarak: false })
  const [satirlar, setSatirlar] = useState<Kalem[]>([{ malzeme_id: '', mikron: '', en_mm: '', miktar_kg: '', birim_fiyat: '' }])

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: s }, { data: k }, { data: m }, { data: t }] = await Promise.all([
      supabase.from('satinalma_siparis').select('*, tedarikci:tedarikci_tanim(ad)').order('olusturma', { ascending: false }),
      supabase.from('satinalma_kalem').select('*, malzeme:malzeme_tanim(ad,tur)'),
      supabase.from('malzeme_tanim').select('*').eq('aktif', true).order('ad'),
      supabase.from('tedarikci_tanim').select('*').eq('aktif', true).order('ad'),
    ])
    setSiparisler(s || []); setKalemler(k || []); setMalzemeler(m || []); setTedarikciler(t || [])
    setLoading(false)
  }

  function satirEkle() {
    setSatirlar(p => [...p, { malzeme_id: '', mikron: '', en_mm: '', miktar_kg: '', birim_fiyat: '' }])
  }
  function satirSil(i: number) {
    setSatirlar(p => p.filter((_, idx) => idx !== i))
  }
  function satirGuncelle(i: number, key: keyof Kalem, val: string) {
    setSatirlar(p => p.map((s, idx) => idx === i ? { ...s, [key]: val } : s))
  }

  const toplamTutar = satirlar.reduce((t, s) => t + (parseFloat(s.miktar_kg) || 0) * (parseFloat(s.birim_fiyat) || 0), 0)

  async function poOlustur() {
    setSaving(true); setMsg('')
    const gecerliSatirlar = satirlar.filter(s => s.malzeme_id && s.miktar_kg)
    if (!yeniPO.tedarikci_id || gecerliSatirlar.length === 0) {
      setMsg('Tedarikci ve en az 1 kalem zorunlu.'); setSaving(false); return
    }
    const po_no = await yeniPoNo()
    const baslangicDurum = yeniPO.talepOlarak ? 'talep' : 'taslak'
    const { data: po, error } = await supabase.from('satinalma_siparis').insert({
      po_no, tedarikci_id: yeniPO.tedarikci_id, durum: baslangicDurum,
      para_birimi: yeniPO.para_birimi, toplam_tutar: toplamTutar,
      ihtiyac_tarihi: yeniPO.ihtiyac_tarihi || null, notlar: yeniPO.notlar || null,
    }).select().single()
    if (error || !po) { setMsg('Hata: ' + error?.message); setSaving(false); return }

    const kalemInsert = gecerliSatirlar.map(s => ({
      siparis_id: po.id, malzeme_id: s.malzeme_id,
      mikron: parseInt(s.mikron) || null, en_mm: parseInt(s.en_mm) || null,
      miktar_kg: parseFloat(s.miktar_kg), birim_fiyat: parseFloat(s.birim_fiyat) || null,
      para_birimi: yeniPO.para_birimi, durum: 'bekliyor',
    }))
    const { error: e2 } = await supabase.from('satinalma_kalem').insert(kalemInsert)
    if (e2) { setMsg('Hata (kalemler): ' + e2.message); setSaving(false); return }

    setMsg(`${po_no} ${baslangicDurum === 'talep' ? 'talep olarak' : ''} olusturuldu.`); load()
    setYeniPO({ tedarikci_id: '', ihtiyac_tarihi: '', notlar: '', para_birimi: 'USD', talepOlarak: false })
    setSatirlar([{ malzeme_id: '', mikron: '', en_mm: '', miktar_kg: '', birim_fiyat: '' }])
    setSaving(false)
  }

  async function durumGuncelle(id: string, durum: string) {
    await supabase.from('satinalma_siparis').update({ durum }).eq('id', id)
    load()
  }

  const onayBekleyenTalepler = siparisler.filter(s => s.durum === 'talep')

  async function teslimAl(kalem: any) {
    if (!teslimForm) return
    setSaving(true); setMsg('')
    const miktar = parseFloat(teslimForm.miktar)
    const kalanMiktar = kalem.miktar_kg - (kalem.teslim_edilen_kg || 0)
    if (!miktar || miktar <= 0) { setMsg('Miktar girin.'); setSaving(false); return }
    if (miktar > kalanMiktar) { setMsg(`Hata: en fazla ${kalanMiktar.toFixed(1)} kg teslim alinabilir.`); setSaving(false); return }
    if (!teslimForm.lotNo) { setMsg('Lot no zorunlu (depo takibi icin).'); setSaving(false); return }

    // 1) Depoya stok girisi
    const { data: stok, error: e1 } = await supabase.from('depo_stok').insert({
      malzeme_id: kalem.malzeme_id, lot_no: teslimForm.lotNo,
      mikron: kalem.mikron, en_mm: kalem.en_mm, agirlik_kg: miktar,
      birim_fiyat: kalem.birim_fiyat, para_birimi: kalem.para_birimi,
      depo_raf: teslimForm.raf || null,
    }).select().single()
    if (e1 || !stok) { setMsg('Hata (depo): ' + e1?.message); setSaving(false); return }

    await supabase.from('depo_hareket').insert({
      stok_id: stok.id, tur: 'giris', miktar_kg: miktar,
      aciklama: `Satin alma teslimati (${siparisler.find(s => s.id === kalem.siparis_id)?.po_no || ''})`,
    })

    // 2) Kalem teslim_edilen_kg guncelle
    const yeniTeslim = (kalem.teslim_edilen_kg || 0) + miktar
    const kalemDurum = yeniTeslim >= kalem.miktar_kg ? 'tamamlandi' : 'kismi'
    await supabase.from('satinalma_kalem').update({ teslim_edilen_kg: yeniTeslim, durum: kalemDurum }).eq('id', kalem.id)

    // 3) Siparis genel durumu guncelle
    const digerKalemler = kalemler.filter(k => k.siparis_id === kalem.siparis_id && k.id !== kalem.id)
    const hepsiTamam = digerKalemler.every(k => (k.teslim_edilen_kg || 0) >= k.miktar_kg) && kalemDurum === 'tamamlandi'
    await supabase.from('satinalma_siparis').update({ durum: hepsiTamam ? 'teslim_alindi' : 'kismi_teslim' }).eq('id', kalem.siparis_id)

    setMsg('Teslimat kaydedildi, depoya eklendi.'); load()
    setTeslimForm(null)
    setSaving(false)
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Yukleniyor...</div>

  return (
    <div className="p-6">
      <div className="page-header">
        <h1 className="page-title">Satin Alma</h1>
      </div>

      {onayBekleyenTalepler.length > 0 && (
        <div className="card card-body mb-6 bg-amber-50 border-amber-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-800 font-medium text-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
              Onay bekleyen talepler ({onayBekleyenTalepler.length})
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {onayBekleyenTalepler.map(s => (
              <button key={s.id} onClick={() => setAcikId(s.id)} className="badge badge-amber hover:opacity-80">
                {s.po_no} — {s.tedarikci?.ad} (${Number(s.toplam_tutar || 0).toFixed(2)})
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card mb-6">
        <div className="card-header"><span className="font-medium text-sm">Yeni siparis (PO) olustur</span></div>
        <div className="card-body">
          <div className="grid grid-cols-4 gap-3 items-end mb-4">
            <div className="col-span-2">
              <label>Tedarikci</label>
              <select value={yeniPO.tedarikci_id} onChange={e => setYeniPO(p => ({ ...p, tedarikci_id: e.target.value }))}>
                <option value="">Secin...</option>
                {tedarikciler.map(t => <option key={t.id} value={t.id}>{t.ad}</option>)}
              </select>
            </div>
            <div>
              <label>Ihtiyac tarihi</label>
              <input type="date" value={yeniPO.ihtiyac_tarihi} onChange={e => setYeniPO(p => ({ ...p, ihtiyac_tarihi: e.target.value }))} />
            </div>
            <div>
              <label>Para birimi</label>
              <select value={yeniPO.para_birimi} onChange={e => setYeniPO(p => ({ ...p, para_birimi: e.target.value }))}>
                <option value="USD">USD</option><option value="EUR">EUR</option>
              </select>
            </div>
          </div>

          <div className="space-y-2 mb-3">
            {satirlar.map((s, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4">
                  {i === 0 && <label>Malzeme</label>}
                  <select value={s.malzeme_id} onChange={e => satirGuncelle(i, 'malzeme_id', e.target.value)}>
                    <option value="">Secin...</option>
                    {malzemeler.map(m => <option key={m.id} value={m.id}>{m.ad}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  {i === 0 && <label>Mikron</label>}
                  <input type="number" value={s.mikron} onChange={e => satirGuncelle(i, 'mikron', e.target.value)} />
                </div>
                <div className="col-span-2">
                  {i === 0 && <label>En (mm)</label>}
                  <input type="number" value={s.en_mm} onChange={e => satirGuncelle(i, 'en_mm', e.target.value)} />
                </div>
                <div className="col-span-2">
                  {i === 0 && <label>Miktar (kg)</label>}
                  <input type="number" step="0.001" value={s.miktar_kg} onChange={e => satirGuncelle(i, 'miktar_kg', e.target.value)} />
                </div>
                <div className="col-span-1">
                  {i === 0 && <label>$/kg</label>}
                  <input type="number" step="0.0001" value={s.birim_fiyat} onChange={e => satirGuncelle(i, 'birim_fiyat', e.target.value)} />
                </div>
                <div className="col-span-1">
                  {satirlar.length > 1 && <button onClick={() => satirSil(i)} className="btn btn-sm btn-danger w-full justify-center">×</button>}
                </div>
              </div>
            ))}
          </div>
          <button onClick={satirEkle} className="btn btn-sm">+ Satir ekle</button>

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <div className="text-sm text-gray-600">Toplam: <span className="font-semibold text-gray-900">${toplamTutar.toFixed(2)}</span></div>
          </div>
          <div className="mt-3">
            <label>Notlar</label>
            <input value={yeniPO.notlar} onChange={e => setYeniPO(p => ({ ...p, notlar: e.target.value }))} />
          </div>
          <label className="flex items-center gap-2 mt-3 !mb-0 cursor-pointer">
            <input type="checkbox" checked={yeniPO.talepOlarak} onChange={e => setYeniPO(p => ({ ...p, talepOlarak: e.target.checked }))} />
            <span className="text-sm text-gray-600">Onaya gonder (talep olarak olustur — dogrudan siparise gecmeden once onay bekler)</span>
          </label>
          {msg && <p className={`text-sm mt-2 ${msg.startsWith('Hata') ? 'text-red-600' : 'text-green-600'}`}>{msg}</p>}
          <button onClick={poOlustur} disabled={saving} className="btn btn-primary mt-3">{yeniPO.talepOlarak ? 'Talep olustur' : 'Siparis olustur'}</button>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="table-base">
          <thead><tr><th>PO No</th><th>Tedarikci</th><th>Tutar</th><th>Ihtiyac tarihi</th><th>Durum</th><th></th></tr></thead>
          <tbody>
            {siparisler.map(s => (
              <Fragment key={s.id}>
                <tr className="cursor-pointer" onClick={() => setAcikId(acikId === s.id ? null : s.id)}>
                  <td className="font-mono font-medium">{s.po_no}</td>
                  <td>{s.tedarikci?.ad}</td>
                  <td className="font-semibold">${Number(s.toplam_tutar || 0).toFixed(2)}</td>
                  <td className="text-gray-500 text-xs">{s.ihtiyac_tarihi ? new Date(s.ihtiyac_tarihi).toLocaleDateString('tr-TR') : '—'}</td>
                  <td><span className={`badge ${DURUM_BADGE[s.durum]}`}>{DURUM_LABEL[s.durum]}</span></td>
                  <td className="text-gray-400 text-xs">{acikId === s.id ? '▲' : '▼'}</td>
                </tr>
                {acikId === s.id && (
                  <tr key={s.id + '-detay'}>
                    <td colSpan={6} className="bg-gray-50 !py-4">
                      <div className="flex gap-2 mb-3">
                        {s.durum === 'talep' && <button onClick={() => durumGuncelle(s.id, 'taslak')} className="btn btn-sm btn-success">Talebi onayla</button>}
                        {s.durum === 'talep' && <button onClick={() => durumGuncelle(s.id, 'iptal')} className="btn btn-sm btn-danger">Talebi reddet</button>}
                        {s.durum === 'taslak' && <button onClick={() => durumGuncelle(s.id, 'onaylandi')} className="btn btn-sm btn-primary">Onayla</button>}
                        {s.durum === 'onaylandi' && <button onClick={() => durumGuncelle(s.id, 'gonderildi')} className="btn btn-sm btn-primary">Tedarikciye gonder</button>}
                        {['taslak', 'onaylandi', 'gonderildi'].includes(s.durum) && <button onClick={() => durumGuncelle(s.id, 'iptal')} className="btn btn-sm btn-danger">Iptal et</button>}
                      </div>
                      <table className="table-base bg-white rounded-lg overflow-hidden">
                        <thead><tr><th>Malzeme</th><th>Mikron/En</th><th>Miktar</th><th>Teslim edilen</th><th>Durum</th><th></th></tr></thead>
                        <tbody>
                          {kalemler.filter(k => k.siparis_id === s.id).map(k => (
                            <tr key={k.id}>
                              <td>{k.malzeme?.ad}</td>
                              <td className="text-gray-500">{k.mikron || '—'} mic / {k.en_mm || '—'} mm</td>
                              <td>{Number(k.miktar_kg).toFixed(1)} kg</td>
                              <td>{Number(k.teslim_edilen_kg || 0).toFixed(1)} kg</td>
                              <td><span className={`badge ${k.durum === 'tamamlandi' ? 'badge-green' : k.durum === 'kismi' ? 'badge-amber' : 'badge-gray'}`}>{k.durum}</span></td>
                              <td>
                                {k.durum !== 'tamamlandi' && ['onaylandi', 'gonderildi', 'kismi_teslim'].includes(s.durum) && (
                                  teslimForm?.kalemId === k.id ? (
                                    <div className="flex gap-1 items-center">
                                      <input className="!w-20" placeholder="kg" type="number" value={teslimForm.miktar} onChange={e => setTeslimForm(p => p && { ...p, miktar: e.target.value })} />
                                      <input className="!w-24" placeholder="Lot no" value={teslimForm.lotNo} onChange={e => setTeslimForm(p => p && { ...p, lotNo: e.target.value })} />
                                      <input className="!w-16" placeholder="Raf" value={teslimForm.raf} onChange={e => setTeslimForm(p => p && { ...p, raf: e.target.value })} />
                                      <button onClick={() => teslimAl(k)} disabled={saving} className="btn btn-sm btn-primary">Kaydet</button>
                                      <button onClick={() => setTeslimForm(null)} className="btn btn-sm">×</button>
                                    </div>
                                  ) : (
                                    <button onClick={() => setTeslimForm({ kalemId: k.id, miktar: '', lotNo: '', raf: '' })} className="btn btn-sm btn-success">Teslim al</button>
                                  )
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {siparisler.length === 0 && <tr><td colSpan={6} className="text-center text-gray-400 py-8">Henuz siparis yok</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
