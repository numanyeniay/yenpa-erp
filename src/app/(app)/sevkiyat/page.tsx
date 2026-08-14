'use client'
import { useEffect, useState } from 'react'
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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [yeniForm, setYeniForm] = useState<any>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: s }, { data: p }] = await Promise.all([
      supabase.from('sevkiyat').select('*, proje:proje(proje_no,ad), musteri:musteri_tanim(ad,adres,sehir)').order('olusturma', { ascending: false }),
      supabase.from('proje').select('*, musteri:musteri_tanim(ad,adres,sehir)').eq('durum', 'tamamlandi').order('olusturma', { ascending: false }),
    ])
    const sevkEdilenProjeIdler = new Set((s || []).map((x: any) => x.proje_id))
    setSevkiyatlar(s || [])
    setHazirProjeler((p || []).filter(x => !sevkEdilenProjeIdler.has(x.id)))
    setLoading(false)
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
          <thead><tr><th>Sevk No</th><th>Proje</th><th>Musteri</th><th>Koli/Kg</th><th>Arac</th><th>Tahmini teslim</th><th>Durum</th><th></th></tr></thead>
          <tbody>
            {sevkiyatlar.map(s => (
              <tr key={s.id}>
                <td className="font-mono font-medium">{s.sevk_no}</td>
                <td>{s.proje?.ad} <span className="text-gray-400 font-mono text-xs">({s.proje?.proje_no})</span></td>
                <td className="text-gray-500">{s.musteri?.ad}</td>
                <td className="text-gray-500">{s.koli_sayisi || '—'} koli / {s.toplam_kg || '—'} kg</td>
                <td className="text-gray-500">{s.arac_plaka || '—'}{s.nakliyeci ? ` (${s.nakliyeci})` : ''}</td>
                <td className="text-gray-400 text-xs">{s.tahmini_teslim ? new Date(s.tahmini_teslim).toLocaleDateString('tr-TR') : '—'}</td>
                <td><span className={`badge ${DURUM_BADGE[s.durum]}`}>{DURUM_LABEL[s.durum]}</span></td>
                <td>
                  {s.durum !== 'teslim_edildi' && s.durum !== 'iade' && (
                    <button onClick={() => durumIlerlet(s)} className="btn btn-sm">Ilerlet →</button>
                  )}
                </td>
              </tr>
            ))}
            {sevkiyatlar.length === 0 && <tr><td colSpan={8} className="text-center text-gray-400 py-8">Henuz sevkiyat yok</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
