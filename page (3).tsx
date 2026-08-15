'use client'
import { Fragment, useEffect, useState } from 'react'
import { supabase, yeniSevkNo } from '@/lib/supabase'

const DURUM_SIRA = ['hazirlaniyor', 'yuklendi', 'yolda', 'teslim_edildi']
const DURUM_LABEL: Record<string, string> = {
  hazirlaniyor: 'Hazirlaniyor', yuklendi: 'Yuklendi', yolda: 'Yolda',
  teslim_edildi: 'Teslim edildi', iade: 'Iade',
}
const DURUM_BADGE: Record<string, string> = {
  hazirlaniyor: 'badge-gray', yuklendi: 'badge-blue', yolda: 'badge-amber',
  teslim_edildi: 'badge-green', iade: 'badge-red',
}

export default function SevkiyatPage() {
  const [sevkiyatlar, setSevkiyatlar] = useState<any[]>([])
  const [hazirProjeler, setHazirProjeler] = useState<any[]>([])
  const [kolilar, setKolilar] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [yeniForm, setYeniForm] = useState<any>(null)
  const [acikId, setAcikId] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: s }, { data: p }, { data: k }] = await Promise.all([
      supabase.from('sevkiyat').select('*, proje:proje(proje_no,ad), musteri:musteri_tanim(ad,adres,sehir)').order('olusturma', { ascending: false }),
      supabase.from('proje').select('*, musteri:musteri_tanim(ad,adres,sehir)').eq('durum', 'tamamlandi').order('olusturma', { ascending: false }),
      supabase.from('sevkiyat_koli').select('*').order('koli_no'),
    ])
    const sevkEdilenProjeIdler = new Set((s || []).map((x: any) => x.proje_id))
    setSevkiyatlar(s || [])
    setHazirProjeler((p || []).filter(x => !sevkEdilenProjeIdler.has(x.id)))
    setKolilar(k || [])
    setLoading(false)
  }

  async function koliListesiOlustur(sevk: any) {
    setSaving(true); setMsg('')
    const adet = sevk.koli_sayisi || 1
    const toplamKg = sevk.toplam_kg || 0
    const mevcut = kolilar.filter(k => k.sevkiyat_id === sevk.id).length
    const rows = []
    for (let i = mevcut + 1; i <= adet; i++) {
      rows.push({
        sevkiyat_id: sevk.id, koli_no: i,
        agirlik_kg: toplamKg ? Math.round((toplamKg / adet) * 100) / 100 : null,
        icerik: sevk.proje?.ad || null,
      })
    }
    if (rows.length === 0) { setMsg('Koli sayisi kadar satir zaten mevcut.'); setSaving(false); return }
    const { error } = await supabase.from('sevkiyat_koli').insert(rows)
    if (error) { setMsg('Hata: ' + error.message); setSaving(false); return }
    setMsg(`${rows.length} koli satiri olusturuldu.`); load()
    setSaving(false)
  }

  async function koliGuncelle(id: string, patch: any) {
    await supabase.from('sevkiyat_koli').update(patch).eq('id', id)
    load()
  }

  async function koliSil(id: string) {
    await supabase.from('sevkiyat_koli').delete().eq('id', id)
    load()
  }

  async function sevkiyatOlustur() {
    if (!yeniForm) return
    setSaving(true); setMsg('')
    const sevk_no = await yeniSevkNo()
    const { error } = await supabase.from('sevkiyat').insert({
      sevk_no, proje_id: yeniForm.proje.id, musteri_id: yeniForm.proje.musteri_id,
      koli_sayisi: parseInt(yeniForm.koli_sayisi) || null,
      toplam_kg: parseFloat(yeniForm.toplam_kg) || null,
      toplam_m2: parseFloat(yeniForm.toplam_m2) || null,
      arac_plaka: yeniForm.arac_plaka || null,
      nakliyeci: yeniForm.nakliyeci || null,
      teslimat_adresi: yeniForm.teslimat_adresi || null,
      tahmini_teslim: yeniForm.tahmini_teslim || null,
      durum: 'hazirlaniyor',
    })
    if (error) { setMsg('Hata: ' + error.message); setSaving(false); return }
    setMsg(`${sevk_no} olusturuldu.`); load()
    setYeniForm(null)
    setSaving(false)
  }

  async function durumIlerlet(sevk: any) {
    const idx = DURUM_SIRA.indexOf(sevk.durum)
    if (idx < 0 || idx >= DURUM_SIRA.length - 1) return
    const yeni = DURUM_SIRA[idx + 1]
    const patch: any = { durum: yeni }
    if (yeni === 'teslim_edildi') patch.gercek_teslim = new Date().toISOString().split('T')[0]
    await supabase.from('sevkiyat').update(patch).eq('id', sevk.id)
    load()
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Yukleniyor...</div>

  return (
    <div className="p-6">
      <div className="page-header">
        <h1 className="page-title">Sevkiyat</h1>
      </div>

      {hazirProjeler.length > 0 && (
        <div className="card mb-6">
          <div className="card-header"><span className="font-medium text-sm">Sevkiyati baslatilmamis tamamlanan projeler ({hazirProjeler.length})</span></div>
          <div className="card-body space-y-2">
            {hazirProjeler.map(p => (
              <div key={p.id}>
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-blue-50 border border-blue-100">
                  <div>
                    <span className="font-medium text-sm">{p.ad}</span>
                    <span className="text-xs text-gray-500 ml-2">{p.musteri?.ad} · <span className="font-mono">{p.proje_no}</span></span>
                  </div>
                  {yeniForm?.proje.id !== p.id && (
                    <button onClick={() => setYeniForm({ proje: p, koli_sayisi: '', toplam_kg: '', toplam_m2: '', arac_plaka: '', nakliyeci: '', teslimat_adresi: `${p.musteri?.adres || ''} ${p.musteri?.sehir || ''}`.trim(), tahmini_teslim: '' })}
                      className="btn btn-sm btn-primary">Sevkiyat olustur</button>
                  )}
                </div>
                {yeniForm?.proje.id === p.id && (
                  <div className="mt-2 p-4 bg-gray-50 rounded-lg space-y-3">
                    <div className="grid grid-cols-4 gap-3">
                      <div><label>Koli sayisi</label><input type="number" value={yeniForm.koli_sayisi} onChange={e => setYeniForm((f: any) => ({ ...f, koli_sayisi: e.target.value }))} /></div>
                      <div><label>Toplam kg</label><input type="number" value={yeniForm.toplam_kg} onChange={e => setYeniForm((f: any) => ({ ...f, toplam_kg: e.target.value }))} /></div>
                      <div><label>Toplam m2</label><input type="number" value={yeniForm.toplam_m2} onChange={e => setYeniForm((f: any) => ({ ...f, toplam_m2: e.target.value }))} /></div>
                      <div><label>Tahmini teslim</label><input type="date" value={yeniForm.tahmini_teslim} onChange={e => setYeniForm((f: any) => ({ ...f, tahmini_teslim: e.target.value }))} /></div>
                      <div><label>Arac plaka</label><input value={yeniForm.arac_plaka} onChange={e => setYeniForm((f: any) => ({ ...f, arac_plaka: e.target.value }))} /></div>
                      <div className="col-span-2"><label>Nakliyeci</label><input value={yeniForm.nakliyeci} onChange={e => setYeniForm((f: any) => ({ ...f, nakliyeci: e.target.value }))} /></div>
                    </div>
                    <div><label>Teslimat adresi</label><input value={yeniForm.teslimat_adresi} onChange={e => setYeniForm((f: any) => ({ ...f, teslimat_adresi: e.target.value }))} /></div>
                    {msg && <p className={`text-sm ${msg.startsWith('Hata') ? 'text-red-600' : 'text-green-600'}`}>{msg}</p>}
                    <div className="flex gap-2">
                      <button onClick={sevkiyatOlustur} disabled={saving} className="btn btn-primary btn-sm">Kaydet</button>
                      <button onClick={() => setYeniForm(null)} className="btn btn-sm">Iptal</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <table className="table-base">
          <thead><tr><th>Sevk No</th><th>Proje</th><th>Musteri</th><th>Koli/Kg</th><th>Arac</th><th>Tahmini teslim</th><th>Durum</th><th></th><th></th></tr></thead>
          <tbody>
            {sevkiyatlar.map(s => {
              const sevkKolileri = kolilar.filter(k => k.sevkiyat_id === s.id)
              return (
              <Fragment key={s.id}>
                <tr className="cursor-pointer" onClick={() => setAcikId(acikId === s.id ? null : s.id)}>
                  <td className="font-mono font-medium">{s.sevk_no}</td>
                  <td>{s.proje?.ad} <span className="text-gray-400 font-mono text-xs">({s.proje?.proje_no})</span></td>
                  <td className="text-gray-500">{s.musteri?.ad}</td>
                  <td className="text-gray-500">{s.koli_sayisi || '—'} koli / {s.toplam_kg || '—'} kg{sevkKolileri.length > 0 ? ` · ${sevkKolileri.length} liste satiri` : ''}</td>
                  <td className="text-gray-500">{s.arac_plaka || '—'}{s.nakliyeci ? ` (${s.nakliyeci})` : ''}</td>
                  <td className="text-gray-400 text-xs">{s.tahmini_teslim ? new Date(s.tahmini_teslim).toLocaleDateString('tr-TR') : '—'}</td>
                  <td><span className={`badge ${DURUM_BADGE[s.durum]}`}>{DURUM_LABEL[s.durum]}</span></td>
                  <td onClick={e => e.stopPropagation()}>
                    {s.durum !== 'teslim_edildi' && s.durum !== 'iade' && (
                      <button onClick={() => durumIlerlet(s)} className="btn btn-sm">Ilerlet →</button>
                    )}
                  </td>
                  <td className="text-gray-400 text-xs">{acikId === s.id ? '▲' : '▼'}</td>
                </tr>
                {acikId === s.id && (
                  <tr>
                    <td colSpan={9} className="bg-gray-50 !py-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium text-sm">Koli / palet listesi</span>
                        <button onClick={() => koliListesiOlustur(s)} disabled={saving} className="btn btn-sm btn-primary">
                          Koli sayisina gore otomatik olustur
                        </button>
                      </div>
                      {msg && <p className={`text-sm mb-2 ${msg.startsWith('Hata') ? 'text-red-600' : 'text-green-600'}`}>{msg}</p>}
                      <table className="table-base bg-white rounded-lg overflow-hidden">
                        <thead><tr><th>Koli no</th><th>Icerik</th><th>Agirlik (kg)</th><th></th></tr></thead>
                        <tbody>
                          {sevkKolileri.map(k => (
                            <tr key={k.id}>
                              <td className="font-mono">{k.koli_no}</td>
                              <td><input className="!py-1 !text-xs" value={k.icerik || ''} onChange={e => koliGuncelle(k.id, { icerik: e.target.value })} /></td>
                              <td><input type="number" step="0.01" className="!w-24 !py-1 !text-xs" value={k.agirlik_kg ?? ''} onChange={e => koliGuncelle(k.id, { agirlik_kg: parseFloat(e.target.value) || null })} /></td>
                              <td><button onClick={() => koliSil(k.id)} className="btn btn-sm btn-danger">×</button></td>
                            </tr>
                          ))}
                          {sevkKolileri.length === 0 && <tr><td colSpan={4} className="text-center text-gray-400 py-4 text-xs">Henuz koli satiri yok — yukaridaki butonla otomatik olusturun</td></tr>}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
              )
            })}
            {sevkiyatlar.length === 0 && <tr><td colSpan={9} className="text-center text-gray-400 py-8">Henuz sevkiyat yok</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
