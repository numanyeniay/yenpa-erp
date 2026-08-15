'use client'
import { useEffect, useState } from 'react'
import { supabase, yeniPlanNo } from '@/lib/supabase'
import { projeRotasiHesapla, type AdimTur } from '@/types'
import Link from 'next/link'

const ADIM_LABEL: Record<string, string> = {
  baski: 'Baski', laminasyon_1: 'Laminasyon 1', laminasyon_2: 'Laminasyon 2', laminasyon_3: 'Laminasyon 3',
  kurleme_1: 'Kurleme 1', kurleme_2: 'Kurleme 2', kurleme_3: 'Kurleme 3',
  dilimleme: 'Dilimleme', katlama: 'Katlama', yan_kesim: 'Yan Kesim',
  doypack: 'Doypack', quadro: 'Quadro', flat_bottom: 'Flat Bottom',
  sirt_kaynak: 'Sirt Kaynak', sonic: 'Sonic', diger: 'Diger',
}
// adim_tur -> makine_tanim.tur eslesmesi (kurleme'nin makinesi yok, sadece bekleme suresi)
const ADIM_MAKINE_TUR: Record<string, string | null> = {
  baski: 'baski', laminasyon_1: 'laminasyon', laminasyon_2: 'laminasyon', laminasyon_3: 'laminasyon',
  kurleme_1: null, kurleme_2: null, kurleme_3: null,
  dilimleme: 'dilimleme', katlama: 'katlama', yan_kesim: 'yan_kesim',
  doypack: 'doypack', quadro: 'quadro', flat_bottom: 'flat_bottom',
  sirt_kaynak: 'sirt_kaynak', sonic: 'sonic', diger: 'diger',
}
const DURUM_SIRA = ['bekliyor', 'hazir', 'calisiyor', 'durustu', 'tamamlandi']
const DURUM_BADGE: Record<string, string> = {
  bekliyor: 'badge-gray', hazir: 'badge-blue', calisiyor: 'badge-amber',
  durustu: 'badge-red', tamamlandi: 'badge-green', iptal: 'badge-red',
}

