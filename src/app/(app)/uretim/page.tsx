'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ADIM_LABEL } from '@/lib/uretimAkis'
import BobinGirisFormu from '@/components/BobinGirisFormu'

export default function UretimPage() {
  const [tab, setTab] = useState<'aktif'|'gecmis'>('aktif')
  const [planlar, setPlanlar] = useState<any[]>([])
  const [adimlar, setAdimlar] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [bitirForm, setBitirForm] = useState<any>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: p }, { data: a }] = await Promise.all([
      supabase.from('uretim_plani').select('*, proje:proje(proje_no,ad), makine:makine_tanim(ad,tur,hedef_hiz_m_dk)').in('durum', ['hazir', 'calisiyor']).order('planlanan_tarih'),
      supabase.from('uretim_adim').select('*, proje:proje(proje_no,ad), makine:makine_tanim(ad,hedef_hiz_m_dk)').order('baslangic', { ascending: false }).limit(50),
    ])
    setPlanlar(p || []); setAdimlar(a || [])
    setLoading(false)
  }

  async function baslat(plan: any) {
    setSaving(true); setMsg('')
    const { data: adim, error } = await supabase.from('uretim_adim').insert({
      plan_id: plan.id, proje_id: plan.proje_id, makine_id: plan.makine_id,
      baslangic: new Date().toISOString(),
    }).select().single()
    if (error) { setMsg('Hata: ' + error.message); setSaving(false); return }
    await supabase.from('uretim_plani').update({ durum: 'calisiyor' }).eq('id', plan.id)
    setMsg('Uretim baslatildi.'); load()
    setSaving(false)
  }

  function bitirTamamlandi() {
    setMsg('Uretim adimi tamamlandi.')
    setBitirForm(null)
    load()
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Yukleniyor...</div>

  return (
    <div className="p-6">
      <div className="page-header">
        <h1 className="page-title">Uretim Takibi</h1>
      </div>

      <div className="flex gap-0 mb-6 border-b border-gray-200">
        {[{ k: 'aktif', l: `Aktif / Hazir (${planlar.length})` }, { k: 'gecmis', l: 'Gecmis kayitlar' }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as any)}
            className={`px-5 py-2.5 text-sm border-b-2 -mb-px transition-colors ${tab === t.k ? 'border-blue-600 text-blue-600 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {msg && <p className={`text-sm mb-4 ${msg.startsWith('Hata') ? 'text-red-600' : 'text-green-600'}`}>{msg}</p>}

      {tab === 'aktif' && (
        <div className="grid grid-cols-2 gap-4">
          {planlar.map(p => {
            const calisanAdim = adimlar.find(a => a.plan_id === p.id && !a.bitis)
            return (
              <div key={p.id} className="card card-body">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold text-sm">{ADIM_LABEL[p.adim_tur] || p.adim_tur}</div>
                    <div className="text-xs text-gray-500">{p.proje?.ad} · <span className="font-mono">{p.proje?.proje_no}</span></div>
                    <div className="text-xs text-gray-400">{p.makine?.ad || 'Makine atanmadi'}</div>
                  </div>
                  <span className={`badge ${p.durum === 'calisiyor' ? 'badge-amber' : 'badge-blue'}`}>{p.durum}</span>
                </div>
                {p.durum === 'hazir' && (
                  <button onClick={() => baslat(p)} disabled={saving} className="btn btn-success btn-sm w-full justify-center mt-2">Uretimi baslat</button>
                )}
                {p.durum === 'calisiyor' && calisanAdim && (
                  bitirForm?.adim.id === calisanAdim.id ? (
                    <div className="mt-2 bg-gray-50 rounded-lg p-3">
                      <BobinGirisFormu
                        projeId={p.proje_id}
                        planId={p.id}
                        adimId={calisanAdim.id}
                        adimSira={p.adim_sira}
                        adimTur={p.adim_tur}
                        baslangic={calisanAdim.baslangic}
                        onTamamla={bitirTamamlandi}
                        onIptal={() => setBitirForm(null)}
                      />
                    </div>
                  ) : (
                    <button onClick={() => setBitirForm({ plan: p, adim: calisanAdim })}
                      className="btn btn-primary btn-sm w-full justify-center mt-2">Uretimi bitir</button>
                  )
                )}
              </div>
            )
          })}
          {planlar.length === 0 && <div className="col-span-2 card card-body text-center text-gray-400 text-sm py-10">Aktif / hazir is yok</div>}
        </div>
      )}

      {tab === 'gecmis' && (
        <div className="card p-0 overflow-hidden">
          <table className="table-base">
            <thead><tr><th>Proje</th><th>Makine</th><th>Baslangic</th><th>Sure</th><th>Uretilen</th><th>Hiz</th><th>Fire</th><th>Durus</th></tr></thead>
            <tbody>
              {adimlar.filter(a => a.bitis).map(a => (
                <tr key={a.id}>
                  <td className="font-medium">{a.proje?.ad} <span className="text-gray-400 font-mono text-xs">({a.proje?.proje_no})</span></td>
                  <td className="text-gray-500">{a.makine?.ad}</td>
                  <td className="text-gray-400 text-xs">{new Date(a.baslangic).toLocaleString('tr-TR')}</td>
                  <td>{a.sure_dk} dk</td>
                  <td>{a.uretilen_metre ? `${a.uretilen_metre} m` : '—'}{a.uretilen_kg ? ` / ${a.uretilen_kg} kg` : ''}</td>
                  <td className={a.makine?.hedef_hiz_m_dk && a.hiz_m_dk && a.hiz_m_dk < a.makine.hedef_hiz_m_dk * 0.8 ? 'text-red-600' : ''}>
                    {a.hiz_m_dk ? `${Number(a.hiz_m_dk).toFixed(1)} m/dk` : '—'}
                    {a.makine?.hedef_hiz_m_dk && <span className="text-gray-400 text-xs"> / {a.makine.hedef_hiz_m_dk}</span>}
                  </td>
                  <td className="text-gray-500">{((a.uretim_fire_kg || 0) + (a.kenar_fire_kg || 0)).toFixed(1)} kg</td>
                  <td className="text-gray-500">{a.durus_dk > 0 ? `${a.durus_dk} dk` : '—'}</td>
                </tr>
              ))}
              {adimlar.filter(a => a.bitis).length === 0 && <tr><td colSpan={8} className="text-center text-gray-400 py-8">Kayit yok</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
