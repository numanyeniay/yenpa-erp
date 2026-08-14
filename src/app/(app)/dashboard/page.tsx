'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function DashboardPage() {
  const [stats, setStats] = useState({ projeler:0, uretimde:0, bekleyen:0, kritik_stok:0 })
  const [sonProjeler, setSonProjeler] = useState<any[]>([])
  const [bekleyenPlanlar, setBekleyenPlanlar] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [
        { count: projeSayisi },
        { count: uretimSayisi },
        { data: son },
        { data: planlar },
        { data: kritikStok },
      ] = await Promise.all([
        supabase.from('proje').select('*', { count:'exact', head:true }),
        supabase.from('proje').select('*', { count:'exact', head:true }).eq('durum','uretimde'),
        supabase.from('proje').select('*, musteri:musteri_tanim(ad)').order('olusturma', { ascending:false }).limit(5),
        supabase.from('uretim_plani').select('*, proje(proje_no,ad), makine:makine_tanim(ad)').eq('durum','bekliyor').limit(5),
        supabase.from('depo_stok').select('*, malzeme:malzeme_tanim(ad,min_stok_kg)').limit(100),
      ])

      const kritikSayisi = (kritikStok || []).filter((s: any) =>
        s.agirlik_kg < (s.malzeme?.min_stok_kg || 0)
      ).length

      setStats({
        projeler: projeSayisi || 0,
        uretimde: uretimSayisi || 0,
        bekleyen: (planlar || []).length,
        kritik_stok: kritikSayisi,
      })
      setSonProjeler(son || [])
      setBekleyenPlanlar(planlar || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="p-8 text-gray-400 text-sm">Yukleniyor...</div>

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="page-title">Dashboard</h1>
        <p className="text-gray-500 text-xs mt-0.5">
          {new Date().toLocaleDateString('tr-TR', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <div className="stat-lbl">Toplam proje</div>
          <div className="stat-val">{stats.projeler}</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">Uretimde</div>
          <div className="stat-val text-blue-600">{stats.uretimde}</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">Bekleyen uretim adimi</div>
          <div className="stat-val text-amber-600">{stats.bekleyen}</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">Kritik stok</div>
          <div className={`stat-val ${stats.kritik_stok > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {stats.kritik_stok}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <span className="font-medium text-sm">Son projeler</span>
            <Link href="/projeler" className="text-xs text-blue-600 hover:underline">Tumunu gor</Link>
          </div>
          <div>
            {sonProjeler.length === 0
              ? <div className="px-5 py-8 text-center text-gray-400 text-sm">Henuz proje yok</div>
              : sonProjeler.map(p => (
                <div key={p.id} className="flex items-center justify-between px-5 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <div>
                    <div className="font-medium text-sm">{p.ad}</div>
                    <div className="text-xs text-gray-500">{p.musteri?.ad} · <span className="font-mono">{p.proje_no}</span></div>
                  </div>
                  <span className={`badge ${p.durum === 'taslak' ? 'badge-gray' : p.durum === 'musteri_onayladi' ? 'badge-green' : 'badge-blue'}`}>
                    {p.durum}
                  </span>
                </div>
              ))
            }
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="font-medium text-sm">Bekleyen uretim adimlari</span>
            <Link href="/planlama" className="text-xs text-blue-600 hover:underline">Planlamaya git</Link>
          </div>
          <div>
            {bekleyenPlanlar.length === 0
              ? <div className="px-5 py-8 text-center text-gray-400 text-sm">Bekleyen is yok</div>
              : bekleyenPlanlar.map(p => (
                <div key={p.id} className="flex items-center justify-between px-5 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <div>
                    <div className="font-medium text-sm">{p.proje?.ad}</div>
                    <div className="text-xs text-gray-500">{p.makine?.ad} · {p.adim_tur}</div>
                  </div>
                  {p.planlanan_tarih && (
                    <span className="text-xs text-gray-400">{new Date(p.planlanan_tarih).toLocaleDateString('tr-TR')}</span>
                  )}
                </div>
              ))
            }
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        {[
          { href:'/projeler/yeni', label:'Yeni proje olustur', icon:'M12 4v16m8-8H4', color:'blue' },
          { href:'/depo', label:'Hammadde girisi', icon:'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', color:'green' },
          { href:'/planlama', label:'Uretim planlama', icon:'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', color:'purple' },
        ].map(item => (
          <Link key={item.href} href={item.href}
            className={`card card-body flex items-center gap-3 hover:shadow-md transition-shadow cursor-pointer no-underline`}>
            <div className={`w-10 h-10 rounded-xl bg-${item.color}-100 flex items-center justify-center flex-shrink-0`}>
              <svg className={`w-5 h-5 text-${item.color}-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
            </div>
            <span className="font-medium text-sm text-gray-800">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
