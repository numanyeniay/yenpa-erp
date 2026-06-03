'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function MusterilerPage() {
  const [musteriler, setMusteriler] = useState<any[]>([])
  const [irsaliyeler, setIrsaliyeler] = useState<any[]>([])
  const [emirler, setEmirleri] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'musteriler'|'irsaliye'|'yeni-musteri'|'yeni-irsaliye'>('musteriler')
  const [mForm, setMForm] = useState({ ad:'', iletisim:'', sehir:'', kredi_limiti_usd:'', vade_gun:'30' })
  const [iForm, setIForm] = useState({ is_emri_id:'', musteri_id:'', koli_sayisi:'', toplam_kg:'', arac_plaka:'', nakliyeci:'', teslimat_adresi:'', sevk_tarihi:'' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: m }, { data: i }, { data: e }] = await Promise.all([
      supabase.from('musteri').select('*').order('ad'),
      supabase.from('irsaliye').select('*, musteri(ad), is_emri(ie_no)').order('olusturma', { ascending: false }),
      supabase.from('is_emri').select('id,ie_no,musteri(ad)').in('durum',['tamamlandi','uretimde']),
    ])
    setMusteriler(m||[]); setIrsaliyeler(i||[]); setEmirleri(e||[])
    setLoading(false)
  }

  async function handleMusteri(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setMsg('')
    const { error } = await supabase.from('musteri').insert({
      ad: mForm.ad, iletisim: mForm.iletisim, sehir: mForm.sehir,
      kredi_limiti_usd: parseFloat(mForm.kredi_limiti_usd)||0,
      vade_gun: parseInt(mForm.vade_gun)||30,
    })
    if (!error) { setMsg('✓ Müşteri eklendi.'); load(); setTab('musteriler') }
    else setMsg('Hata: '+error.message)
    setSaving(false)
  }

  async function handleIrsaliye(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setMsg('')
    const irsNo = `IRS-${new Date().getFullYear()}-${String(irsaliyeler.length+1).padStart(5,'0')}`
    const { error } = await supabase.from('irsaliye').insert({
      is_emri_id: iForm.is_emri_id||null, musteri_id: iForm.musteri_id,
      irs_no: irsNo, koli_sayisi: parseInt(iForm.koli_sayisi)||null,
      toplam_kg: parseFloat(iForm.toplam_kg)||null, arac_plaka: iForm.arac_plaka,
      nakliyeci: iForm.nakliyeci, teslimat_adresi: iForm.teslimat_adresi,
      sevk_tarihi: iForm.sevk_tarihi||null, durum:'hazirlaniyor',
    })
    if (!error) { setMsg('✓ İrsaliye oluşturuldu: '+irsNo); load(); setTab('irsaliye') }
    else setMsg('Hata: '+error.message)
    setSaving(false)
  }

  async function durumGuncelle(id: string, durum: string) {
    await supabase.from('irsaliye').update({ durum }).eq('id', id)
    load()
  }

  const durumBadge: Record<string,string> = {
    hazirlaniyor:'badge-amber', yolda:'badge-blue',
    teslim_edildi:'badge-green', iade:'badge-red'
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Yükleniyor...</div>

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Müşteri & Sevkiyat</h1>
        <div className="flex gap-2">
          <button onClick={()=>setTab('musteriler')} className={`btn ${tab==='musteriler'?'btn-primary':''}`}>🏢 Müşteriler</button>
          <button onClick={()=>setTab('irsaliye')} className={`btn ${tab==='irsaliye'?'btn-primary':''}`}>📄 İrsaliyeler</button>
          <button onClick={()=>setTab('yeni-musteri')} className={`btn ${tab==='yeni-musteri'?'btn-primary':''}`}>+ Müşteri</button>
          <button onClick={()=>setTab('yeni-irsaliye')} className={`btn ${tab==='yeni-irsaliye'?'btn-primary':''}`}>+ İrsaliye</button>
        </div>
      </div>

      {tab === 'musteriler' && (
        <div className="grid grid-cols-2 gap-4">
          {musteriler.map(m => (
            <div key={m.id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-medium text-gray-900">{m.ad}</div>
                  <div className="text-sm text-gray-500 mt-0.5">{m.sehir} · {m.vade_gun} gün vade</div>
                </div>
                <span className={`badge ${m.aktif?'badge-green':'badge-gray'}`}>{m.aktif?'Aktif':'Pasif'}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-xs text-gray-400">Kredi limiti</div>
                  <div className="text-sm font-medium">${m.kredi_limiti_usd?.toLocaleString('tr-TR')}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-xs text-gray-400">İletişim</div>
                  <div className="text-xs text-gray-600 truncate">{m.iletisim||'—'}</div>
                </div>
              </div>
            </div>
          ))}
          {musteriler.length === 0 && <p className="text-sm text-gray-400 col-span-2">Henüz müşteri yok.</p>}
        </div>
      )}

      {tab === 'irsaliye' && (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{['İrs No','Müşteri','İş emri','Kg','Koli','Araç','Sevk tarihi','Durum','İşlem'].map(h=>(
                <th key={h} className="text-left text-xs text-gray-500 font-medium px-3 py-3">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {irsaliyeler.map(i => (
                <tr key={i.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-3 font-mono text-xs">{i.irs_no}</td>
                  <td className="px-3 py-3">{i.musteri?.ad||'—'}</td>
                  <td className="px-3 py-3 font-mono text-xs text-gray-500">{i.is_emri?.ie_no||'—'}</td>
                  <td className="px-3 py-3">{i.toplam_kg} kg</td>
                  <td className="px-3 py-3">{i.koli_sayisi}</td>
                  <td className="px-3 py-3 text-gray-500 text-xs">{i.arac_plaka}</td>
                  <td className="px-3 py-3 text-gray-500 text-xs">{i.sevk_tarihi ? new Date(i.sevk_tarihi).toLocaleDateString('tr-TR') : '—'}</td>
                  <td className="px-3 py-3"><span className={`badge ${durumBadge[i.durum]||'badge-gray'}`}>{i.durum}</span></td>
                  <td className="px-3 py-3">
                    <select className="text-xs py-1 px-2 border border-gray-200 rounded"
                      value={i.durum} onChange={e=>durumGuncelle(i.id,e.target.value)}>
                      {['hazirlaniyor','yolda','teslim_edildi','iade'].map(d=>(
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {irsaliyeler.length===0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400 text-sm">Henüz irsaliye yok</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'yeni-musteri' && (
        <div className="card max-w-lg">
          <h2 className="text-sm font-medium mb-4">Yeni müşteri</h2>
          <form onSubmit={handleMusteri} className="space-y-3">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Firma adı</label>
              <input value={mForm.ad} onChange={e=>setMForm({...mForm,ad:e.target.value})} required placeholder="Ülker Gıda A.Ş." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Şehir</label>
                <input value={mForm.sehir} onChange={e=>setMForm({...mForm,sehir:e.target.value})} placeholder="İstanbul" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Vade (gün)</label>
                <input type="number" value={mForm.vade_gun} onChange={e=>setMForm({...mForm,vade_gun:e.target.value})} /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Kredi limiti (USD)</label>
                <input type="number" value={mForm.kredi_limiti_usd} onChange={e=>setMForm({...mForm,kredi_limiti_usd:e.target.value})} placeholder="50000" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">İletişim</label>
                <input value={mForm.iletisim} onChange={e=>setMForm({...mForm,iletisim:e.target.value})} placeholder="0212 xxx xx xx" /></div>
            </div>
            {msg && <p className={`text-sm rounded-lg px-3 py-2 ${msg.startsWith('✓')?'bg-green-50 text-green-700':'bg-red-50 text-red-600'}`}>{msg}</p>}
            <button type="submit" disabled={saving} className="btn btn-primary">{saving?'Kaydediliyor...':'💾 Kaydet'}</button>
          </form>
        </div>
      )}

      {tab === 'yeni-irsaliye' && (
        <div className="card max-w-lg">
          <h2 className="text-sm font-medium mb-4">Yeni irsaliye oluştur</h2>
          <form onSubmit={handleIrsaliye} className="space-y-3">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Müşteri</label>
              <select value={iForm.musteri_id} onChange={e=>setIForm({...iForm,musteri_id:e.target.value})} required>
                <option value="">Seçiniz...</option>
                {musteriler.map(m=><option key={m.id} value={m.id}>{m.ad}</option>)}
              </select></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">İş emri (opsiyonel)</label>
              <select value={iForm.is_emri_id} onChange={e=>setIForm({...iForm,is_emri_id:e.target.value})}>
                <option value="">—</option>
                {emirler.map(e=><option key={e.id} value={e.id}>{e.ie_no} · {e.musteri?.ad}</option>)}
              </select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Toplam kg</label>
                <input type="number" value={iForm.toplam_kg} onChange={e=>setIForm({...iForm,toplam_kg:e.target.value})} required /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Koli sayısı</label>
                <input type="number" value={iForm.koli_sayisi} onChange={e=>setIForm({...iForm,koli_sayisi:e.target.value})} /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Araç plaka</label>
                <input value={iForm.arac_plaka} onChange={e=>setIForm({...iForm,arac_plaka:e.target.value})} placeholder="34 ABC 123" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Sevk tarihi</label>
                <input type="date" value={iForm.sevk_tarihi} onChange={e=>setIForm({...iForm,sevk_tarihi:e.target.value})} /></div>
            </div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Teslimat adresi</label>
              <input value={iForm.teslimat_adresi} onChange={e=>setIForm({...iForm,teslimat_adresi:e.target.value})} placeholder="İstanbul, Bağcılar..." /></div>
            {msg && <p className={`text-sm rounded-lg px-3 py-2 ${msg.startsWith('✓')?'bg-green-50 text-green-700':'bg-red-50 text-red-600'}`}>{msg}</p>}
            <button type="submit" disabled={saving} className="btn btn-primary">{saving?'Oluşturuluyor...':'📄 İrsaliye oluştur'}</button>
          </form>
        </div>
      )}
    </div>
  )
}
