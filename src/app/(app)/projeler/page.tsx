'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const CIKTI_LABEL: Record<string, string> = {
  bobin: 'Bobin', doypack: 'Doypack', quadro: 'Quadro', flat_bottom: 'Flat bottom',
  sirt_kaynak: 'Sirt kaynak', yan_kesim: 'Yan kesim', katlama_torba: 'Katlama torba', diger: 'Diger',
}
const DURUM_LABEL: Record<string, string> = {
  taslak: 'Taslak', fiyatlama: 'Fiyatlama', proforma_gonderildi: 'Proforma gonderildi',
  musteri_onayladi: 'Musteri onayladi', uretimde: 'Uretimde', tamamlandi: 'Tamamlandi', iptal: 'Iptal',
}
const DURUM_BADGE: Record<string, string> = {
  taslak: 'badge-gray', fiyatlama: 'badge-blue', proforma_gonderildi: 'badge-amber',
  musteri_onayladi: 'badge-green', uretimde: 'badge-blue', tamamlandi: 'badge-green', iptal: 'badge-red',
}
const DURUM_SIRA = ['taslak', 'fiyatlama', 'proforma_gonderildi', 'musteri_onayladi', 'uretimde', 'tamamlandi', 'iptal']

export default function ProjelerPage() {
  const [projeler, setProjeler] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [arama, setArama] = useState('')
  const [durumFiltre, setDurumFiltre] = useState('tumu')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('proje')
      .select('id, proje_no, ad, cikti_turu, durum, olusturma, musteri:musteri_tanim(ad)')
      .order('olusturma', { ascending: false })
    setProjeler(data || [])
    setLoading(false)
  }

  const sayilar = useMemo(() => {
    const s: Record<string, number> = { tumu: projeler.length }
    DURUM_SIRA.forEach(d => { s[d] = projeler.filter(p => p.durum === d).length })
    return s
  }, [projeler])

  const filtreli = useMemo(() => {
    const q = arama.trim().toLowerCase()
    return projeler.filter(p => {
      if (durumFiltre !== 'tumu' && p.durum !== durumFiltre) return false
      if (!q) return true
      return (p.ad || '').toLowerCase().includes(q)
        || (p.proje_no || '').toLowerCase().includes(q)
        || (p.musteri?.ad || '').toLowerCase().includes(q)
    })
  }, [projeler, arama, durumFiltre])

  if (loading) return <div className="p-8 text-gray-400 text-sm">Yukleniyor...</div>

  return (
    <div className="p-6">
      <div className="page-header">
        <h1 className="page-title">Projeler & Teklifler</h1>
        <Link href="/projeler/yeni" className="btn btn-primary btn-sm">+ Yeni Proje</Link>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <input
          value={arama}
          onChange={e => setArama(e.target.value)}
          placeholder="Proje no, ad veya musteri ara..."
          className="!w-72"
        />
        <select value={durumFiltre} onChange={e => setDurumFiltre(e.target.value)} className="!w-56">
          <option value="tumu">Tum durumlar ({sayilar.tumu})</option>
          {DURUM_SIRA.map(d => (
            <option key={d} value={d}>{DURUM_LABEL[d]} ({sayilar[d] || 0})</option>
          ))}
        </select>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="table-base">
          <thead>
            <tr><th>Proje No</th><th>Ad</th><th>Musteri</th><th>Urun turu</th><th>Durum</th><th>Olusturma</th><th></th></tr>
          </thead>
          <tbody>
            {filtreli.map(p => (
              <tr key={p.id}>
                <td className="font-mono font-medium text-xs">{p.proje_no}</td>
                <td>{p.ad}</td>
                <td className="text-gray-500">{p.musteri?.ad || '—'}</td>
                <td className="text-gray-500">{CIKTI_LABEL[p.cikti_turu] || p.cikti_turu}</td>
                <td><span className={`badge ${DURUM_BADGE[p.durum] || 'badge-gray'}`}>{DURUM_LABEL[p.durum] || p.durum}</span></td>
                <td className="text-gray-400 text-xs">{p.olusturma ? new Date(p.olusturma).toLocaleDateString('tr-TR') : '—'}</td>
                <td><Link href={`/projeler/${p.id}`} className="btn btn-sm">Detay →</Link></td>
              </tr>
            ))}
            {filtreli.length === 0 && (
              <tr><td colSpan={7} className="text-center text-gray-400 py-8">
                {projeler.length === 0 ? 'Henuz proje yok' : 'Aramaya uyan proje bulunamadi'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
