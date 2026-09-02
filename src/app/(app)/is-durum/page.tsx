'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ADIM_LABEL } from '@/lib/uretimAkis'

// Is Durum Takibi: bir siparisin (proje) her uretim adiminda hedeflenen
// kg/metre ile gerceklesen kg/metre'yi yan yana gosterir. Boylece
// "500 kg hedeflemistim, 450 kg cikti, aradaki 50 kg nerede kayboldu"
// sorusuna ekran uzerinden cevap aranabilir. Iki arama modu var:
//  - Kod/isim: tek bir siparisin tum adimlarini gormek icin.
//  - Tarih araligi: o araliktaki tum is emirlerini (butun siparisler
//    genelinde) topluca gormek icin.

type Mod = 'kod' | 'tarih'

function kayipRengi(hedef: number | null, gerc: number | null, tamamlandi: boolean): string {
  if (hedef == null || hedef <= 0) return ''
  if (!tamamlandi) return ''
  if (gerc == null) return 'text-gray-400'
  const oran = gerc / hedef
  if (oran >= 0.97) return 'text-green-600'
  if (oran >= 0.9) return 'text-amber-600'
  return 'text-red-600'
}

export default function IsDurumPage() {
  const [mod, setMod] = useState<Mod>('kod')
  const [arama, setArama] = useState('')
  const [projeSonuclari, setProjeSonuclari] = useState<any[]>([])
  const [secilenProjeler, setSecilenProjeler] = useState<any[]>([])
  const [baslangic, setBaslangic] = useState('')
  const [bitis, setBitis] = useState('')
  const [satirlar, setSatirlar] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (mod !== 'kod') return
    const t = setTimeout(() => { if (arama.trim().length >= 2) { projeAra() } else { setProjeSonuclari([]) } }, 300)
    return () => clearTimeout(t)
  }, [arama, mod])

  async function projeAra() {
    const { data } = await supabase.from('proje').select('id, proje_no, ad, musteri:musteri_tanim(ad)')
      .or(`proje_no.ilike.%${arama}%,ad.ilike.%${arama}%`).order('olusturma', { ascending: false }).limit(15)
    setProjeSonuclari(data || [])
  }

  async function projeSecVeYukle(proje: any) {
    setSecilenProjeler([proje])
    setProjeSonuclari([])
    setArama('')
    await satirlariYukle([proje.id])
  }

  async function tarihAraligindaAra() {
    if (!baslangic || !bitis) return
    setLoading(true)
    const { data: planlar } = await supabase.from('uretim_plani').select('proje_id, proje:proje(id,proje_no,ad,musteri:musteri_tanim(ad))')
      .gte('planlanan_tarih', baslangic).lte('planlanan_tarih', bitis)
    const projeMap: Record<string, any> = {}
    for (const p of (planlar || [])) if (p.proje_id && !projeMap[p.proje_id]) projeMap[p.proje_id] = p.proje
    const projeler = Object.values(projeMap)
    setSecilenProjeler(projeler)
    await satirlariYukle(projeler.map((p: any) => p.id))
  }

  async function satirlariYukle(projeIdler: string[]) {
    setLoading(true)
    if (projeIdler.length === 0) { setSatirlar([]); setLoading(false); return }
    const [{ data: planlar }, { data: adimlar }] = await Promise.all([
      supabase.from('uretim_plani').select('*, proje:proje(proje_no,ad,musteri:musteri_tanim(ad))').in('proje_id', projeIdler).order('adim_sira'),
      supabase.from('uretim_adim').select('*').in('proje_id', projeIdler),
    ])
    const adimMap: Record<string, any> = {}
    for (const a of (adimlar || [])) { if (!adimMap[a.plan_id] || (a.bitis && !adimMap[a.plan_id].bitis)) adimMap[a.plan_id] = a }
    const zengin = (planlar || []).map((p: any) => ({ ...p, gerc: adimMap[p.id] || null }))
    setSatirlar(zengin)
    setLoading(false)
  }

  const gruplu: Record<string, any[]> = {}
  for (const s of satirlar) {
    const k = s.proje_id
    if (!gruplu[k]) gruplu[k] = []
    gruplu[k].push(s)
  }

  return (
    <div className="p-6">
      <div className="page-header">
        <h1 className="page-title">Is Durum Takibi</h1>
      </div>

      <div className="flex gap-0 mb-4 border-b border-gray-200">
        {[{ k: 'kod', l: 'Kod / isim ile ara' }, { k: 'tarih', l: 'Tarih araligi' }].map(t => (
          <button key={t.k} onClick={() => { setMod(t.k as Mod); setSatirlar([]); setSecilenProjeler([]) }}
            className={`px-5 py-2.5 text-sm border-b-2 -mb-px transition-colors ${mod === t.k ? 'border-blue-600 text-blue-600 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {mod === 'kod' && (
        <div className="relative max-w-md mb-6">
          <input value={arama} onChange={e => setArama(e.target.value)}
            placeholder="Proje no veya is adiyla ara..." />
          {projeSonuclari.length > 0 && (
            <div className="absolute z-10 mt-1 w-full card p-0 max-h-72 overflow-y-auto shadow-lg">
              {projeSonuclari.map(p => (
                <button key={p.id} onClick={() => projeSecVeYukle(p)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0">
                  <div className="text-sm font-medium">{p.ad} <span className="text-gray-400 font-mono text-xs">({p.proje_no})</span></div>
                  <div className="text-xs text-gray-400">{p.musteri?.ad}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {mod === 'tarih' && (
        <div className="flex items-end gap-2 mb-6">
          <div>
            <label className="!text-xs">Baslangic</label>
            <input type="date" value={baslangic} onChange={e => setBaslangic(e.target.value)} />
          </div>
          <div>
            <label className="!text-xs">Bitis</label>
            <input type="date" value={bitis} onChange={e => setBitis(e.target.value)} />
          </div>
          <button onClick={tarihAraligindaAra} disabled={!baslangic || !bitis} className="btn btn-primary">Ara</button>
        </div>
      )}

      {loading && <div className="text-gray-400 text-sm">Yukleniyor...</div>}

      {!loading && secilenProjeler.length === 0 && (
        <div className="card card-body text-center text-gray-400 text-sm py-12">
          {mod === 'kod' ? 'Bir proje arayip secin' : 'Bir tarih araligi secip arayin'}
        </div>
      )}

      {!loading && Object.keys(gruplu).length > 0 && (
        <div className="space-y-4">
          {Object.entries(gruplu).map(([projeId, adimlar]) => {
            const p = adimlar[0].proje
            return (
              <div key={projeId} className="card p-0 overflow-hidden">
                <div className="card-header bg-gray-50">
                  <span className="font-medium text-sm">{p?.ad} <span className="text-gray-400 font-mono text-xs">({p?.proje_no})</span></span>
                  <span className="text-xs text-gray-400">{p?.musteri?.ad}</span>
                </div>
                <table className="table-base">
                  <thead>
                    <tr><th>#</th><th>Adim</th><th>Durum</th><th>Hedef kg</th><th>Gerc. kg</th><th>Hedef m</th><th>Gerc. m</th><th>Fark</th></tr>
                  </thead>
                  <tbody>
                    {adimlar.sort((a, b) => a.adim_sira - b.adim_sira).map(a => {
                      const g = a.gerc
                      const tamam = a.durum === 'tamamlandi'
                      const kgRenk = kayipRengi(a.hedef_kg, g?.uretilen_kg ?? null, tamam)
                      const mRenk = kayipRengi(a.hedef_metre, g?.uretilen_metre ?? null, tamam)
                      const kgFark = (a.hedef_kg != null && g?.uretilen_kg != null) ? (g.uretilen_kg - a.hedef_kg) : null
                      return (
                        <tr key={a.id}>
                          <td className="text-gray-400">{a.adim_sira}</td>
                          <td className="font-medium">{ADIM_LABEL[a.adim_tur] || a.adim_tur}</td>
                          <td><span className={`badge ${a.durum === 'tamamlandi' ? 'badge-green' : a.durum === 'calisiyor' ? 'badge-amber' : 'badge-gray'}`}>{a.durum}</span></td>
                          <td className="text-gray-500">{a.hedef_kg != null ? `${a.hedef_kg} kg` : '—'}</td>
                          <td className={kgRenk || 'text-gray-500'}>{g?.uretilen_kg != null ? `${g.uretilen_kg} kg` : '—'}</td>
                          <td className="text-gray-500">{a.hedef_metre != null ? `${a.hedef_metre} m` : '—'}</td>
                          <td className={mRenk || 'text-gray-500'}>{g?.uretilen_metre != null ? `${g.uretilen_metre} m` : '—'}</td>
                          <td className={kgFark != null ? (kgFark < 0 ? 'text-red-600' : 'text-green-600') : 'text-gray-300'}>
                            {kgFark != null ? `${kgFark > 0 ? '+' : ''}${kgFark.toFixed(1)} kg` : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
