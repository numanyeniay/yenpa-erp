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
  const [duzenle, setDuzenle] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const MALZEME_TURLERI = ['OPP','BOPP','PET','CPP','LDPE','MDPE','ALU','MOPP','MPET','MATOPP','SEDEF_OPP','OPAK_OPP','PA','KAGIT','BOYA','TUTKAL','SOLVENT','ZIP','DIGER']

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data:m },{ data:f },{ data:t }] = await Promise.all([
      supabase.from('malzeme_tanim').select('*').order('ad'),
      supabase.from('malzeme_fiyat').select('*, malzeme:malzeme_tanim(ad,tur), tedarikci:tedarikci_tanim(ad)').order('gecerlilik_tarihi', {ascending:false}),
      supabase.from('tedarikci_tanim').select('*').order('ad'),
    ])
    setMalzemeler(m||[]); setFiyatlar(f||[]); setTedarikciler(t||[])
    setLoading(false)
  }

  async function fiyatEkle() {
    setSaving(true); setMsg('')
    if (!yeniFiyat.malzeme_id || !yeniFiyat.birim_fiyat) { setMsg('Malzeme ve fiyat zorunlu.'); setSaving(false); return }
    await supabase.from('malzeme_fiyat').insert({
      malzeme_id: yeniFiyat.malzeme_id,
      tedarikci_id: yeniFiyat.tedarikci_id || null,
      mikron: parseInt(yeniFiyat.mikron)||0,
      birim_fiyat: parseFloat(yeniFiyat.birim_fiyat),
      para_birimi: yeniFiyat.para_birimi,
      gecerlilik_tarihi: new Date().toISOString().split('T')[0],
    })
    setMsg('Fiyat eklendi.'); load()
    setYeniFiyat({malzeme_id:'',tedarikci_id:'',mikron:'0',birim_fiyat:'',para_birimi:'USD'})
    setSaving(false)
  }

  async function fiyatSil(id: string) {
    if (!confirm('Bu fiyat kaydini silmek istediginizden emin misiniz?')) return
    await supabase.from('malzeme_fiyat').delete().eq('id', id)
    load()
  }

  async function malzemeEkle() {
    setSaving(true); setMsg('')
    if (!yeniMalzeme.ad) { setMsg('Malzeme adi zorunlu.'); setSaving(false); return }
    const { count } = await supabase.from('malzeme_tanim').select('id',{count:'exact',head:true})
    await supabase.from('malzeme_tanim').insert({
      kod: yeniMalzeme.tur+'-'+(((count||0)+1)+'').padStart(3,'0'),
      ad: yeniMalzeme.ad, tur: yeniMalzeme.tur,
      yogunluk: parseFloat(yeniMalzeme.yogunluk)||null, aktif:true,
    })
    setMsg('Malzeme eklendi.'); load()
    setYeniMalzeme({ad:'',tur:'OPP',yogunluk:''})
    setSaving(false)
  }

  async function malzemeGuncelle() {
    if (!duzenle) return
    setSaving(true)
    await supabase.from('malzeme_tanim').update({
      ad: duzenle.ad, tur: duzenle.tur,
      yogunluk: parseFloat(duzenle.yogunluk)||null,
    }).eq('id', duzenle.id)
    setDuzenle(null); load(); setSaving(false)
    setMsg('Malzeme guncellendi.')
  }

  async function malzemeSil(id: string, ad: string) {
    if (!confirm(`"${ad}" malzemesini silmek istediginizden emin misiniz? Bu islem geri alinamaz.`)) return
    await supabase.from('malzeme_tanim').update({ aktif: false }).eq('id', id)
    load()
    setMsg('Malzeme pasife alindi.')
  }

  async function tedarikcyiEkle() {
    setSaving(true); setMsg('')
    if (!yeniTedarikci.ad) { setMsg('Firma adi zorunlu.'); setSaving(false); return }
    const { count } = await supabase.from('tedarikci_tanim').select('id',{count:'exact',head:true})
    await supabase.from('tedarikci_tanim').insert({
      kod: 'TED-'+(((count||0)+1)+'').padStart(3,'0'),
      ad: yeniTedarikci.ad, ulke: yeniTedarikci.ulke,
      para_birimi: yeniTedarikci.para_birimi,
      odeme_vadesi_gun: parseInt(yeniTedarikci.odeme_vadesi_gun)||30, aktif:true,
    })
    setMsg('Tedarikci eklendi.'); load()
    setYeniTedarikci({ad:'',ulke:'Turkiye',para_birimi:'USD',odeme_vadesi_gun:'30'})
    setSaving(false)
  }

  async function tedarikcySil(id: string) {
    if (!confirm('Bu tedarikcıyi silmek istediginizden emin misiniz?')) return
    await supabase.from('tedarikci_tanim').update({ aktif: false }).eq('id', id)
    load()
  }

  const sonFiyatlar = fiyatlar.reduce((acc: any[], f) => {
    const key = f.malzeme_id + '_' + f.mikron
    if (!acc.find((x:any) => x.malzeme_id+'_'+x.mikron === key)) acc.push(f)
    return acc
  }, [])

  if (loading) return <div className="p-8 text-gray-400 text-sm">Yukleniyor...</div>

  return (
    <div className="p-6">
      <div className="page-header">
        <h1 className="page-title">Malzeme & Fiyat Listesi</h1>
      </div>

      <div className="flex gap-0 mb-6 border-b border-gray-200">
        {[
          {k:'fiyat', l:'Fiyat listesi'},
          {k:'malzeme', l:'Malzemeler'},
          {k:'tedarikci', l:'Tedarikciler'},
        ].map(t => (
          <button key={t.k} onClick={()=>{setTab(t.k as any);setMsg('');setDuzenle(null)}}
            className={`px-5 py-2.5 text-sm border-b-2 -mb-px transition-colors ${tab===t.k ? 'border-blue-600 text-blue-600 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {/* FIYAT LISTESI */}
      {tab === 'fiyat' && (
        <div className="space-y-4">
          <div className="card">
            <div className="card-header"><span className="font-medium text-sm">Yeni fiyat ekle / guncelle</span></div>
            <div className="card-body">
              <div className="grid grid-cols-5 gap-3 items-end">
                <div className="col-span-2">
                  <label>Malzeme</label>
                  <select value={yeniFiyat.malzeme_id} onChange={e=>setYeniFiyat(p=>({...p,malzeme_id:e.target.value}))}>
                    <option value="">Secin...</option>
                    {malzemeler.filter(m=>m.aktif).map(m=><option key={m.id} value={m.id}>{m.ad}</option>)}
                  </select>
                </div>
                <div>
                  <label>Mikron (0=tumu)</label>
                  <input type="number" value={yeniFiyat.mikron} onChange={e=>setYeniFiyat(p=>({...p,mikron:e.target.value}))} />
                </div>
                <div>
                  <label>Fiyat ($/kg)</label>
                  <input type="number" step="0.0001" value={yeniFiyat.birim_fiyat} onChange={e=>setYeniFiyat(p=>({...p,birim_fiyat:e.target.value}))} placeholder="3.2700" />
                </div>
                <div>
                  <label>Tedarikci</label>
                  <select value={yeniFiyat.tedarikci_id} onChange={e=>setYeniFiyat(p=>({...p,tedarikci_id:e.target.value}))}>
                    <option value="">Genel</option>
                    {tedarikciler.filter(t=>t.aktif).map(t=><option key={t.id} value={t.id}>{t.ad}</option>)}
                  </select>
                </div>
              </div>
              {msg && <p className={`text-sm mt-2 ${msg.startsWith('Hata')?'text-red-600':'text-green-600'}`}>{msg}</p>}
              <button onClick={fiyatEkle} disabled={saving} className="btn btn-primary mt-3">Fiyat ekle</button>
            </div>
          </div>

          <div className="card p-0 overflow-hidden">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Malzeme</th><th>Mikron</th><th>Fiyat</th>
                  <th>Para birimi</th><th>Tedarikci</th><th>Tarih</th><th>Islem</th>
                </tr>
              </thead>
              <tbody>
                {sonFiyatlar.map((f:any)=>(
                  <tr key={f.id}>
                    <td className="font-medium">{f.malzeme?.ad}</td>
                    <td>{f.mikron > 0 ? f.mikron+' mic' : 'Tumu'}</td>
                    <td className="font-semibold text-green-700">${parseFloat(f.birim_fiyat).toFixed(4)}</td>
                    <td>{f.para_birimi}</td>
                    <td className="text-gray-500">{f.tedarikci?.ad || 'Genel'}</td>
                    <td className="text-gray-400 text-xs">{new Date(f.gecerlilik_tarihi).toLocaleDateString('tr-TR')}</td>
                    <td>
                      <button onClick={()=>fiyatSil(f.id)} className="btn btn-sm btn-danger">Sil</button>
                    </td>
                  </tr>
                ))}
                {sonFiyatlar.length===0 && <tr><td colSpan={7} className="text-center text-gray-400 py-8">Henuz fiyat girilmemis</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MALZEMELER */}
      {tab === 'malzeme' && (
        <div className="space-y-4">
          {/* Duzenleme modali */}
          {duzenle && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
                <div className="font-semibold text-gray-900 mb-4">Malzeme duzenle</div>
                <div className="space-y-3">
                  <div>
                    <label>Malzeme adi</label>
                    <input value={duzenle.ad} onChange={e=>setDuzenle((p:any)=>({...p,ad:e.target.value}))} />
                  </div>
                  <div>
                    <label>Tur</label>
                    <select value={duzenle.tur} onChange={e=>setDuzenle((p:any)=>({...p,tur:e.target.value}))}>
                      {MALZEME_TURLERI.map(t=><option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label>Yogunluk (g/cm3)</label>
                    <input type="number" step="0.001" value={duzenle.yogunluk||''} onChange={e=>setDuzenle((p:any)=>({...p,yogunluk:e.target.value}))} />
                  </div>
                </div>
                <div className="flex gap-3 mt-5">
                  <button onClick={malzemeGuncelle} disabled={saving} className="btn btn-primary flex-1 justify-center">Kaydet</button>
                  <button onClick={()=>setDuzenle(null)} className="btn flex-1 justify-center">Iptal</button>
                </div>
              </div>
            </div>
          )}

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
                  <input type="number" step="0.001" value={yeniMalzeme.yogunluk} onChange={e=>setYeniMalzeme(p=>({...p,yogunluk:e.target.value}))} placeholder="0.910" />
                </div>
              </div>
              {msg && <p className={`text-sm mt-2 ${msg.startsWith('Hata')?'text-red-600':'text-green-600'}`}>{msg}</p>}
              <button onClick={malzemeEkle} disabled={saving} className="btn btn-primary mt-3">Malzeme ekle</button>
            </div>
          </div>

          <div className="card p-0 overflow-hidden">
            <table className="table-base">
              <thead><tr><th>Ad</th><th>Tur</th><th>Yogunluk</th><th>Durum</th><th>Islem</th></tr></thead>
              <tbody>
                {malzemeler.map(m=>(
                  <tr key={m.id}>
                    <td className="font-medium">{m.ad}</td>
                    <td><span className="badge badge-blue">{m.tur}</span></td>
                    <td className="text-gray-500">{m.yogunluk ? m.yogunluk+' g/cm3' : '—'}</td>
                    <td><span className={`badge ${m.aktif?'badge-green':'badge-gray'}`}>{m.aktif?'Aktif':'Pasif'}</span></td>
                    <td>
                      <div className="flex gap-2">
                        <button onClick={()=>setDuzenle({...m})} className="btn btn-sm">Duzenle</button>
                        {m.aktif && (
                          <button onClick={()=>malzemeSil(m.id, m.ad)} className="btn btn-sm btn-danger">Pasife al</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TEDARIKCILER */}
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
              <thead><tr><th>Firma</th><th>Ulke</th><th>Para birimi</th><th>Vade</th><th>Durum</th><th>Islem</th></tr></thead>
              <tbody>
                {tedarikciler.map(t=>(
                  <tr key={t.id}>
                    <td className="font-medium">{t.ad}</td>
                    <td className="text-gray-500">{t.ulke}</td>
                    <td>{t.para_birimi}</td>
                    <td className="text-gray-500">{t.odeme_vadesi_gun} gun</td>
                    <td><span className={`badge ${t.aktif?'badge-green':'badge-gray'}`}>{t.aktif?'Aktif':'Pasif'}</span></td>
                    <td>
                      {t.aktif && (
                        <button onClick={()=>tedarikcySil(t.id)} className="btn btn-sm btn-danger">Pasife al</button>
                      )}
                    </td>
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
