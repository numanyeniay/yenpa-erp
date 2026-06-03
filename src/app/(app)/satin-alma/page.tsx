'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function SatinAlmaPage() {
  const [talepler, setTalepler] = useState<any[]>([])
  const [stok, setStok] = useState<any[]>([])
  const [malzemeler, setMalzemeler] = useState<any[]>([])
  const [tedarikciler, setTedarikciler] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'talepler'|'stok-kontrol'|'yeni'>('talepler')
  const [form, setForm] = useState({ malzeme_id:'', tedarikci_id:'', miktar_kg:'', birim_fiyat_usd:'', ihtiyac_tarihi:'' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: t }, { data: s }, { data: m }, { data: ted }] = await Promise.all([
      supabase.from('satin_alma_talebi').select('*, malzeme(ad,kod), tedarikci(ad)').order('olusturma', { ascending: false }),
      supabase.from('stok').select('*, malzeme(ad,kod,min_stok_kg)'),
      supabase.from('malzeme').select('*').order('kod'),
      supabase.from('tedarikci').select('*').eq('aktif',true),
    ])
    setTalepler(t||[]); setStok(s||[]); setMalzemeler(m||[]); setTedarikciler(ted||[])
    setLoading(false)
  }

  async function handleYeni(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setMsg('')
    const poNo = `PO-${new Date().getFullYear()}-${String(talepler.length+1).padStart(4,'0')}`
    const { error } = await supabase.from('satin_alma_talebi').insert({
      malzeme_id: form.malzeme_id, tedarikci_id: form.tedarikci_id||null,
      po_no: poNo, miktar_kg: parseFloat(form.miktar_kg)||0,
      birim_fiyat_usd: parseFloat(form.birim_fiyat_usd)||null,
      ihtiyac_tarihi: form.ihtiyac_tarihi||null, durum:'taslak',
    })
    if (!error) { setMsg('✓ Talep oluşturuldu: '+poNo); load(); setTab('talepler') }
    else setMsg('Hata: '+error.message)
    setSaving(false)
  }

  async function durumGuncelle(id: string, durum: string) {
    await supabase.from('satin_alma_talebi').update({ durum }).eq('id', id)
    load()
  }

  const kritikStok = stok.filter(s => s.mevcut_kg < (s.malzeme?.min_stok_kg||0))
  const durumBadge: Record<string,string> = {
    taslak:'badge-gray', onaylandi:'badge-amber',
    gonderildi:'badge-blue', teslim_alindi:'badge-green'
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Yükleniyor...</div>

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Satın alma</h1>
        <div className="flex gap-2">
          <button onClick={()=>setTab('talepler')} className={`btn ${tab==='talepler'?'btn-primary':''}`}>📋 Talepler</button>
          <button onClick={()=>setTab('stok-kontrol')} className={`btn ${tab==='stok-kontrol'?'btn-primary':''}`}>
            📦 Stok kontrol {kritikStok.length > 0 && <span className="badge badge-red ml-1">{kritikStok.length}</span>}
          </button>
          <button onClick={()=>setTab('yeni')} className={`btn ${tab==='yeni'?'btn-primary':''}`}>+ Yeni talep</button>
        </div>
      </div>

      {tab === 'talepler' && (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{['PO No','Malzeme','Tedarikçi','Miktar','Birim fiyat','İhtiyaç tarihi','Durum','İşlem'].map(h=>(
                <th key={h} className="text-left text-xs text-gray-500 font-medium px-4 py-3">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {talepler.map(t=>(
                <tr key={t.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{t.po_no}</td>
                  <td className="px-4 py-3">{t.malzeme?.ad||'—'}</td>
                  <td className="px-4 py-3 text-gray-600">{t.tedarikci?.ad||'—'}</td>
                  <td className="px-4 py-3">{t.miktar_kg} kg</td>
                  <td className="px-4 py-3">{t.birim_fiyat_usd ? '$'+t.birim_fiyat_usd : '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{t.ihtiyac_tarihi ? new Date(t.ihtiyac_tarihi).toLocaleDateString('tr-TR') : '—'}</td>
                  <td className="px-4 py-3"><span className={`badge ${durumBadge[t.durum]||'badge-gray'}`}>{t.durum}</span></td>
                  <td className="px-4 py-3">
                    <select className="text-xs py-1 px-2 border border-gray-200 rounded"
                      value={t.durum} onChange={e=>durumGuncelle(t.id,e.target.value)}>
                      {['taslak','onaylandi','gonderildi','teslim_alindi'].map(d=>(
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {talepler.length===0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">Henüz satın alma talebi yok</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'stok-kontrol' && (
        <div className="space-y-3">
          {kritikStok.length === 0
            ? <div className="card text-center text-green-600 bg-green-50">✓ Tüm malzemeler minimum stok seviyesinin üzerinde</div>
            : kritikStok.map(s => {
              const pct = Math.round(s.mevcut_kg/(s.malzeme?.min_stok_kg||1)*100)
              const eksik = Math.max(0, (s.malzeme?.min_stok_kg||0)*2 - s.mevcut_kg)
              return (
                <div key={s.id} className="card border-l-4 border-red-400">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-medium text-gray-900">{s.malzeme?.ad}</div>
                      <div className="text-sm text-red-600 mt-0.5">
                        Mevcut: {s.mevcut_kg} kg · Min: {s.malzeme?.min_stok_kg} kg · <strong>Eksik: {eksik} kg</strong>
                      </div>
                    </div>
                    <span className="badge badge-red">%{pct}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full mb-3">
                    <div className="h-full bg-red-400 rounded-full" style={{width:`${Math.min(100,pct)}%`}} />
                  </div>
                  <button className="btn btn-primary text-xs py-1.5"
                    onClick={async()=>{
                      const poNo = `PO-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`
                      await supabase.from('satin_alma_talebi').insert({ malzeme_id:s.malzeme_id, po_no:poNo, miktar_kg:eksik, durum:'taslak' })
                      load(); setTab('talepler')
                    }}>
                    📋 Otomatik PO oluştur ({eksik} kg)
                  </button>
                </div>
              )
            })}
        </div>
      )}

      {tab === 'yeni' && (
        <div className="card max-w-lg">
          <h2 className="text-sm font-medium mb-4">Yeni satın alma talebi</h2>
          <form onSubmit={handleYeni} className="space-y-3">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Malzeme</label>
              <select value={form.malzeme_id} onChange={e=>setForm({...form,malzeme_id:e.target.value})} required>
                <option value="">Seçiniz...</option>
                {malzemeler.map(m=><option key={m.id} value={m.id}>{m.ad}</option>)}
              </select></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Tedarikçi</label>
              <select value={form.tedarikci_id} onChange={e=>setForm({...form,tedarikci_id:e.target.value})}>
                <option value="">Seçiniz...</option>
                {tedarikciler.map(t=><option key={t.id} value={t.id}>{t.ad}</option>)}
              </select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Miktar (kg)</label>
                <input type="number" value={form.miktar_kg} onChange={e=>setForm({...form,miktar_kg:e.target.value})} required /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Birim fiyat ($/kg)</label>
                <input type="number" step="0.01" value={form.birim_fiyat_usd} onChange={e=>setForm({...form,birim_fiyat_usd:e.target.value})} /></div>
            </div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">İhtiyaç tarihi</label>
              <input type="date" value={form.ihtiyac_tarihi} onChange={e=>setForm({...form,ihtiyac_tarihi:e.target.value})} /></div>
            {msg && <p className={`text-sm rounded-lg px-3 py-2 ${msg.startsWith('✓')?'bg-green-50 text-green-700':'bg-red-50 text-red-600'}`}>{msg}</p>}
            <button type="submit" disabled={saving} className="btn btn-primary">{saving?'Kaydediliyor...':'💾 Talep oluştur'}</button>
          </form>
        </div>
      )}
    </div>
  )
}