export default function PlanlamaPage() {
  const [ustTab, setUstTab] = useState<'plan'|'makine'>('plan')
  const [onayliProjeler, setOnayliProjeler] = useState<any[]>([])
  const [planlar, setPlanlar] = useState<any[]>([])
  const [makineler, setMakineler] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [olusturuluyor, setOlusturuluyor] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: projeler }, { data: plani }, { data: mak }] = await Promise.all([
      supabase.from('proje').select('*, musteri:musteri_tanim(ad)').eq('durum', 'musteri_onayladi').order('olusturma'),
      supabase.from('uretim_plani').select('*, proje:proje(proje_no,ad,cikti_turu), makine:makine_tanim(ad,tur,fason)').order('planlanan_tarih', { ascending: true, nullsFirst: false }),
      supabase.from('makine_tanim').select('*').eq('aktif', true).order('kod'),
    ])
    // Halihazirda plani olan proje id'leri
    const planiOlanIdler = new Set((plani || []).map((p: any) => p.proje_id))
    setOnayliProjeler((projeler || []).filter(p => !planiOlanIdler.has(p.id)))
    setPlanlar(plani || [])
    setMakineler(mak || [])
    setLoading(false)
  }

  async function planOlustur(proje: any) {
    setOlusturuluyor(proje.id); setMsg('')
    const { data: katmanlar } = await supabase.from('proje_katman').select('*').eq('proje_id', proje.id).order('sira')
    if (!katmanlar || katmanlar.length === 0) {
      setMsg(`Hata: ${proje.proje_no} icin katman tanimi yok, once fiyatlama sayfasindan katmanlari girin.`)
      setOlusturuluyor(null); return
    }
    const adimlar: AdimTur[] = projeRotasiHesapla(proje, katmanlar as any)
    const rows = []
    for (let i = 0; i < adimlar.length; i++) {
      const adim = adimlar[i]
      const makineTur = ADIM_MAKINE_TUR[adim]
      const uygunMakine = makineTur ? makineler.find(m => m.tur === makineTur && !m.fason) || makineler.find(m => m.tur === makineTur) : null
      const plan_no = await yeniPlanNo()
      rows.push({
        plan_no, proje_id: proje.id, makine_id: uygunMakine?.id || null,
        adim_sira: i + 1, adim_tur: adim, durum: 'bekliyor',
      })
    }
    const { error } = await supabase.from('uretim_plani').insert(rows)
    if (error) { setMsg('Hata: ' + error.message); setOlusturuluyor(null); return }
    setMsg(`${proje.proje_no} icin ${rows.length} adimlik plan olusturuldu.`)
    load()
    setOlusturuluyor(null)
  }

  async function alanGuncelle(id: string, patch: any) {
    await supabase.from('uretim_plani').update(patch).eq('id', id)
    load()
  }

  async function durumIlerlet(plan: any) {
    const idx = DURUM_SIRA.indexOf(plan.durum)
    const yeni = DURUM_SIRA[Math.min(idx + 1, DURUM_SIRA.length - 1)]
    await alanGuncelle(plan.id, { durum: yeni })
  }

  // Plan satirlarini proje bazinda grupla
  const gruplu: Record<string, any[]> = {}
  for (const p of planlar) {
    const k = p.proje_id
    if (!gruplu[k]) gruplu[k] = []
    gruplu[k].push(p)
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Yukleniyor...</div>

  return (
    <div className="p-6">
      <div className="page-header">
        <h1 className="page-title">Uretim Planlama</h1>
      </div>

      <div className="flex gap-0 mb-6 border-b border-gray-200">
        {[{ k: 'plan', l: 'Plan' }, { k: 'makine', l: 'Makine Parkuru' }].map(t => (
          <button key={t.k} onClick={() => setUstTab(t.k as any)}
            className={`px-5 py-2.5 text-sm border-b-2 -mb-px transition-colors ${ustTab === t.k ? 'border-blue-600 text-blue-600 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {ustTab === 'makine' && (
        <div className="grid grid-cols-3 gap-4">
          {makineler.map(m => {
            const bekleyenAdimlar = planlar.filter(p => p.makine_id === m.id && !['tamamlandi', 'iptal'].includes(p.durum))
            const toplamDk = bekleyenAdimlar.reduce((t, p) => t + (p.planlanan_sure_dk || 0), 0)
            const kapasite = m.gunluk_kapasite_dk || 540
            const dolulukGun = toplamDk / kapasite
            const dolulukPct = Math.min(100, Math.round((toplamDk / kapasite) * 100))
            const renk = dolulukGun > 2 ? 'bg-red-500' : dolulukGun > 1 ? 'bg-amber-500' : 'bg-green-500'
            const calisanVar = bekleyenAdimlar.some(p => p.durum === 'calisiyor')
            return (
              <div key={m.id} className="card card-body">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold text-sm">{m.ad}</div>
                    <div className="text-xs text-gray-400">{m.tur}{m.fason ? ' · fason' : ''}</div>
                  </div>
                  <span className={`badge ${calisanVar ? 'badge-amber' : 'badge-green'}`}>{calisanVar ? 'Calisiyor' : 'Musait'}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>Bekleyen is</span><span className="font-semibold text-gray-900">{bekleyenAdimlar.length}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>Planlanan sure</span><span className="font-semibold text-gray-900">{toplamDk} dk</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 mt-2 mb-1 overflow-hidden">
                  <div className={`h-2 rounded-full ${renk}`} style={{ width: `${dolulukPct}%` }} />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Doluluk (gunluk kapasiteye gore)</span>
                  <span className="font-medium text-gray-700">{dolulukGun.toFixed(1)} gun</span>
                </div>
              </div>
            )
          })}
          {makineler.length === 0 && <div className="col-span-3 card card-body text-center text-gray-400 text-sm py-10">Makine tanimi yok</div>}
        </div>
      )}

      {ustTab === 'plan' && <>
      {onayliProjeler.length > 0 && (
        <div className="card mb-6">
          <div className="card-header"><span className="font-medium text-sm">Plani olusturulmamis onayli projeler ({onayliProjeler.length})</span></div>
          <div className="card-body space-y-2">
            {onayliProjeler.map(p => (
              <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-amber-50 border border-amber-100">
                <div>
                  <span className="font-medium text-sm">{p.ad}</span>
                  <span className="text-xs text-gray-500 ml-2">{p.musteri?.ad} · <span className="font-mono">{p.proje_no}</span> · {p.cikti_turu}</span>
                </div>
                <button onClick={() => planOlustur(p)} disabled={olusturuluyor === p.id} className="btn btn-sm btn-primary">
                  {olusturuluyor === p.id ? 'Olusturuluyor...' : 'Plan olustur'}
                </button>
              </div>
            ))}
            {msg && <p className={`text-sm mt-2 ${msg.startsWith('Hata') ? 'text-red-600' : 'text-green-600'}`}>{msg}</p>}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {Object.entries(gruplu).map(([projeId, adimlar]) => {
          const p = adimlar[0].proje
          return (
            <div key={projeId} className="card p-0 overflow-hidden">
              <div className="card-header bg-gray-50">
                <Link href={`/projeler/${projeId}`} className="font-medium text-sm text-blue-700 hover:underline">
                  {p?.ad} · <span className="font-mono text-xs">{p?.proje_no}</span>
                </Link>
                <span className="text-xs text-gray-400">{adimlar.length} adim</span>
              </div>
              <table className="table-base">
                <thead>
                  <tr><th>#</th><th>Adim</th><th>Makine</th><th>Tarih</th><th>Sure (dk)</th><th>Hammadde</th><th>Durum</th><th></th></tr>
                </thead>
                <tbody>
                  {adimlar.sort((a, b) => a.adim_sira - b.adim_sira).map(a => (
                    <tr key={a.id}>
                      <td className="text-gray-400">{a.adim_sira}</td>
                      <td className="font-medium">{ADIM_LABEL[a.adim_tur] || a.adim_tur}</td>
                      <td>
                        {ADIM_MAKINE_TUR[a.adim_tur] ? (
                          <select className="!w-40 !py-1 !text-xs" value={a.makine_id || ''} onChange={e => alanGuncelle(a.id, { makine_id: e.target.value || null })}>
                            <option value="">Atanmadi</option>
                            {makineler.filter(m => m.tur === ADIM_MAKINE_TUR[a.adim_tur]).map(m => (
                              <option key={m.id} value={m.id}>{m.ad}{m.fason ? ' (fason)' : ''}</option>
                            ))}
                          </select>
                        ) : <span className="text-gray-400 text-xs">— (bekleme)</span>}
                      </td>
                      <td><input type="date" className="!w-36 !py-1 !text-xs" value={a.planlanan_tarih || ''} onChange={e => alanGuncelle(a.id, { planlanan_tarih: e.target.value || null })} /></td>
                      <td><input type="number" className="!w-20 !py-1 !text-xs" value={a.planlanan_sure_dk || ''} onChange={e => alanGuncelle(a.id, { planlanan_sure_dk: parseInt(e.target.value) || null })} /></td>
                      <td>
                        <input type="checkbox" checked={!!a.hammadde_hazir} onChange={e => alanGuncelle(a.id, { hammadde_hazir: e.target.checked })} />
                      </td>
                      <td><span className={`badge ${DURUM_BADGE[a.durum]}`}>{a.durum}</span></td>
                      <td>
                        {a.durum !== 'tamamlandi' && a.durum !== 'iptal' && (
                          <button onClick={() => durumIlerlet(a)} className="btn btn-sm">Ilerlet →</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })}
        {Object.keys(gruplu).length === 0 && (
          <div className="card card-body text-center text-gray-400 text-sm py-10">Henuz uretim plani yok</div>
        )}
      </div>
      </>}
    </div>
  )
}
