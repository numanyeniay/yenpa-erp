'use client'
import { useEffect, useState } from 'react'
import { supabase, yeniPlanNo } from '@/lib/supabase'
import { projeRotasiHesapla, type AdimTur } from '@/types'
import { ADIM_LABEL, ADIM_MAKINE_TUR, sonrakiAdimiAc } from '@/lib/uretimAkis'
import Link from 'next/link'

const DURUM_BADGE: Record<string, string> = {
  bekliyor: 'badge-gray', hazir: 'badge-blue', calisiyor: 'badge-amber',
  durustu: 'badge-red', tamamlandi: 'badge-green', iptal: 'badge-red',
}

// Otomatik plan taslaği bu varsayımlarla kuruluyor — planlamacı sonradan
// her adımın tarih/saat/süresini serbestçe değiştirebilir:
//  - Tüm makineler (gerçek hız tanımından bağımsız) 150 m/dk çalışıyormuş gibi kabul edilir.
//  - Her makine adımına 30 dk sabit kurulum/ayar süresi eklenir.
//  - Kürleme adımlarının makinesi yoktur; 24 saatlik gerçek-zamanlı (mesai dışı dahil) bekleme kabul edilir.
//  - Mesai günü 08:00'de başlar, uzunluğu makinenin gunluk_kapasite_dk alanı (yoksa 540 dk / 9 saat) kadardır.
const VARSAYILAN_HIZ_M_DK = 150
const KURULUM_SURESI_DK = 30
const KURLEME_SURESI_DK = 24 * 60
const IS_GUNU_BASLANGIC_SAAT = 8

function tarihStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function saatStr(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function isGunuKapasitesi(makine: any) {
  return makine?.gunluk_kapasite_dk || 540
}

// Bir makinenin en erken musait oldugu zamandan itibaren, mesai saatine
// (08:00 baslangic) gore gercek baslama zamanini bulur. Mesai disindaysa
// (aksam/gece) ya da gunun kapasitesi zaten dolmussa ertesi gun 08:00'e atar.
function mesaiyeGoreBaslat(enErken: Date, kapasiteDk: number): Date {
  const gunBaslangic = new Date(enErken)
  gunBaslangic.setHours(IS_GUNU_BASLANGIC_SAAT, 0, 0, 0)
  const gunBitis = new Date(gunBaslangic.getTime() + kapasiteDk * 60000)
  if (enErken < gunBaslangic) return gunBaslangic
  if (enErken >= gunBitis) return new Date(gunBaslangic.getTime() + 24 * 60 * 60000)
  return enErken
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
    const [{ data: katmanlar }, { data: proformalar }] = await Promise.all([
      supabase.from('proje_katman').select('*').eq('proje_id', proje.id).order('sira'),
      supabase.from('proforma').select('secilen_metre, durum').eq('proje_id', proje.id).order('olusturma', { ascending: false }),
    ])
    if (!katmanlar || katmanlar.length === 0) {
      setMsg(`Hata: ${proje.proje_no} icin katman tanimi yok, once fiyatlama sayfasindan katmanlari girin.`)
      setOlusturuluyor(null); return
    }
    // Sure/tarih hesabi icin: onayli proformanin metresi (yoksa en son gonderilenin metresi)
    const onayliProforma = (proformalar || []).find((pf: any) => pf.durum === 'onaylandi') || (proformalar || [])[0]
    const metre = onayliProforma?.secilen_metre ? Number(onayliProforma.secilen_metre) : null

    const adimlar: AdimTur[] = projeRotasiHesapla(proje, katmanlar as any)
    const rows: any[] = []
    // Ayni proje icindeki adimlar sirali baglidir: bir sonraki adim, bir oncekinin bitisinden once baslayamaz.
    let oncekiAdimBitis = new Date()
    // Makine musaitligini hesaplarken mevcut kuyruga, bu cagri icinde yeni atadigimiz adimlari da eklemek icin calisma kopyasi.
    const simPlanlar = [...planlar]

    for (let i = 0; i < adimlar.length; i++) {
      const adim = adimlar[i]
      const makineTur = ADIM_MAKINE_TUR[adim]
      const plan_no = await yeniPlanNo()

      if (makineTur === null) {
        // Kurleme: makinesiz, gercek-zamanli (mesai disi dahil) bekleme suresi.
        const sureDk = KURLEME_SURESI_DK
        const baslangic = new Date(oncekiAdimBitis)
        rows.push({
          plan_no, proje_id: proje.id, makine_id: null, adim_sira: i + 1, adim_tur: adim, durum: 'bekliyor',
          planlanan_tarih: tarihStr(baslangic), planlanan_baslangic: saatStr(baslangic), planlanan_sure_dk: sureDk,
        })
        oncekiAdimBitis = new Date(baslangic.getTime() + sureDk * 60000)
        continue
      }

      const uygunMakine = makineler.find(m => m.tur === makineTur && !m.fason) || makineler.find(m => m.tur === makineTur) || null
      const sureDk = (metre && uygunMakine) ? KURULUM_SURESI_DK + Math.ceil(metre / VARSAYILAN_HIZ_M_DK) : null

      let baslangic: Date | null = null
      if (uygunMakine && sureDk) {
        let makineSerbest = new Date()
        for (const is_ of simPlanlar) {
          if (is_.makine_id !== uygunMakine.id) continue
          if (['tamamlandi', 'iptal'].includes(is_.durum)) continue
          if (!is_.planlanan_tarih || !is_.planlanan_baslangic) continue
          const bitis = new Date(`${is_.planlanan_tarih}T${is_.planlanan_baslangic}`)
          bitis.setMinutes(bitis.getMinutes() + (is_.planlanan_sure_dk || 0))
          if (bitis > makineSerbest) makineSerbest = bitis
        }
        const enErken = oncekiAdimBitis > makineSerbest ? oncekiAdimBitis : makineSerbest
        baslangic = mesaiyeGoreBaslat(enErken, isGunuKapasitesi(uygunMakine))
        simPlanlar.push({ makine_id: uygunMakine.id, durum: 'bekliyor', planlanan_tarih: tarihStr(baslangic), planlanan_baslangic: saatStr(baslangic), planlanan_sure_dk: sureDk })
      }

      rows.push({
        plan_no, proje_id: proje.id, makine_id: uygunMakine?.id || null,
        adim_sira: i + 1, adim_tur: adim, durum: 'bekliyor',
        planlanan_tarih: baslangic ? tarihStr(baslangic) : null,
        planlanan_baslangic: baslangic ? saatStr(baslangic) : null,
        planlanan_sure_dk: sureDk,
      })
      if (baslangic && sureDk) oncekiAdimBitis = new Date(baslangic.getTime() + sureDk * 60000)
    }

    const { error } = await supabase.from('uretim_plani').insert(rows)
    if (error) { setMsg('Hata: ' + error.message); setOlusturuluyor(null); return }
    // Ilk adimi (baskili ise Baski, degilse rotanin ilk gercek adimi) otomatik
    // "hazir" yap — operator tablet panelinde hemen gorsun. Kurleme ile
    // baslayan bir rota olsaydi (olmaz normalde) o da otomatik atlanirdi.
    await sonrakiAdimiAc(proje.id, 0)
    const not = metre ? '' : ' (proformada metre bilgisi bulunamadi — sure/tarihler bos birakildi, manuel girin)'
    setMsg(`${proje.proje_no} icin ${rows.length} adimlik plan olusturuldu (150 m/dk varsayimiyla).${not}`)
    load()
    setOlusturuluyor(null)
  }

  async function alanGuncelle(id: string, patch: any) {
    await supabase.from('uretim_plani').update(patch).eq('id', id)
    load()
  }

  // Ayni makinenin kuyrugunda iki adimin planlanan tarih/saatini yer degistirir (sira degistirme).
  async function siraDegistir(kuyruk: any[], i: number, j: number) {
    const a = kuyruk[i], b = kuyruk[j]
    await Promise.all([
      supabase.from('uretim_plani').update({ planlanan_tarih: b.planlanan_tarih, planlanan_baslangic: b.planlanan_baslangic }).eq('id', a.id),
      supabase.from('uretim_plani').update({ planlanan_tarih: a.planlanan_tarih, planlanan_baslangic: a.planlanan_baslangic }).eq('id', b.id),
    ])
    load()
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

                {(() => {
                  const kuyruk = [...bekleyenAdimlar].sort((a, b) => {
                    const ta = a.planlanan_tarih ? `${a.planlanan_tarih}T${a.planlanan_baslangic || '00:00'}` : '9999'
                    const tb = b.planlanan_tarih ? `${b.planlanan_tarih}T${b.planlanan_baslangic || '00:00'}` : '9999'
                    return ta.localeCompare(tb)
                  })
                  return kuyruk.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
                      <div className="text-xs font-medium text-gray-500 mb-1">Sira</div>
                      {kuyruk.map((p, idx) => (
                        <div key={p.id} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-2 py-1.5 gap-2">
                          <div className="min-w-0">
                            <div className="truncate">
                              <span className="font-medium">{p.proje?.proje_no}</span>
                              <span className="text-gray-400 ml-1">{ADIM_LABEL[p.adim_tur] || p.adim_tur}</span>
                            </div>
                            <div className="text-gray-400">
                              {p.planlanan_tarih ? `${p.planlanan_tarih} ${p.planlanan_baslangic || ''}` : 'tarih yok'} · {p.planlanan_sure_dk || '?'} dk
                            </div>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button disabled={idx === 0} onClick={() => siraDegistir(kuyruk, idx, idx - 1)} className="btn btn-sm !px-1.5 !py-0.5" title="Yukari tasi">↑</button>
                            <button disabled={idx === kuyruk.length - 1} onClick={() => siraDegistir(kuyruk, idx, idx + 1)} className="btn btn-sm !px-1.5 !py-0.5" title="Asagi tasi">↓</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
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
                  <tr><th>#</th><th>Adim</th><th>Makine</th><th>Tarih</th><th>Saat</th><th>Sure (dk)</th><th>Hammadde</th><th>Durum</th></tr>
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
                        ) : <span className="text-gray-400 text-xs">— (bekleme/kurlenme, otomatik gecer)</span>}
                      </td>
                      <td><input type="date" className="!w-36 !py-1 !text-xs" value={a.planlanan_tarih || ''} onChange={e => alanGuncelle(a.id, { planlanan_tarih: e.target.value || null })} /></td>
                      <td><input type="time" className="!w-24 !py-1 !text-xs" value={a.planlanan_baslangic || ''} onChange={e => alanGuncelle(a.id, { planlanan_baslangic: e.target.value || null })} /></td>
                      <td><input type="number" className="!w-20 !py-1 !text-xs" value={a.planlanan_sure_dk || ''} onChange={e => alanGuncelle(a.id, { planlanan_sure_dk: parseInt(e.target.value) || null })} /></td>
                      <td>
                        <input type="checkbox" checked={!!a.hammadde_hazir} onChange={e => alanGuncelle(a.id, { hammadde_hazir: e.target.checked })} />
                      </td>
                      <td><span className={`badge ${DURUM_BADGE[a.durum]}`}>{a.durum}</span></td>
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
