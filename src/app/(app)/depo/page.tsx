'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function DepoPage() {
  const [stok, setStok] = useState<any[]>([])
  const [malzemeler, setMalzemeler] = useState<any[]>([])
  const [tedarikciler, setTedarikciler] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'stok'|'giris'>('stok')
  const [form, setForm] = useState({
    malzeme_id:'', tedarikci_id:'', mikron:'', en_mm:'1300',
    agirlik_kg:'', irsaliye_no:'', depo_raf:'Raf A', birim_fiyat_usd:''
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: s }, { data: m }, { data: t }] = await Promise.all([
      supabase.from('stok').select('*, malzeme(ad,kod,min_stok_kg)').order('son_hareket', { ascending: false }),
      supabase.from('malzeme').select('*').order('kod'),
      supabase.from('tedarikci').select('*').eq('aktif', true),
    ])
    setStok(s || []); setMalzemeler(m || []); setTedarikciler(t || [])
    setLoading(false)
  }

  function lotNo() {
    const mal = malzemeler.find(m => m.id === form.malzeme_id)
    if (!mal) return ''
    const t = tedarikciler.find(t => t.id === form.tedarikci_id)
    const d = new Date(); const dd = String(d.getDate()).padStart(2,'0')
    const mm = String(d.getMonth()+1).padStart(2,'0'); const yy = String(d.getFullYear()).slice(2)
    const sup = t ? 'T' + (tedarikciler.indexOf(t)+1).toString().padStart(2,'0') : 'T00'
    return `${mal.kod}-${sup}-${dd}${mm}${yy}-001`
  }

  function calcM2() {
    const mal = malzemeler.find(m => m.id === form.malzeme_id)
    if (!mal || !form.mikron || !form.agirlik_kg) return 0
    return Math.round(parseFloat(form.agirlik_kg)*1000/(parseFloat(form.mikron)*mal.yogunluk))
  }

  async function handleGiris(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setMsg('')
    const lot = lotNo(); const m2 = calcM2()
    const { error: e1 } = await supabase.from('hammadde_giris').insert({
      malzeme_id: form.malzeme_id, tedarikci_id: form.tedarikci_id || null,
      lot_no: lot, mikron: parseInt(form.mikron)||null, en_mm: parseInt(form.en_mm)||1300,
      agirlik_kg: parseFloat(form.agirlik_kg), m2, irsaliye_no: form.irsaliye_no,
      depo_raf: form.depo_raf, birim_fiyat_usd: parseFloat(form.birim_fiyat_usd)||null,
    })
    if (!e1) {
      await supabase.from('stok').insert({
        malzeme_id: form.malzeme_id, lot_no: lot,
        mevcut_kg: parseFloat(form.agirlik_kg), mevcut_m2: m2, depo_raf: form.depo_raf
      })
      setMsg('✓ Giriş kaydedildi · Lot: ' + lot)
      setForm({ malzeme_id:'', tedarikci_id:'', mikron:'', en_mm:'1300', agirlik_kg:'', irsaliye_no:'', depo_raf:'Raf A', birim_fiyat_usd:'' })
      load()
    } else { setMsg('Hata: ' + e1.message) }
    setSaving(false)
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Yükleniyor...</div>

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Hammadde deposu</h1>
        <div className="flex gap-2">
          {(['stok','giris'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`btn ${tab===t ? 'btn-primary' : ''}`}>
              {t === 'stok' ? '📦 Mevcut stok' : '+ Yeni giriş'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'stok' && (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{['Malzeme','Lot no','Mevcut (kg)','Mevcut (m²)','Min stok','Durum','Raf'].map(h=>(
                <th key={h} className="text-left text-xs text-gray-500 font-medium px-4 py-3">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {stok.map(s => {
                const min = s.malzeme?.min_stok_kg || 0
                const durum = s.mevcut_kg <= min*0.5 ? 'Kritik' : s.mevcut_kg <= min ? 'Uyarı' : 'Normal'
                const dc = durum==='Kritik'?'badge-red':durum==='Uyarı'?'badge-amber':'badge-green'
                return (
                  <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{s.malzeme?.ad || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.lot_no}</td>
                    <td className="px-4 py-3">{s.mevcut_kg.toLocaleString('tr-TR')}</td>
                    <td className="px-4 py-3">{s.mevcut_m2?.toLocaleString('tr-TR') || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{min.toLocaleString('tr-TR')}</td>
                    <td className="px-4 py-3"><span className={`badge ${dc}`}>{durum}</span></td>
                    <td className="px-4 py-3 text-gray-500">{s.depo_raf}</td>
                  </tr>
                )
              })}
              {stok.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">Henüz stok girişi yok</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'giris' && (
        <div className="card max-w-2xl">
          <h2 className="text-sm font-medium text-gray-900 mb-4">Yeni hammadde girişi</h2>
          <form onSubmit={handleGiris} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Malzeme türü</label>
                <select value={form.malzeme_id} onChange={e=>setForm({...form,malzeme_id:e.target.value})} required>
                  <option value="">Seçiniz...</option>
                  {malzemeler.map(m=><option key={m.id} value={m.id}>{m.ad}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tedarikçi</label>
                <select value={form.tedarikci_id} onChange={e=>setForm({...form,tedarikci_id:e.target.value})}>
                  <option value="">Seçiniz...</option>
                  {tedarikciler.map(t=><option key={t.id} value={t.id}>{t.ad}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Kalınlık (mikron)</label>
                <input type="number" value={form.mikron} onChange={e=>setForm({...form,mikron:e.target.value})} placeholder="örn: 20" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Bobin eni (mm)</label>
                <input type="number" value={form.en_mm} onChange={e=>setForm({...form,en_mm:e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Ağırlık (kg)</label>
                <input type="number" value={form.agirlik_kg} onChange={e=>setForm({...form,agirlik_kg:e.target.value})} required placeholder="örn: 250" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">İrsaliye no</label>
                <input type="text" value={form.irsaliye_no} onChange={e=>setForm({...form,irsaliye_no:e.target.value})} placeholder="IRD-2026-00421" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Depo rafı</label>
                <select value={form.depo_raf} onChange={e=>setForm({...form,depo_raf:e.target.value})}>
                  <option>Raf A — giriş bölgesi</option>
                  <option>Raf B — OPP / CPP</option>
                  <option>Raf C — PET / LDPE</option>
                  <option>Raf D — metalize / alüminyum</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Birim fiyat (USD/kg)</label>
                <input type="number" step="0.01" value={form.birim_fiyat_usd} onChange={e=>setForm({...form,birim_fiyat_usd:e.target.value})} placeholder="örn: 3.27" />
              </div>
            </div>
            {form.malzeme_id && form.agirlik_kg && (
              <div className="bg-blue-50 rounded-lg p-3 text-sm">
                <span className="text-gray-500">Lot no: </span>
                <span className="font-mono font-medium text-blue-700">{lotNo()}</span>
                {form.mikron && <span className="ml-4 text-gray-500">Alan: <span className="font-medium text-gray-900">{calcM2().toLocaleString('tr-TR')} m²</span></span>}
              </div>
            )}
            {msg && <p className={`text-sm rounded-lg px-3 py-2 ${msg.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>{msg}</p>}
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'Kaydediliyor...' : '💾 Girişi kaydet'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
