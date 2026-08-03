'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function MalzemellerPage() {
  const [malzemeler, setMalzemeler] = useState<any[]>([])
  const [fiyatlar, setFiyatlar] = useState<any[]>([])
  const [tedarikciler, setTedarikciler] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'malzeme'|'fiyat'|'tedarikci'>('malzeme')
  const [yeniFiyat, setYeniFiyat] = useState({malzeme_id:'', tedarikci_id:'', mikron:'0', birim_fiyat:'', para_birimi:'USD'})
  const [yeniMalzeme, setYeniMalzeme] = useState({ad:'', tur:'OPP', yogunluk:''})
  const [yeniTedarikci, setYeniTedarikci] = useState({ad:'', ulke:'Turkiye', para_birimi:'USD', odeme_vadesi_gun:'30'})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const MALZEME_TURLERI = ['OPP','BOPP','PET','CPP','LDPE','MDPE','ALU','MOPP','MPET','MATOPP','SEDEF_OPP','OPAK_OPP','PA','KAGIT','BOYA','TUTKAL','SOLVENT','ZIP','DIGER']

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data:m },{ data:f },{ data:t }] = await Promise.all([
      supabase.from('malzeme_tanim').select('*').order('tur').order('ad'),
      supabase.from('malzeme_fiyat').select('*, malzeme:malzeme_tanim(ad,tur), tedarikci:tedarikci_tanim(ad)').order('gecerlilik_tarihi', {ascending:false}),
      supabase.from('tedarikci_tanim').select('*').order('ad'),
    ])
    setMalzemeler(m||[]); setFiyatlar(f||[]); setTedarikciler(t||[])
    setLoading(false)
  }

  async function fiyatEkle() {
    setSaving(true); setMsg('')
    if (!yeniFiyat.malzeme_id || !yeniFiyat.birim_fiyat) { setMsg('Malzeme ve fiyat zorunlu.'); setSaving(false); return }
    const { error } = await supabase.from('malzeme_fiyat').insert({
      malzeme_id: yeniFiyat.malzeme_id,
      tedarikci_id: yeniFiyat.tedarikci_id || null,
      mikron: parseInt(yeniFiyat.mikron)||0,
      birim_fiyat: parseFloat(yeniFiyat.birim_fiyat),
      para_birimi: yeniFiyat.para_birimi,
      gecerlilik_tarihi: new Date().toISOString().split('T')[0],
    })
    if (!error) { setMsg('Fiyat eklendi.'); load(); setYeniFiyat({malzeme_id:'',tedarikci_id:'',mikron:'0',birim_fiyat:'',para_birimi:'USD'}) }
    else setMsg('Hata: '+error.message)
    setSaving(false)
  }

  async function malzemeEkle() {
    setSaving(true); setMsg('')
    if (!yeniMalzeme.ad) { setMsg('Malzeme adi zorunlu.'); setSaving(false); return }
    const { count } = await supabase.from('malzeme_tanim').select('id',{count:'exact',head:true})
    const { error } = await supabase.from('malzeme_tanim').insert({
      kod: yeniMalzeme.tur+'-'+(((count||0)+1)+'').padStart(3,'0'),
      ad: yeniMalzeme.ad, tur: yeniMalzeme.tur,
      yogunluk: parseFloat(yeniMalzeme.yogunluk)||null, aktif:true,
    })
    if (!error) { setMsg('Malzeme eklendi.'); load(); setYeniMalzeme({ad:'',tur:'OPP',yogunluk:''}) }
    else setMsg('Hata: '+error.message)
    setSaving(false)
  }

  async function tedarikcyiEkle() {
    setSaving(true); setMsg('')
    if (!yeniTedarikci.ad) { setMsg('Firma adi zorunlu.'); setSaving(false); return }
    const { count } = await supabase.from('tedarikci_tanim').select('id',{count:'exact',head:true})
    const { error } = await supabase.from('tedarikci_tanim').insert({
      kod: 'TED-'+(((count||0)+1)+'').padStart(3,'0'),
      ad: yeniTedarikci.ad, ulke: yeniTedarikci.ulke,
      para_birimi: yeniTedarikci.para_birimi,
      odeme_vadesi_gun: parseInt(yeniTedarikci.odeme_vadesi_gun)||30, aktif:true,
    })
    if (!error) { setMsg('Tedarikci eklendi.'); load(); setYeniTedarikci({ad:'',ulke:'Turkiye',para_birimi:'USD',odeme_vadesi_gun:'30'}) }
    else setMsg('Hata: '+error.message)
    setSaving(false)
  }

  // Son fiyatlar (malzeme+mikron kombinasyonu bazında en guncel)
  const sonFiyatlar = fiyatlar.reduce((acc: any[], f) => {
    const key = f.malzeme_id + '_' + f.mikron
    if (!acc.find(x => x.malzeme_id+'-'+x.mikron === f.malzeme_id+'-'+f.mikron)) acc.push(f)
    return acc
  }, [])

  if (loading) return <div className="p-8 text-gray-400 text-sm">Yukleniyor...</div>

  return (
    <div className="p-6">
      <div className="page-header">
        <h1 className="page-title">Malzeme & Fiyat Listesi</h1>
      </div>

      <div className="flex gap-2 mb-4 border-b border-gray-200 pb-0">
        {[
          {k:'fiyat', l:'Fiyat listesi'},
          {k:'malzeme', l:'Malzemeler'},
          {k:'tedarikci', l:'Tedarikciler'},
        ].map(t => (
          <button key={t.k} onClick={()=>{setTab(t.k as any);setMsg('')}}
            className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${tab===t.k ? 'border-blue-600 text-blue-600 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'fiyat' && (
        <div className="space-y-4">
          {/* Yeni fiyat ekle */}
          <div className="card">
            <div className="card-header"><span className="font-medium text-sm">Yeni fiyat ekle / guncelle</span></div>
            <div className="card-body">
              <div className="grid grid-cols-5 gap-3 items-end">
                <div className="col-span-2">
                  <label>Malzeme</label>
                  <select value={yeniFiyat.malzeme_id} onChange={e=>setYeniFiyat(p=>({...p,malzeme_id:e.target.value}))}>
                    <option value="">Secin...</option>
                    {malzemeler.map(m=><option key={m.id} value={m.id}>{m.ad}</option>)}
                  </select>
                </div>
                <div>
                  <label>Mikron (0=tumü)</label>
                  <input type="number" value={yeniFiyat.mikron} onChange={e=>setYeniFiyat(p=>({...p,mikron:e.target.value}))} />
                </div>
                <div>
                  <label>Fiyat (USD/kg)</label>
                  <input type="number" step="0.0001" value={yeniFiyat.birim_fiyat}
                    onChange={e=>setYeniFiyat(p=>({...p,birim_fiyat:e.target.value}))} placeholder="3.2700" />
                </div>
                <div>
                  <label>Tedarikci</label>
                  <select value={yeniFiyat.tedarikci_id} onChange={e=>setYeniFiyat(p=>({...p,tedarikci_id:e.target.value}))}>
                    <option value="">Genel</option>
                    {tedarikciler.map(t=><option key={t.id} value={t.id}>{t.ad}</option>)}
                  </select>
                </div>
              </div>
              {msg && <p className={`text-sm mt-2 ${msg.startsWith('Hata')?'text-red-600':'text-green-600'}`}>{msg}</p>}
              <button onClick={fiyatEkle} disabled={saving} className="btn btn-primary mt-3">
                {saving?'Ekleniyor...':'Fiyat ekle'}
              </button>
            </div>
          </div>

          {/* Fiyat tablosu */}
          <div className="card p-0 overflow-hidden">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Malzeme</th>
                  <th>Mikron</th>
                  <th>Fiyat</th>
                  <th>Para birimi</th>
                  <th>Tedarikci</th>
                  <th>Tarih</th>
                </tr>
              </thead>
              <tbody>
                {sonFiyatlar.map(f=>(
                  <tr key={f.id}>
                    <td className="font-medium">{f.malzeme?.ad}</td>
                    <td>{f.mikron > 0 ? f.mikron+' mic' : 'Tumu'}</td>
                    <td className="font-semibold text-green-700">${parseFloat(f.birim_fiyat).toFixed(4)}</td>
                    <td>{f.para_birimi}</td>
                    <td className="text-gray-500">{f.tedarikci?.ad || 'Genel'}</td>
                    <td className="text-gray-400 text-xs">{new Date(f.gecerlilik_tarihi).toLocaleDateString('tr-TR')}</td>
                  </tr>
                ))}
                {sonFiyatlar.length===0 && <tr><td colSpan={6} className="text-center text-gray-400 py-8">Henuz fiyat girilmemis</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'malzeme' && (
        <div className="space-y-4">
          <div className="card">
            <div className="card-header"><span className="font-medium text-sm">Yeni malzeme ekle</span></div>
            <div className="card-body">
              <div className="grid grid-cols-4 gap-3 items-end">
                <div className="col-span-2">
                  <label>Malzeme adi</label>
                  <input value={yeniMalzeme.ad} onChange={e=>setYeniMalzeme(p=>({...p,ad:e.target.value}))} placeholder="OPP 20mic Seffaf" />
                </div>
                <div>
                  <label>Turu</label>
                  <select value={yeniMalzeme.tur} onChange={e=>setYeniMalzeme(p=>({...p,tur:e.target.value}))}>
                    {MALZEME_TURLERI.map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label>Yogunluk (g/cm3)</label>
                  <input type="number" step="0.001" value={yeniMalzeme.yogunluk}
                    onChange={e=>setYeniMalzeme(p=>({...p,yogunluk:e.target.value}))} placeholder="0.910" />
                </div>
              </div>
              {msg && <p className={`text-sm mt-2 ${msg.startsWith('Hata')?'text-red-600':'text-green-600'}`}>{msg}</p>}
              <button onClick={malzemeEkle} disabled={saving} className="btn btn-primary mt-3">Malzeme ekle</button>
            </div>
          </div>
          <div className="card p-0 overflow-hidden">
            <table className="table-base">
              <thead><tr><th>Ad</th><th>Tur</th><th>Yogunluk</th><th>Durum</th></tr></thead>
              <tbody>
                {malzemeler.map(m=>(
                  <tr key={m.id}>
                    <td className="font-medium">{m.ad}</td>
                    <td><span className="badge badge-blue">{m.tur}</span></td>
                    <td className="text-gray-500">{m.yogunluk ? m.yogunluk+' g/cm3' : '—'}</td>
                    <td><span className={`badge ${m.aktif?'badge-green':'badge-gray'}`}>{m.aktif?'Aktif':'Pasif'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'tedarikci' && (
        <div className="space-y-4">
          <div className="card">
            <div className="card-header"><span className="font-medium text-sm">Yeni tedarikci ekle</span></div>
            <div className="card-body">
              <div className="grid grid-cols-4 gap-3 items-end">
                <div className="col-span-2">
                  <label>Firma adi</label>
                  <input value={yeniTedarikci.ad} onChange={e=>setYeniTedarikci(p=>({...p,ad:e.target.value}))} placeholder="Polinas A.S." />
                </div>
                <div>
                  <label>Para birimi</label>
                  <select value={yeniTedarikci.para_birimi} onChange={e=>setYeniTedarikci(p=>({...p,para_birimi:e.target.value}))}>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="TRY">TRY</option>
                  </select>
                </div>
                <div>
                  <label>Vade (gun)</label>
                  <input type="number" value={yeniTedarikci.odeme_vadesi_gun} onChange={e=>setYeniTedarikci(p=>({...p,odeme_vadesi_gun:e.target.value}))} />
                </div>
              </div>
              {msg && <p className={`text-sm mt-2 ${msg.startsWith('Hata')?'text-red-600':'text-green-600'}`}>{msg}</p>}
              <button onClick={tedarikcyiEkle} disabled={saving} className="btn btn-primary mt-3">Tedarikci ekle</button>
            </div>
          </div>
          <div className="card p-0 overflow-hidden">
            <table className="table-base">
              <thead><tr><th>Firma</th><th>Ulke</th><th>Para birimi</th><th>Vade</th></tr></thead>
              <tbody>
                {tedarikciler.map(t=>(
                  <tr key={t.id}>
                    <td className="font-medium">{t.ad}</td>
                    <td className="text-gray-500">{t.ulke}</td>
                    <td>{t.para_birimi}</td>
                    <td className="text-gray-500">{t.odeme_vadesi_gun} gun</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
