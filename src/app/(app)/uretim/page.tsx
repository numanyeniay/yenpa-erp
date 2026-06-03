'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function UretimPage() {
  const [kayitlar, setKayitlar] = useState<any[]>([])
  const [emirler, setEmirleri] = useState<any[]>([])
  const [makineler, setMakineler] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    is_emri_id:'', makine_id:'', adim:'baski',
    uretilen_metre:'', hiz_m_dk:'', fire_kg:'',
    boya_kullanilan_kg:'', tutkal_kullanilan_kg:'', durus_dk:'',
    durum:'tamamlandi'
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [tab, setTab] = useState<'liste'|'giris'>('liste')

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: k }, { data: e }, { data: m }] = await Promise.all([
      supabase.from('uretim_kaydi').select('*, is_emri(ie_no, musteri(ad)), makine(ad)').order('baslangic', { ascending: false }).limit(20),
      supabase.from('is_emri').select('id,ie_no,musteri(ad)').in('durum',['onaylandi','uretimde']),
      supabase.from('makine').select('*').eq('aktif',true),
    ])
    setKayitlar(k||[]); setEmirleri(e||[]); setMakineler(m||[])
    setLoading(false)
  }

  async function handleGiris(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setMsg('')
    const { data: user } = await supabase.auth.getUser()
    const metre = parseFloat(form.uretilen_metre)||0
    const makine = makineler.find(m=>m.id===form.makine_id)
    const hedefHiz = makine?.hedef_hiz_m_dk||130
    const sure = parseFloat(form.hiz_m_dk)||1
    const boyaKg = form.adim==='baski' ? metre*6.6/1000 : null
    const tutkalKg = form.adim==='laminasyon' ? metre*2.0/1000 : null

    const { error } = await supabase.from('uretim_kaydi').insert({
      is_emri_id: form.is_emri_id, makine_id: form.makine_id,
      kullanici_id: user?.user?.id||null,
      adim: form.adim, durum: form.durum,
      uretilen_metre: metre, hiz_m_dk: parseFloat(form.hiz_m_dk)||null,
      fire_kg: parseFloat(form.fire_kg)||0,
      boya_kullanilan_kg: boyaKg, tutkal_kullanilan_kg: tutkalKg,
      durus_dk: parseInt(form.durus_dk)||0,
      baslangic: new Date().toISOString(), bitis: new Date().toISOString(),
    })
    if (!error) {
      await supabase.from('is_emri').update({ durum:'uretimde' }).eq('id', form.is_emri_id)
      setMsg('✓ Üretim kaydı eklendi.'); load(); setTab('liste')
    } else setMsg('Hata: ' + error.message)
    setSaving(false)
  }

  const adimRenk: Record<string,string> = {
    baski:'badge-blue', laminasyon:'badge-blue',
    kurleme:'badge-gray', dilimleme:'badge-green', kesim:'badge-green'
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Yükleniyor...</div>

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Üretim takibi</h1>
        <div className="flex gap-2">
          <button onClick={()=>setTab('liste')} className={`btn ${tab==='liste'?'btn-primary':''}`}>📊 Kayıtlar</button>
          <button onClick={()=>setTab('giris')} className={`btn ${tab==='giris'?'btn-primary':''}`}>+ Üretim girişi</button>
        </div>
      </div>

      {tab === 'liste' && (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{['İş emri','Makine','Adım','Üretilen (m)','Hız','Fire','Duruş','Durum'].map(h=>(
                <th key={h} className="text-left text-xs text-gray-500 font-medium px-4 py-3">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {kayitlar.map(k=>(
                <tr key={k.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs font-medium">{k.is_emri?.ie_no}</div>
                    <div className="text-xs text-gray-500">{k.is_emri?.musteri?.ad}</div>
                  </td>
                  <td className="px-4 py-3 text-sm">{k.makine?.ad}</td>
                  <td className="px-4 py-3"><span className={`badge ${adimRenk[k.adim]||'badge-gray'}`}>{k.adim}</span></td>
                  <td className="px-4 py-3">{k.uretilen_metre?.toLocaleString('tr-TR')}</td>
                  <td className="px-4 py-3">{k.hiz_m_dk ? k.hiz_m_dk+' m/dk' : '—'}</td>
                  <td className="px-4 py-3 text-amber-600">{k.fire_kg>0 ? k.fire_kg+' kg' : '—'}</td>
                  <td className="px-4 py-3 text-red-500">{k.durus_dk>0 ? k.durus_dk+' dk' : '—'}</td>
                  <td className="px-4 py-3"><span className={`badge ${k.durum==='tamamlandi'?'badge-green':k.durum==='calisiyor'?'badge-blue':'badge-gray'}`}>{k.durum}</span></td>
                </tr>
              ))}
              {kayitlar.length===0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">Henüz üretim kaydı yok</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'giris' && (
        <div className="card max-w-2xl">
          <h2 className="text-sm font-medium text-gray-900 mb-4">Vardiya üretim girişi</h2>
          <form onSubmit={handleGiris} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">İş emri</label>
                <select value={form.is_emri_id} onChange={e=>setForm({...form,is_emri_id:e.target.value})} required>
                  <option value="">Seçiniz...</option>
                  {emirler.map(e=><option key={e.id} value={e.id}>{e.ie_no} · {e.musteri?.ad}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Makine</label>
                <select value={form.makine_id} onChange={e=>setForm({...form,makine_id:e.target.value})} required>
                  <option value="">Seçiniz...</option>
                  {makineler.map(m=><option key={m.id} value={m.id}>{m.ad}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Üretim adımı</label>
                <select value={form.adim} onChange={e=>setForm({...form,adim:e.target.value})}>
                  {['baski','laminasyon','kurleme','dilimleme','kesim'].map(a=><option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Üretilen metre</label>
                <input type="number" value={form.uretilen_metre} onChange={e=>setForm({...form,uretilen_metre:e.target.value})} required placeholder="örn: 8240" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Ortalama hız (m/dk)</label>
                <input type="number" value={form.hiz_m_dk} onChange={e=>setForm({...form,hiz_m_dk:e.target.value})} placeholder="örn: 118" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fire (kg)</label>
                <input type="number" step="0.1" value={form.fire_kg} onChange={e=>setForm({...form,fire_kg:e.target.value})} placeholder="0" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Duruş (dk)</label>
                <input type="number" value={form.durus_dk} onChange={e=>setForm({...form,durus_dk:e.target.value})} placeholder="0" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Durum</label>
                <select value={form.durum} onChange={e=>setForm({...form,durum:e.target.value})}>
                  {['calisiyor','durustu','tamamlandi'].map(d=><option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            {form.uretilen_metre && form.adim==='baski' && (
              <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
                Tahmini boya tüketimi: <strong>{(parseFloat(form.uretilen_metre)*6.6/1000).toFixed(2)} kg</strong>
                &nbsp;· Filmde kalan: <strong>{(parseFloat(form.uretilen_metre)*2.2/1000).toFixed(2)} kg</strong>
              </div>
            )}
            {msg && <p className={`text-sm rounded-lg px-3 py-2 ${msg.startsWith('✓')?'bg-green-50 text-green-700':'bg-red-50 text-red-600'}`}>{msg}</p>}
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'Kaydediliyor...' : '💾 Kaydet'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
