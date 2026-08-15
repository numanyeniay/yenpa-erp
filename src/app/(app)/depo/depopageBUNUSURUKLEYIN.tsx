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

// Excel "Tum Stoklar" sekmesindeki malzeme adlarini malzeme_tanim.kod'una esler
const MALZEME_ESANLAMLI: Record<string, string> = {
  'PE': 'PE', 'OPP': 'OPP', 'CPP': 'CPP', 'PET': 'PET',
  'MET PET': 'MPET', 'MAT OPP': 'MATOPP', 'MATOPP': 'MATOPP',
  'PE + MET PET': 'PE+METPET', 'PE+MET PET': 'PE+METPET',
}

export default function DepoPage() {
  const [tab, setTab] = useState<'stok'|'hareket'|'ise-gore'|'fiziksel'>('stok')
  const [stoklar, setStoklar] = useState<any[]>([])
  const [malzemeler, setMalzemeler] = useState<any[]>([])
  const [tedarikciler, setTedarikciler] = useState<any[]>([])
  const [hareketler, setHareketler] = useState<any[]>([])
  const [projeler, setProjeler] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [filtreMalzeme, setFiltreMalzeme] = useState('')
  const [filtreKonum, setFiltreKonum] = useState('')
  const [iceAktarYukleniyor, setIceAktarYukleniyor] = useState(false)
  const [iceAktarMsg, setIceAktarMsg] = useState('')
  const [iceAktarOnizleme, setIceAktarOnizleme] = useState<{ satir: number, eslesmeyen: string[], veriler: any[] } | null>(null)

  const [yeniStok, setYeniStok] = useState({
    malzeme_id: '', tedarikci_id: '', lot_no: '', mikron: '', en_mm: '',
    agirlik_kg: '', birim_fiyat: '', para_birimi: 'USD', depo_raf: '', irsaliye_no: '',
  })
  const [yeniHareket, setYeniHareket] = useState({
    stok_id: '', tur: 'cikis', miktar_kg: '', aciklama: '', proje_id: '',
  })

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: s }, { data: m }, { data: t }, { data: h }, { data: p }] = await Promise.all([
      supabase.from('depo_stok').select('*, malzeme:malzeme_tanim(ad,tur,min_stok_kg), tedarikci:tedarikci_tanim(ad)').order('giris_tarihi', { ascending: false }),
      supabase.from('malzeme_tanim').select('*').eq('aktif', true).order('ad'),
      supabase.from('tedarikci_tanim').select('*').eq('aktif', true).order('ad'),
      supabase.from('depo_hareket').select('*, stok:depo_stok(lot_no, malzeme:malzeme_tanim(ad)), proje:proje(proje_no,ad)').order('tarih', { ascending: false }).limit(200),
      supabase.from('proje').select('id,proje_no,ad').in('durum', ['musteri_onayladi', 'uretimde']).order('olusturma', { ascending: false }),
    ])
    setStoklar(s || []); setMalzemeler(m || []); setTedarikciler(t || []); setHareketler(h || []); setProjeler(p || [])
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
      aciklama: yeniHareket.aciklama || null, proje_id: yeniHareket.proje_id || null,
    })
    if (e1) { setMsg('Hata: ' + e1.message); setSaving(false); return }

    if (yeniHareket.tur === 'giris' || yeniHareket.tur === 'cikis' || yeniHareket.tur === 'fire') {
      const { error: e2 } = await supabase.from('depo_stok').update({ agirlik_kg: yeniAgirlik, son_hareket: new Date().toISOString() }).eq('id', stok.id)
      if (e2) { setMsg('Hata: ' + e2.message); setSaving(false); return }
    }

    setMsg('Hareket kaydedildi.'); load()
    setYeniHareket({ stok_id: '', tur: 'cikis', miktar_kg: '', aciklama: '', proje_id: '' })
    setSaving(false)
  }

  // Fiziksel depo (konum bazli) Excel'den ice aktarma
  async function excelDosyaOku(file: File) {
    setIceAktarMsg(''); setIceAktarOnizleme(null); setIceAktarYukleniyor(true)
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheetName = wb.SheetNames.includes('Tüm Stoklar') ? 'Tüm Stoklar' : wb.SheetNames[0]
      const ws = wb.Sheets[sheetName]
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
      const headerIdx = rows.findIndex(r => r[0] === 'Konum' && r[3] === 'Malzeme')
      if (headerIdx === -1) {
        setIceAktarMsg('Beklenen sutun basliklari bulunamadi (Konum, Palet, Durum, Malzeme, En (cm), Mikron / Yapi, Agirlik (kg), Aciklama). Dosya sablonu farkli olabilir.')
        setIceAktarYukleniyor(false); return
      }
      const dataRows = rows.slice(headerIdx + 1).filter(r => r[0] || r[3])
      const konumSayac: Record<string, number> = {}
      const eslesmeyen = new Set<string>()
      const parsed: any[] = []
      for (const r of dataRows) {
        const [konum, palet, durum, malzemeAdi, en, mikronYapi, kg, aciklama] = r
        if (!malzemeAdi) continue
        const kod = MALZEME_ESANLAMLI[String(malzemeAdi).trim()]
        const malzeme = kod
          ? malzemeler.find(m => m.kod === kod)
          : malzemeler.find(m => (m.ad || '').toLowerCase() === String(malzemeAdi).trim().toLowerCase())
        if (!malzeme) { eslesmeyen.add(String(malzemeAdi)); continue }
        const k = konum || 'BILINMIYOR'
        konumSayac[k] = (konumSayac[k] || 0) + 1
        const mikronNum = typeof mikronYapi === 'number' ? mikronYapi : null
        const aciklamaParts: string[] = []
        if (mikronYapi && typeof mikronYapi !== 'number') aciklamaParts.push(`Yapi: ${mikronYapi}`)
        if (aciklama) aciklamaParts.push(String(aciklama))
        parsed.push({
          malzeme_id: malzeme.id,
          lot_no: `EXCEL-${k}-${konumSayac[k]}`,
          mikron: mikronNum,
          en_mm: typeof en === 'number' ? Math.round(en * 10) : null,
          agirlik_kg: typeof kg === 'number' ? kg : 0,
          konum: konum || null,
          palet_no: palet || null,
          durum: durum || null,
          aciklama: aciklamaParts.length ? aciklamaParts.join('; ') : null,
          kaynak: 'excel_import',
        })
      }
      setIceAktarOnizleme({ satir: parsed.length, eslesmeyen: Array.from(eslesmeyen), veriler: parsed })
    } catch (e: any) {
      setIceAktarMsg('Dosya okunamadi: ' + e.message)
    }
    setIceAktarYukleniyor(false)
  }

  async function excelOnayla() {
    if (!iceAktarOnizleme) return
    setIceAktarYukleniyor(true)
    await supabase.from('depo_stok').delete().eq('kaynak', 'excel_import')
    const { error } = await supabase.from('depo_stok').insert(iceAktarOnizleme.veriler)
    if (error) {
      setIceAktarMsg('Hata: ' + error.message)
    } else {
      setIceAktarMsg(`${iceAktarOnizleme.veriler.length} kayit ice aktarildi (onceki Excel verisinin yerine gecti).`)
      setIceAktarOnizleme(null)
      load()
    }
    setIceAktarYukleniyor(false)
  }

  const gorunenStoklar = filtreMalzeme ? stoklar.filter(s => s.malzeme_id === filtreMalzeme) : stoklar
  const fizikselStoklar = stoklar.filter(s => s.konum)
  const fizikselGorunen = filtreKonum ? fizikselStoklar.filter(s => s.konum === filtreKonum) : fizikselStoklar
  const konumlar = Array.from(new Set(fizikselStoklar.map(s => s.konum))).sort()
  const fizikselMalzemeOzet: Record<string, number> = {}
  for (const s of fizikselStoklar) {
    const ad = s.malzeme?.ad || 'Bilinmeyen'
    fizikselMalzemeOzet[ad] = (fizikselMalzemeOzet[ad] || 0) + (Number(s.agirlik_kg) || 0)
  }
  const fizikselToplamKg = fizikselStoklar.reduce((t, s) => t + (Number(s.agirlik_kg) || 0), 0)
  const kontrolGerektirenler = fizikselStoklar.filter(s => s.aciklama)

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
        {[{ k: 'stok', l: 'Stok Listesi' }, { k: 'hareket', l: 'Hareketler' }, { k: 'ise-gore', l: 'Ise Gore Stok Durumu' }, { k: 'fiziksel', l: 'Fiziksel Depo (Konum)' }].map(t => (
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
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label>Ise bagla (opsiyonel)</label>
                  <select value={yeniHareket.proje_id} onChange={e => setYeniHareket(p => ({ ...p, proje_id: e.target.value }))}>
                    <option value="">Bagli degil (genel stok hareketi)</option>
                    {projeler.map(p => <option key={p.id} value={p.id}>{p.ad} ({p.proje_no})</option>)}
                  </select>
                </div>
                <div>
                  <label>Aciklama</label>
                  <input value={yeniHareket.aciklama} onChange={e => setYeniHareket(p => ({ ...p, aciklama: e.target.value }))} placeholder="Opsiyonel — sebep vb." />
                </div>
              </div>
              {msg && <p className={`text-sm mt-2 ${msg.startsWith('Hata') ? 'text-red-600' : 'text-green-600'}`}>{msg}</p>}
              <button onClick={hareketEkle} disabled={saving} className="btn btn-primary mt-3">Hareketi kaydet</button>
            </div>
          </div>

          <div className="card p-0 overflow-hidden">
            <table className="table-base">
              <thead><tr><th>Tarih</th><th>Malzeme / Lot</th><th>Tur</th><th>Miktar</th><th>Is</th><th>Aciklama</th></tr></thead>
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
                    <td className="text-gray-500 text-xs">{h.proje ? `${h.proje.ad} (${h.proje.proje_no})` : '—'}</td>
                    <td className="text-gray-500 text-xs">{h.aciklama || '—'}</td>
                  </tr>
                ))}
                {hareketler.length === 0 && <tr><td colSpan={6} className="text-center text-gray-400 py-8">Hareket kaydi yok</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'ise-gore' && (
        <div className="space-y-4">
          {(() => {
            const gruplu: Record<string, any[]> = {}
            for (const h of hareketler.filter(h => h.proje_id)) {
              const k = h.proje_id
              if (!gruplu[k]) gruplu[k] = []
              gruplu[k].push(h)
            }
            const projeIdler = Object.keys(gruplu)
            if (projeIdler.length === 0) {
              return <div className="card card-body text-center text-gray-400 text-sm py-10">Henuz hicbir stok hareketi bir ise baglanmamis. Hareketler sekmesinden yeni hareket eklerken "Ise bagla" alanini kullanin.</div>
            }
            return projeIdler.map(pid => {
              const hs = gruplu[pid]
              const proje = hs[0].proje
              const ozet: Record<string, { ad: string, giris: number, cikis: number, fire: number, rezerve: number }> = {}
              for (const h of hs) {
                const ad = h.stok?.malzeme?.ad || 'Bilinmeyen malzeme'
                if (!ozet[ad]) ozet[ad] = { ad, giris: 0, cikis: 0, fire: 0, rezerve: 0 }
                if (h.tur === 'giris') ozet[ad].giris += h.miktar_kg
                if (h.tur === 'cikis') ozet[ad].cikis += h.miktar_kg
                if (h.tur === 'fire') ozet[ad].fire += h.miktar_kg
                if (h.tur === 'rezerve') ozet[ad].rezerve += h.miktar_kg
              }
              return (
                <div key={pid} className="card p-0 overflow-hidden">
                  <div className="card-header bg-gray-50">
                    <span className="font-medium text-sm">{proje?.ad} <span className="text-gray-400 font-mono text-xs">({proje?.proje_no})</span></span>
                    <span className="text-xs text-gray-400">{hs.length} hareket</span>
                  </div>
                  <table className="table-base">
                    <thead><tr><th>Malzeme</th><th>Rezerve</th><th>Uretime sevk (cikis)</th><th>Fire</th></tr></thead>
                    <tbody>
                      {Object.values(ozet).map(o => (
                        <tr key={o.ad}>
                          <td className="font-medium">{o.ad}</td>
                          <td>{o.rezerve > 0 ? <span className="badge badge-amber">{o.rezerve.toFixed(1)} kg</span> : '—'}</td>
                          <td>{o.cikis > 0 ? <span className="badge badge-blue">{o.cikis.toFixed(1)} kg</span> : '—'}</td>
                          <td>{o.fire > 0 ? <span className="badge badge-red">{o.fire.toFixed(1)} kg</span> : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })
          })()}
        </div>
      )}

      {tab === 'fiziksel' && (
        <div className="space-y-4">
          <div className="card">
            <div className="card-header"><span className="font-medium text-sm">Excel'den ice aktar</span></div>
            <div className="card-body space-y-3">
              <p className="text-xs text-gray-500">
                Depo sayim Excel dosyanizi ("Konum, Palet, Durum, Malzeme, En (cm), Mikron / Yapi, Agirlik (kg), Aciklama" sutunlu "Tum Stoklar" sekmesi) secin.
                Onaylarsaniz, daha once Excel'den aktarilmis kayitlarin yerine yenileri gecer — elle girilen diger stok kayitlariniz etkilenmez.
              </p>
              <input type="file" accept=".xlsx,.xls" onChange={e => { const f = e.target.files?.[0]; if (f) excelDosyaOku(f) }} />
              {iceAktarYukleniyor && <p className="text-sm text-gray-400">Isleniyor...</p>}
              {iceAktarMsg && <p className={`text-sm ${iceAktarMsg.startsWith('Hata') || iceAktarMsg.startsWith('Beklenen') || iceAktarMsg.startsWith('Dosya okunamadi') ? 'text-red-600' : 'text-green-600'}`}>{iceAktarMsg}</p>}
              {iceAktarOnizleme && (
                <div className="bg-blue-50 rounded-lg px-4 py-3 text-sm space-y-2">
                  <div><strong>{iceAktarOnizleme.satir}</strong> satir okundu ve eslesti.</div>
                  {iceAktarOnizleme.eslesmeyen.length > 0 && (
                    <div className="text-amber-700">
                      Eslesmeyen malzeme adlari (bu satirlar aktarilmayacak): {iceAktarOnizleme.eslesmeyen.join(', ')}.
                      Once Malzemeler sayfasindan bu isimlerle bir malzeme tanimi ekleyip tekrar deneyin.
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={excelOnayla} disabled={iceAktarYukleniyor} className="btn btn-primary btn-sm">Onayla ve ice aktar</button>
                    <button onClick={() => setIceAktarOnizleme(null)} className="btn btn-sm">Vazgec</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {fizikselStoklar.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div className="card card-body">
                  <div className="text-xs text-gray-400 mb-1">Toplam kayit</div>
                  <div className="text-2xl font-semibold">{fizikselStoklar.length}</div>
                </div>
                <div className="card card-body">
                  <div className="text-xs text-gray-400 mb-1">Toplam bilinen stok</div>
                  <div className="text-2xl font-semibold">{fizikselToplamKg.toFixed(0)} kg</div>
                </div>
                <div className="card card-body">
                  <div className="text-xs text-gray-400 mb-1">Kontrol gerektiren kayit</div>
                  <div className={`text-2xl font-semibold ${kontrolGerektirenler.length > 0 ? 'text-amber-600' : ''}`}>{kontrolGerektirenler.length}</div>
                </div>
              </div>

              <div className="card">
                <div className="card-header"><span className="font-medium text-sm">Malzeme bazinda toplam</span></div>
                <div className="card-body">
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(fizikselMalzemeOzet).sort((a, b) => b[1] - a[1]).map(([ad, kg]) => (
                      <span key={ad} className="badge badge-blue">{ad}: {kg.toFixed(0)} kg</span>
                    ))}
                  </div>
                </div>
              </div>

              {kontrolGerektirenler.length > 0 && (
                <div className="card">
                  <div className="card-header bg-amber-50"><span className="font-medium text-sm text-amber-800">Kontrol gerektirenler ({kontrolGerektirenler.length})</span></div>
                  <div className="card-body">
                    <div className="space-y-1.5">
                      {kontrolGerektirenler.map(s => (
                        <div key={s.id} className="text-xs text-amber-800 flex gap-2">
                          <span className="font-mono text-amber-500">{s.konum} / {s.palet_no}</span>
                          <span>{s.malzeme?.ad}</span>
                          <span className="text-amber-600">— {s.aciklama}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <label className="!mb-0">Konuma gore filtrele:</label>
                <select className="!w-48" value={filtreKonum} onChange={e => setFiltreKonum(e.target.value)}>
                  <option value="">Tumu</option>
                  {konumlar.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>

              <div className="card p-0 overflow-hidden">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Konum</th><th>Palet</th><th>Durum</th><th>Malzeme</th>
                      <th>En</th><th>Mikron / Yapi</th><th>Agirlik (kg)</th><th>Aciklama</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fizikselGorunen.map(s => (
                      <tr key={s.id}>
                        <td className="font-mono text-xs">{s.konum}</td>
                        <td className="text-gray-500 text-xs">{s.palet_no}</td>
                        <td>{s.durum ? <span className="badge badge-gray text-xs">{s.durum}</span> : '—'}</td>
                        <td className="font-medium">{s.malzeme?.ad}</td>
                        <td>{s.en_mm ? (s.en_mm / 10) + ' cm' : '—'}</td>
                        <td>{s.mikron ? s.mikron + ' mic' : '—'}</td>
                        <td className="font-semibold">{Number(s.agirlik_kg).toFixed(0)}</td>
                        <td className="text-gray-400 text-xs">{s.aciklama || '—'}</td>
                      </tr>
                    ))}
                    {fizikselGorunen.length === 0 && <tr><td colSpan={8} className="text-center text-gray-400 py-8">Kayit yok</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {fizikselStoklar.length === 0 && !iceAktarOnizleme && (
            <div className="card card-body text-center text-gray-400 text-sm py-10">
              Henuz fiziksel depo verisi yok. Yukaridan Excel dosyanizi yukleyerek baslayin.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
