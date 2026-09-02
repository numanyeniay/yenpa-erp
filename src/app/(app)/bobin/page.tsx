'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ADIM_LABEL } from '@/lib/uretimAkis'

// Bobin sorgulama / soy agaci ekrani.
// Bir proje secilince o isin tum uretim adimlarindaki bobinleri (uretim_cikti_bobin)
// gosterir. Bir bobin secildiginde: (1) kardesleri (ayni adimdan cikan diger bobinler)
// ve (2) geriye dogru girdi zinciri (bu bobin hangi bobinden/hangi depo lotundan
// uretildi, o da hangisinden...) gorulebilir. Boylece bir siparistekiskayet geldiginde
// "bu bobinin kardesleri de etkilenmis mi" ve "bu bobin hangi hammaddeden geldi"
// sorularina sistem uzerinden cevap aranabilir.

export default function BobinSorgulaPage() {
  const [arama, setArama] = useState('')
  const [projeSonuclari, setProjeSonuclari] = useState<any[]>([])
  const [secilenProje, setSecilenProje] = useState<any>(null)
  const [adimlar, setAdimlar] = useState<any[]>([]) // uretim_adim + adim_tur/sira eklenmis
  const [bobinler, setBobinler] = useState<any[]>([])
  const [seciliBobinId, setSeciliBobinId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => { if (arama.trim().length >= 2) { projeAra() } else { setProjeSonuclari([]) } }, 300)
    return () => clearTimeout(t)
  }, [arama])

  async function projeAra() {
    const { data } = await supabase.from('proje').select('id, proje_no, ad, musteri:musteri_tanim(ad)')
      .or(`proje_no.ilike.%${arama}%,ad.ilike.%${arama}%`).order('olusturma', { ascending: false }).limit(15)
    setProjeSonuclari(data || [])
  }

  async function projeSec(proje: any) {
    setSecilenProje(proje)
    setProjeSonuclari([])
    setArama('')
    setSeciliBobinId(null)
    setLoading(true)

    const [{ data: uadimlar }, { data: uplan }] = await Promise.all([
      supabase.from('uretim_adim').select('id, plan_id, baslangic, bitis, makine:makine_tanim(ad)').eq('proje_id', proje.id),
      supabase.from('uretim_plani').select('id, adim_sira, adim_tur').eq('proje_id', proje.id).order('adim_sira'),
    ])
    const planMap: Record<string, any> = Object.fromEntries((uplan || []).map((p: any) => [p.id, p]))
    const adimlarZengin = (uadimlar || []).map((a: any) => ({ ...a, plan: planMap[a.plan_id] }))
      .sort((a: any, b: any) => (a.plan?.adim_sira || 0) - (b.plan?.adim_sira || 0))
    setAdimlar(adimlarZengin)

    const adimIdler = adimlarZengin.map((a: any) => a.id)
    const { data: b } = adimIdler.length > 0
      ? await supabase.from('uretim_cikti_bobin').select('*, girdi_stok:depo_stok(lot_no, en_mm, malzeme:malzeme_tanim(ad))').in('adim_id', adimIdler).order('bobin_no')
      : { data: [] as any[] }
    setBobinler(b || [])
    setLoading(false)
  }

  function adimBilgisi(adimId: string) {
    return adimlar.find(a => a.id === adimId)
  }

  function girdiMetni(b: any): string {
    if (b.girdi_stok) return `Depo · ${b.girdi_stok.malzeme?.ad || 'Malzeme'} · Lot ${b.girdi_stok.lot_no || '-'} · ${b.girdi_stok.en_mm || '?'}mm`
    if (b.girdi_bobin_id) {
      const kaynak = bobinler.find(x => x.id === b.girdi_bobin_id)
      if (kaynak) {
        const kaynakAdim = adimBilgisi(kaynak.adim_id)
        return `${ADIM_LABEL[kaynakAdim?.plan?.adim_tur] || 'Adim'} · Bobin ${kaynak.bobin_no}`
      }
      return 'Onceki uretim (kayit bulunamadi)'
    }
    if (b.girdi_lot_no) return b.girdi_lot_no
    return '—'
  }

  function geriZincir(b: any): any[] {
    const zincir = [b]
    let mevcut = b
    for (let i = 0; i < 20; i++) {
      if (!mevcut.girdi_bobin_id) break
      const onceki = bobinler.find(x => x.id === mevcut.girdi_bobin_id)
      if (!onceki) break
      zincir.push(onceki)
      mevcut = onceki
    }
    return zincir
  }

  const seciliBobin = bobinler.find(b => b.id === seciliBobinId)
  const kardesler = seciliBobin ? bobinler.filter(b => b.adim_id === seciliBobin.adim_id && b.id !== seciliBobin.id) : []
  const zincir = seciliBobin ? geriZincir(seciliBobin) : []

  return (
    <div className="p-6">
      <div className="page-header">
        <h1 className="page-title">Bobin Sorgula</h1>
      </div>

      <div className="relative max-w-md mb-6">
        <input value={arama} onChange={e => setArama(e.target.value)}
          placeholder="Proje no veya is adiyla ara..." />
        {projeSonuclari.length > 0 && (
          <div className="absolute z-10 mt-1 w-full card p-0 max-h-72 overflow-y-auto shadow-lg">
            {projeSonuclari.map(p => (
              <button key={p.id} onClick={() => projeSec(p)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0">
                <div className="text-sm font-medium">{p.ad} <span className="text-gray-400 font-mono text-xs">({p.proje_no})</span></div>
                <div className="text-xs text-gray-400">{p.musteri?.ad}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {!secilenProje && <div className="card card-body text-center text-gray-400 text-sm py-12">Bir proje arayip secin</div>}

      {secilenProje && loading && <div className="text-gray-400 text-sm">Yukleniyor...</div>}

      {secilenProje && !loading && (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-4">
            <div className="card card-body">
              <div className="font-semibold">{secilenProje.ad} <span className="text-gray-400 font-mono text-sm">({secilenProje.proje_no})</span></div>
              <div className="text-xs text-gray-500">{secilenProje.musteri?.ad}</div>
            </div>

            {adimlar.map(a => {
              const buAdiminBobinleri = bobinler.filter(b => b.adim_id === a.id)
              if (buAdiminBobinleri.length === 0) return null
              return (
                <div key={a.id} className="card p-0 overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-sm font-medium">
                    {ADIM_LABEL[a.plan?.adim_tur] || a.plan?.adim_tur} <span className="text-gray-400 font-normal">· {a.makine?.ad || 'Makine yok'}</span>
                  </div>
                  <table className="table-base">
                    <thead><tr><th>Bobin</th><th>Metre</th><th>Kg</th><th>Girdi</th><th>Kalite</th></tr></thead>
                    <tbody>
                      {buAdiminBobinleri.map(b => (
                        <tr key={b.id} onClick={() => setSeciliBobinId(b.id)}
                          className={`cursor-pointer ${seciliBobinId === b.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                          <td className="font-medium">#{b.bobin_no}</td>
                          <td>{b.uretilen_metre ? `${b.uretilen_metre} m` : '—'}</td>
                          <td>{b.uretilen_kg ? `${b.uretilen_kg} kg` : '—'}</td>
                          <td className="text-gray-500 text-xs">{girdiMetni(b)}</td>
                          <td className="text-gray-500 text-xs">
                            {b.kalite_verisi ? Object.entries(b.kalite_verisi).map(([k, v]) => `${k}: ${v}`).join(', ') : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })}

            {bobinler.length === 0 && (
              <div className="card card-body text-center text-gray-400 text-sm py-10">Bu proje icin henuz bobin kaydi yok</div>
            )}
          </div>

          <div className="col-span-1">
            {!seciliBobin && (
              <div className="card card-body text-center text-gray-400 text-sm py-10">
                Kardeslerini ve girdi zincirini gormek icin bir bobin secin
              </div>
            )}
            {seciliBobin && (
              <div className="space-y-4">
                <div className="card card-body">
                  <div className="text-xs text-gray-400 mb-1">Secili bobin</div>
                  <div className="font-semibold">{ADIM_LABEL[adimBilgisi(seciliBobin.adim_id)?.plan?.adim_tur]} · Bobin {seciliBobin.bobin_no}</div>
                  <div className="text-sm text-gray-500">{seciliBobin.uretilen_metre} m · {seciliBobin.uretilen_kg} kg</div>
                </div>

                <div className="card card-body">
                  <div className="text-xs text-gray-400 mb-2">Kardesleri ({kardesler.length})</div>
                  {kardesler.length === 0 && <div className="text-sm text-gray-400">Bu adimda tek bobin uretilmis</div>}
                  {kardesler.map(k => (
                    <div key={k.id} className="text-sm py-1 border-b border-gray-50 last:border-0">
                      Bobin {k.bobin_no} · {k.uretilen_kg ? `${k.uretilen_kg} kg` : '—'}
                      {k.kalite_verisi && <span className="text-gray-400"> · {Object.entries(k.kalite_verisi).map(([kk, vv]) => `${kk}: ${vv}`).join(', ')}</span>}
                    </div>
                  ))}
                </div>

                <div className="card card-body">
                  <div className="text-xs text-gray-400 mb-2">Geriye dogru girdi zinciri</div>
                  {zincir.map((z, i) => (
                    <div key={z.id} className="text-sm py-1.5 border-b border-gray-50 last:border-0">
                      <span className="text-gray-400">{i === 0 ? 'Bu bobin' : `${i}. onceki`}:</span>{' '}
                      {ADIM_LABEL[adimBilgisi(z.adim_id)?.plan?.adim_tur]} · Bobin {z.bobin_no}
                      <div className="text-xs text-gray-400">Girdi: {girdiMetni(z)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
