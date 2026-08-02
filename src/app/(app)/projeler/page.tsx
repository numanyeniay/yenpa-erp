'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import type { Proje } from '@/types'

const DURUM_BADGE: Record<string, string> = {
  taslak: 'badge-gray',
  fiyatlama: 'badge-blue',
  proforma_gonderildi: 'badge-amber',
  musteri_onayladi: 'badge-green',
  'uretimdе': 'badge-purple',
  tamamlandi: 'badge-green',
  iptal: 'badge-red',
}

const DURUM_LABEL: Record<string, string> = {
  taslak: 'Taslak',
  fiyatlama: 'Fiyatlama',
  proforma_gonderildi: 'Proforma Gonderildi',
  musteri_onayladi: 'Musteri Onayladi',
  'uretimdе': 'Uretimde',
  tamamlandi: 'Tamamlandi',
  iptal: 'Iptal',
}

export default function ProjelerPage() {
  const [projeler, setProjeler] = useState<Proje[]>([])
  const [loading, setLoading] = useState(true)
  const [aramaText, setAramaText] = useState('')
  const [durumFilter, setDurumFilter] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('proje')
      .select('*, musteri:musteri_tanim(ad)')
      .order('olusturma', { ascending: false })
    setProjeler(data || [])
    setLoading(false)
  }

  const filtered = projeler.filter(p => {
    const aramaMatch = !aramaText ||
      p.proje_no?.toLowerCase().includes(aramaText.toLowerCase()) ||
      p.ad?.toLowerCase().includes(aramaText.toLowerCase()) ||
      (p.musteri as any)?.ad?.toLowerCase().includes(aramaText.toLowerCase())
    const durumMatch = !durumFilter || p.durum === durumFilter
    return aramaMatch && durumMatch
  })

  const stats = {
    toplam: projeler.length,
    taslak: projeler.filter(p => p.durum === 'taslak').length,
    onaylandi: projeler.filter(p => p.durum === 'musteri_onayladi').length,
    uretimde: projeler.filter(p => p.durum === 'uretimdе').length,
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Yukleniyor...</div>

  return (
    <div className="p-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Projeler</h1>
          <p className="text-gray-500 text-xs mt-0.5">Her musteri siparisi bir proje</p>
        </div>
        <Link href="/projeler/yeni" className="btn btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          Yeni proje
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="stat-card"><div className="stat-lbl">Toplam proje</div><div className="stat-val">{stats.toplam}</div></div>
        <div className="stat-card"><div className="stat-lbl">Taslak</div><div className="stat-val text-gray-500">{stats.taslak}</div></div>
        <div className="stat-card"><div className="stat-lbl">Musteri onayladi</div><div className="stat-val text-green-600">{stats.onaylandi}</div></div>
        <div className="stat-card"><div className="stat-lbl">Uretimde</div><div className="stat-val text-blue-600">{stats.uretimde}</div></div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-3">
            <input type="text" placeholder="Proje ara..." value={aramaText}
              onChange={e => setAramaText(e.target.value)} className="w-48" />
            <select value={durumFilter} onChange={e => setDurumFilter(e.target.value)} className="w-44">
              <option value="">Tum durumlar</option>
              {Object.entries(DURUM_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <span className="text-sm text-gray-500">{filtered.length} proje</span>
        </div>
        <div className="overflow-hidden">
          <table className="table-base">
            <thead>
              <tr>
                <th>Proje no</th>
                <th>Musteri</th>
                <th>Urun adi</th>
                <th>Cikti turu</th>
                <th>Durum</th>
                <th>Tarih</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td><span className="font-mono text-xs font-medium text-blue-600">{p.proje_no}</span></td>
                  <td className="font-medium">{(p.musteri as any)?.ad || '—'}</td>
                  <td className="text-gray-600 max-w-[200px] truncate">{p.ad}</td>
                  <td><span className="badge badge-gray">{p.cikti_turu}</span></td>
                  <td><span className={`badge ${DURUM_BADGE[p.durum] || 'badge-gray'}`}>{DURUM_LABEL[p.durum] || p.durum}</span></td>
                  <td className="text-gray-400 text-xs">{new Date(p.olusturma).toLocaleDateString('tr-TR')}</td>
                  <td>
                    <Link href={`/projeler/${p.id}`} className="btn btn-sm">Detay</Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center text-gray-400 py-12">
                  {aramaText || durumFilter ? 'Filtre sonucu bulunamadi' : 'Henuz proje yok — Yeni proje olusturun'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
