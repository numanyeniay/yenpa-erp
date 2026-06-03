'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const DURUM_BADGE: Record<string,string> = {
  taslak:'badge-gray', onaylandi:'badge-amber',
  uretimde:'badge-blue', tamamlandi:'badge-green', iptal:'badge-red'
}

export default function IsEmirleriPage() {
  const [emirler, setEmirleri] = useState<any[]>([])
  const [musteriler, setMusteriler] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'liste'|'yeni'>('liste')
  const [form, setForm] = useState({
    musteri_id:'', urun_tanimi:'', baskili:true, lamineli:true,
    cikti_turu:'doypack', en_mm:'', boy_mm:'', siparis_kg:'', termin:''
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: e }, { data: m }] = await Promise.all([
      supabase.from('is_emri').select('*, musteri(ad)').order('olusturma', { ascending: false }),
      supabase.from('musteri').select('*').eq('aktif', true),
    ])
    setEmirleri(e || []); setMusteriler(m || []); setLoading(false)
  }

  function nextIeNo() {
    const max = emirler.length
    return `IE-${new Date().getFullYear()}-${String(max+1).padStart(4,'0')}`
  }

  async function handleYeni(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setMsg('')
    const { data: user } = await supabase.auth.getUser()
    const kul = user?.user?.id
    const { error } = await supabase.from('is_emri').insert({
      musteri_id: form.musteri_id, ie_no: nextIeNo(),
      urun_tanimi: form.urun_tanimi, baskili: form.baskili, lamineli: form.lamineli,
      cikti_turu: form.cikti_turu, en_mm: parseInt(form.en_mm)||null,
      boy_mm: parseInt(form.boy_mm)||null, siparis_kg: parseFloat(form.siparis_kg),
      termin: form.termin || null, durum: 'taslak',
      kullanici_id: kul || null,
    })
    if (!error) { setMsg('✓ İş emri oluşturuldu.'); load(); setTab('liste') }
    else setMsg('Hata: ' + error.message)
    setSaving(false)
  }

  async function durumGuncelle(id: string, durum: string) {
    await supabase.from('is_emri').update({ durum }).eq('id', id)
    load()
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Yükleniyor...</div>

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">İş emirleri</h1>
        <div className="flex gap-2">
          <button onClick={() => setTab('liste')} className={`btn ${tab==='liste'?'btn-primary':''}`}>📋 Liste</button>
          <button onClick={() => setTab('yeni')}  className={`btn ${tab==='yeni' ?'btn-primary':''}`}>+ Yeni iş emri</button>
        </div>
      </div>

      {tab === 'liste' && (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{['İE No','Müşteri','Ürün','Kg','Termin','Özellikler','Durum','İşlem'].map(h=>(
                <th key={h} className="text-left text-xs text-gray-500 font-medium px-4 py-3">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {emirler.map(e => (
                <tr key={e.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs font-medium">{e.ie_no}</td>
                  <td className="px-4 py-3">{e.musteri?.ad || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs max-w-[160px] truncate">{e.urun_tanimi}</td>
                  <td className="px-4 py-3">{e.siparis_kg} kg</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{e.termin ? new Date(e.termin).toLocaleDateString('tr-TR') : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {e.baskili && <span className="badge badge-blue">Baskılı</span>}
                      {e.lamineli && <span className="badge badge-blue">Lamineli</span>}
                      {e.cikti_turu && <span className="badge badge-gray">{e.cikti_turu}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className={`badge ${DURUM_BADGE[e.durum]||'badge-gray'}`}>{e.durum}</span></td>
                  <td className="px-4 py-3">
                    <select className="text-xs py-1 px-2 border border-gray-200 rounded"
                      value={e.durum} onChange={ev => durumGuncelle(e.id, ev.target.value)}>
                      {['taslak','onaylandi','uretimde','tamamlandi','iptal'].map(d=>(
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {emirler.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">Henüz iş emri yok</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'yeni' && (
        <div className="card max-w-2xl">
          <h2 className="text-sm font-medium text-gray-900 mb-4">Yeni iş emri — <span className="font-mono text-blue-600">{nextIeNo()}</span></h2>
          <form onSubmit={handleYeni} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Müşteri</label>
                <select value={form.musteri_id} onChange={e=>setForm({...form,musteri_id:e.target.value})} required>
                  <option value="">Seçiniz...</option>
                  {musteriler.map(m=><option key={m.id} value={m.id}>{m.ad}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Ürün tanımı</label>
                <input type="text" value={form.urun_tanimi} onChange={e=>setForm({...form,urun_tanimi:e.target.value})} placeholder="OPP/CPP Doypack baskılı" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Sipariş (kg)</label>
                <input type="number" value={form.siparis_kg} onChange={e=>setForm({...form,siparis_kg:e.target.value})} required placeholder="500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Termin tarihi</label>
                <input type="date" value={form.termin} onChange={e=>setForm({...form,termin:e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Çıktı türü</label>
                <select value={form.cikti_turu} onChange={e=>setForm({...form,cikti_turu:e.target.value})}>
                  {['bobin','doypack','quadro','flatbottom','sirt','yan'].map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Bobin eni (mm)</label>
                <input type="number" value={form.en_mm} onChange={e=>setForm({...form,en_mm:e.target.value})} placeholder="1300" />
              </div>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.baskili} onChange={e=>setForm({...form,baskili:e.target.checked})} className="w-auto" />
                Baskılı
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.lamineli} onChange={e=>setForm({...form,lamineli:e.target.checked})} className="w-auto" />
                Lamineli
              </label>
            </div>
            {msg && <p className={`text-sm rounded-lg px-3 py-2 ${msg.startsWith('✓')?'bg-green-50 text-green-700':'bg-red-50 text-red-600'}`}>{msg}</p>}
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'Kaydediliyor...' : '💾 İş emrini oluştur'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
