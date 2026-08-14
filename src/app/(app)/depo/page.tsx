'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const HAREKET_TURLERI = [
  { v: 'giris',   l: 'Giris (stok artar)' },
  { v: 'cikis',   l: 'Cikis (uretime sevk)' },
  { v: 'fire',    l: 'Fire (kayip)' },
  { v: 'rezerve', l: 'Rezerve (proje icin ayrildi)' },
  { v: 'serbest', l: 'Serbest birak (rezerve iptali)' },
]

export default function DepoPage() {
  const [tab, setTab] = useState<'stok'|'hareket'>('stok')
  const [stoklar, setStoklar] = useState<any[]>([])
  const [malzemeler, setMalzemeler] = useState<any[]>([])
  const [tedarikciler, setTedarikciler] = useState<any[]>([])
  const [hareketler, setHareketler] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [filtreMalzeme, setFiltreMalzeme] = useState('')

  const [yeniStok, setYeniStok] = useState({
    malzeme_id: '', tedarikci_id: '', lot_no: '', mikron: '', en_mm: '',
    agirlik_kg: '', birim_fiyat: '', para_birimi: 'USD', depo_raf: '', irsaliye_no: '',
  })
  const [yeniHareket, setYeniHareket] = useState({
    stok_id: '', tur: 'cikis', miktar_kg: '', aciklama: '',
  })

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: s }, { data: m }, { data: t }, { data: h }] = await Promise.all([
      supabase.from('depo_stok').select('*, malzeme:malzeme_tanim(ad,tur,min_stok_kg), tedarikci:tedarikci_tanim(ad)').order('giris_tarihi', { ascending: false }),
      supabase.from('malzeme_tanim').select('*').eq('aktif', true).order('ad'),
      supabase.from('tedarikci_tanim').select('*').eq('aktif', true).order('ad'),
      supabase.from('depo_hareket').select('*, stok:depo_stok(lot_no, malzeme:malzeme_tanim(ad))').order('tarih', { ascending: false }).limit(100),
    ])
    setStoklar(s || []); setMalzemeler(m || []); setTedarikciler(t || []); setHareketler(h || [])
    setLoading(false)
  }

  // Malzeme bazinda toplam kalan stok (kritik stok karsilastirmasi icin)
  const malzemeToplam: Record<string, number> = {}
  for (const s of stoklar) {
    malzemeToplam[s.malzeme_id] = (malzemeToplam[s.malzeme_id] || 0) + (s.agirlik_kg || 0)
  }
  const kritikMalzemeler = malzemeler.filter(m => m.min_stok_kg && (malzemeToplam[m.id] || 0) < m.min_stok_kg)

  async function stokEkle() {
    setSaving(true); setMsg('')
    if (!yeniStok.malzeme_id || !yeniStok.lot_no || !yeniStok.agirlik_kg) {
      setMsg('Malzeme, lot no ve agirlik zorunlu.'); setSaving(false); return
    }
    const mikron = parseInt(yeniStok.mikron) || null
    const agirlik = parseFloat(yeniStok.agirlik_kg)
    const malzeme = malzemeler.find(m => m.id === yeniStok.malzeme_id)
    // m2 tahmini: film ise mikron*yogunluk uzerinden, degilse bos birak
    let m2: number | null = null
    if (mikron && malzeme?.yogunluk) {
      m2 = Math.round((agirlik * 1000) / (mikron * malzeme.yogunluk))
    }
    const { data: inserted, error } = await supabase.from('depo_stok').insert({
      malzeme_id: yeniStok.malzeme_id,
      tedarikci_id: yeniStok.tedarikci_id || null,
      lot_no: yeniStok.lot_no,
      mikron, en_mm: parseInt(yeniStok.en_mm) || null,
      agirlik_kg: agirlik, m2,
      birim_fiyat: parseFloat(yeniStok.birim_fiyat) || null,
      para_birimi: yeniStok.para_birimi,
      depo_raf: yeniStok.depo_raf || null,
      irsaliye_no: yeniStok.irsaliye_no || null,
    }).select().single()
    if (error) { setMsg('Hata: ' + error.message); setSaving(false); return }
    // Otomatik "giris" hareketi logla
    if (inserted) {
      await supabase.from('depo_hareket').insert({
        stok_id: inserted.id, tur: 'giris', miktar_kg: agirlik,
        aciklama: 'Yeni parti girisi' + (yeniStok.irsaliye_no ? ` (irsaliye: ${yeniStok.irsaliye_no})` : ''),
      })
    }
    setMsg('Stok girisi kaydedildi.'); load()
    setYeniStok({ malzeme_id: '', tedarikci_id: '', lot_no: '', mikron: '', en_mm: '', agirlik_kg: '', birim_fiyat: '', para_birimi: 'USD', depo_raf: '', irsaliye_no: '' })
    setSaving(false)
  }

  async function hareketEkle() {
    setSaving(true); setMsg('')
    if (!yeniHareket.stok_id || !yeniHareket.miktar_kg) {
      setMsg('Lot ve miktar zorunlu.'); setSaving(false); return
    }
    const miktar = parseFloat(yeniHareket.miktar_kg)
    const stok = stoklar.find(s => s.id === yeniHareket.stok_id)
    if (!stok) { setMsg('Lot bulunamadi.'); setSaving(false); return }

    // giris/cikis/fire agirlik_kg'yi degistirir; rezerve/serbest sadece log (ayri rezerve alani yok, MVP)
    let yeniAgirlik = stok.agirlik_kg
    if (yeniHareket.tur === 'giris') yeniAgirlik += miktar
    if (yeniHareket.tur === 'cikis' || yeniHareket.tur === 'fire') {
      if (miktar > stok.agirlik_kg) { setMsg(`Hata: bu lotta sadece ${stok.agirlik_kg} kg var.`); setSaving(false); return }
      yeniAgirlik -= miktar
    }

    const { error: e1 } = await supabase.from('depo_hareket').insert({
      stok_id: yeniHareket.stok_id, tur: yeniHareket.tur, miktar_kg: miktar,
      aciklama: yeniHareket.aciklama || null,
    })
    if (e1) { setMsg('Hata: ' + e1.message); setSaving(false); return }

    if (yeniHareket.tur === 'giris' || yeniHareket.tur === 'cikis' || yeniHareket.tur === 'fire') {
      const { error: e2 } = await supabase.from('depo_stok').update({ agirlik_kg: yeniAgirlik, son_hareket: new Date().toISOString() }).eq('id', stok.id)
      if (e2) { setMsg('Hata: ' + e2.message); setSaving(false); return }
    }

    setMsg('Hareket kaydedildi.'); load()
    setYeniHareket({ stok_id: '', tur: 'cikis', miktar_kg: '', aciklama: '' })
    setSaving(false)
  }

  const gorunenStoklar = filtreMalzeme ? stoklar.filter(s => s.malzeme_id === filtreMalzeme) : stoklar

  if (loading) return <div className="p-8 text-gray-400 text-sm">Yukleniyor...</div>

  return (
    <div className="p-6">
      <div className="page-header">
        <h1 className="page-title">Hammadde Deposu</h1>
      </div>

      {kritikMalzemeler.length > 0 && (
        <div className="card card-body mb-6 bg-red-50 border-red-200">
          <div className="flex items-center gap-2 text-red-700 font-medium text-sm mb-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
            Kritik stok uyarisi ({kritikMalzemeler.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {kritikMalzemeler.map(m => (
              <span key={m.id} className="badge badge-red">
                {m.ad}: {(malzemeToplam[m.id] || 0).toFixed(0)} / {m.min_stok_kg} kg
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-0 mb-6 border-b border-gray-200">
        {[{ k: 'stok', l: 'Stok Listesi' }, { k: 'hareket', l: 'Hareketler' }].map(t => (
          <button key={t.k} onClick={() => { setTab(t.k as any); setMsg('') }}
            className={`px-5 py-2.5 text-sm border-b-2 -mb-px transition-colors ${tab === t.k ? 'border-blue-600 text-blue-600 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'stok' && (
        <div className="space-y-4">
          <div className="card">
            <div className="card-header"><span className="font-medium text-sm">Yeni parti (lot) girisi</span></div>
            <div className="card-body">
              <div className="grid grid-cols-4 gap-3 items-end mb-3">
                <div className="col-span-2">
                  <label>Malzeme</label>
                  <select value={yeniStok.malzeme_id} onChange={e => setYeniStok(p => ({ ...p, malzeme_id: e.target.value }))}>
                    <option value="">Secin...</option>
                    {malzemeler.map(m => <option key={m.id} value={m.id}>{m.ad}</option>)}
                  </select>
                </div>
                <div>
                  <label>Tedarikci</label>
                  <select value={yeniStok.tedarikci_id} onChange={e => setYeniStok(p => ({ ...p, tedarikci_id: e.target.value }))}>
                    <option value="">Secin...</option>
                    {tedarikciler.map(t => <option key={t.id} value={t.id}>{t.ad}</option>)}
                  </select>
                </div>
                <div>
                  <label>Lot no</label>
                  <input value={yeniStok.lot_no} onChange={e => setYeniStok(p => ({ ...p, lot_no: e.target.value }))} placeholder="LOT-2026-001" />
                </div>
              </div>
              <div className="grid grid-cols-6 gap-3 items-end">
                <div>
                  <label>Mikron</label>
                  <input type="number" value={yeniStok.mikron} onChange={e => setYeniStok(p => ({ ...p, mikron: e.target.value }))} />
                </div>
                <div>
                  <label>En (mm)</label>
                  <input type="number" value={yeniStok.en_mm} onChange={e => setYeniStok(p => ({ ...p, en_mm: e.target.value }))} />
                </div>
                <div>
                  <label>Agirlik (kg)</label>
                  <input type="number" step="0.001" value={yeniStok.agirlik_kg} onChange={e => setYeniStok(p => ({ ...p, agirlik_kg: e.target.value }))} />
                </div>
                <div>
                  <label>Birim fiyat</label>
                  <input type="number" step="0.0001" value={yeniStok.birim_fiyat} onChange={e => setYeniStok(p => ({ ...p, birim_fiyat: e.target.value }))} />
                </div>
                <div>
                  <label>Depo rafi</label>
                  <input value={yeniStok.depo_raf} onChange={e => setYeniStok(p => ({ ...p, depo_raf: e.target.value }))} placeholder="A-12" />
                </div>
                <div>
                  <label>Irsaliye no</label>
                  <input value={yeniStok.irsaliye_no} onChange={e => setYeniStok(p => ({ ...p, irsaliye_no: e.target.value }))} />
                </div>
              </div>
              {msg && <p className={`text-sm mt-2 ${msg.startsWith('Hata') ? 'text-red-600' : 'text-green-600'}`}>{msg}</p>}
              <button onClick={stokEkle} disabled={saving} className="btn btn-primary mt-3">Stok girisi yap</button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="!mb-0">Malzemeye gore filtrele:</label>
            <select className="!w-64" value={filtreMalzeme} onChange={e => setFiltreMalzeme(e.target.value)}>
              <option value="">Tumu</option>
              {malzemeler.map(m => <option key={m.id} value={m.id}>{m.ad}</option>)}
            </select>
          </div>

          <div className="card p-0 overflow-hidden">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Malzeme</th><th>Lot no</th><th>Mikron</th><th>En</th>
                  <th>Kalan (kg)</th><th>Birim fiyat</th><th>Deger</th><th>Raf</th><th>Tedarikci</th>
                </tr>
              </thead>
              <tbody>
                {gorunenStoklar.map(s => (
                  <tr key={s.id}>
                    <td className="font-medium">{s.malzeme?.ad}</td>
                    <td className="font-mono text-xs">{s.lot_no}</td>
                    <td>{s.mikron ? s.mikron + ' mic' : '—'}</td>
                    <td>{s.en_mm ? s.en_mm + ' mm' : '—'}</td>
                    <td className={s.agirlik_kg <= 0 ? 'text-red-500' : 'font-semibold'}>{Number(s.agirlik_kg).toFixed(1)}</td>
                    <td className="text-gray-500">{s.birim_fiyat ? `$${Number(s.birim_fiyat).toFixed(4)}` : '—'}</td>
                    <td className="text-gray-500">{s.birim_fiyat ? `$${(s.agirlik_kg * s.birim_fiyat).toFixed(2)}` : '—'}</td>
                    <td className="text-gray-400 text-xs">{s.depo_raf || '—'}</td>
                    <td className="text-gray-500">{s.tedarikci?.ad || '—'}</td>
                  </tr>
                ))}
                {gorunenStoklar.length === 0 && <tr><td colSpan={9} className="text-center text-gray-400 py-8">Stok kaydi yok</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'hareket' && (
        <div className="space-y-4">
          <div className="card">
            <div className="card-header"><span className="font-medium text-sm">Yeni hareket kaydet</span></div>
            <div className="card-body">
              <div className="grid grid-cols-4 gap-3 items-end">
                <div className="col-span-2">
                  <label>Lot</label>
                  <select value={yeniHareket.stok_id} onChange={e => setYeniHareket(p => ({ ...p, stok_id: e.target.value }))}>
                    <option value="">Secin...</option>
                    {stoklar.filter(s => s.agirlik_kg > 0).map(s => (
                      <option key={s.id} value={s.id}>{s.malzeme?.ad} — {s.lot_no} ({Number(s.agirlik_kg).toFixed(1)} kg kaldi)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Hareket turu</label>
                  <select value={yeniHareket.tur} onChange={e => setYeniHareket(p => ({ ...p, tur: e.target.value }))}>
                    {HAREKET_TURLERI.map(h => <option key={h.v} value={h.v}>{h.l}</option>)}
                  </select>
                </div>
                <div>
                  <label>Miktar (kg)</label>
                  <input type="number" step="0.001" value={yeniHareket.miktar_kg} onChange={e => setYeniHareket(p => ({ ...p, miktar_kg: e.target.value }))} />
                </div>
              </div>
              <div className="mt-3">
                <label>Aciklama</label>
                <input value={yeniHareket.aciklama} onChange={e => setYeniHareket(p => ({ ...p, aciklama: e.target.value }))} placeholder="Opsiyonel — proje no, sebep vb." />
              </div>
              {msg && <p className={`text-sm mt-2 ${msg.startsWith('Hata') ? 'text-red-600' : 'text-green-600'}`}>{msg}</p>}
              <button onClick={hareketEkle} disabled={saving} className="btn btn-primary mt-3">Hareketi kaydet</button>
            </div>
          </div>

          <div className="card p-0 overflow-hidden">
            <table className="table-base">
              <thead><tr><th>Tarih</th><th>Malzeme / Lot</th><th>Tur</th><th>Miktar</th><th>Aciklama</th></tr></thead>
              <tbody>
                {hareketler.map(h => (
                  <tr key={h.id}>
                    <td className="text-gray-400 text-xs">{new Date(h.tarih).toLocaleString('tr-TR')}</td>
                    <td className="font-medium">{h.stok?.malzeme?.ad} <span className="text-gray-400 font-mono text-xs">({h.stok?.lot_no})</span></td>
                    <td>
                      <span className={`badge ${h.tur === 'giris' ? 'badge-green' : h.tur === 'cikis' ? 'badge-blue' : h.tur === 'fire' ? 'badge-red' : 'badge-amber'}`}>
                        {HAREKET_TURLERI.find(t => t.v === h.tur)?.l || h.tur}
                      </span>
                    </td>
                    <td className="font-semibold">{Number(h.miktar_kg).toFixed(1)} kg</td>
                    <td className="text-gray-500 text-xs">{h.aciklama || '—'}</td>
                  </tr>
                ))}
                {hareketler.length === 0 && <tr><td colSpan={5} className="text-center text-gray-400 py-8">Hareket kaydi yok</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
