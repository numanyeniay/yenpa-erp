'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Metric { label: string; value: string; sub?: string; color?: string }

export default function DashboardPage() {
  const [stokUyari, setStokUyari] = useState<any[]>([])
  const [isEmirleri, setIsEmirleri] = useState<any[]>([])
  const [sonHareketler, setSonHareketler] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: stok }, { data: emirler }, { data: hareketler }] = await Promise.all([
        supabase.from('stok').select('*, malzeme(ad,min_stok_kg)').order('son_hareket', { ascending: false }),
        supabase.from('is_emri').select('*, musteri(ad)').order('olusturma', { ascending: false }).limit(5),
        supabase.from('hammadde_giris').select('*, malzeme(ad)').order('giris_tarihi', { ascending: false }).limit(6),
      ])
      const kritik = (stok||[]).filter((s: any) => s.mevcut_kg < (s.malzeme?.min_stok_kg || 0))
      setStokUyari(kritik)
      setIsEmirleri(emirler || [])
      setSonHareketler(hareketler || [])
      setLoading(false)
    }
    load()
  }, [])

  const durumRenk: Record<string, string> = {
    taslak: 'badge-gray', onaylandi: 'badge-amber',
    uretimde: 'badge-blue', tamamlandi: 'badge-green', iptal: 'badge-red'
  }

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-screen">
      <div className="text-gray-400 text-sm">Yükleniyor...</div>
    </div>
  )

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          {new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Üst metrikler */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Aktif iş emri', value: isEmirleri.filter(e => e.durum === 'uretimde').length.toString(), color: 'text-blue-600' },
          { label: 'Kritik stok', value: stokUyari.length.toString(), color: stokUyari.length > 0 ? 'text-red-600' : 'text-green-600' },
          { label: 'Bugün giriş', value: sonHareketler.length.toString(), color: 'text-gray-900' },
          { label: 'Bekleyen sipariş', value: isEmirleri.filter(e => e.durum === 'onaylandi').length.toString(), color: 'text-amber-600' },
        ].map((m, i) => (
          <div key={i} className="metric-card">
            <div className="metric-lbl">{m.label}</div>
            <div className={`metric-val ${m.color}`}>{m.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* İş emirleri */}
        <div className="card">
          <h2 className="text-sm font-medium text-gray-900 mb-4">Son iş emirleri</h2>
          {isEmirleri.length === 0
            ? <p className="text-sm text-gray-400">Henüz iş emri yok.</p>
            : <div className="space-y-2">
              {isEmirleri.map(e => (
                <div key={e.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{e.ie_no}</div>
                    <div className="text-xs text-gray-500">{e.musteri?.ad} · {e.siparis_kg} kg</div>
                  </div>
                  <span className={`badge ${durumRenk[e.durum] || 'badge-gray'}`}>{e.durum}</span>
                </div>
              ))}
            </div>
          }
        </div>

        {/* Kritik stok uyarıları */}
        <div className="card">
          <h2 className="text-sm font-medium text-gray-900 mb-4">
            Stok uyarıları
            {stokUyari.length > 0 && <span className="ml-2 badge badge-red">{stokUyari.length}</span>}
          </h2>
          {stokUyari.length === 0
            ? <p className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">✓ Tüm stoklar yeterli seviyede</p>
            : <div className="space-y-2">
              {stokUyari.map(s => {
                const pct = Math.round(s.mevcut_kg / s.malzeme?.min_stok_kg * 100)
                return (
                  <div key={s.id} className="py-2 border-b border-gray-50 last:border-0">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{s.malzeme?.ad || s.lot_no}</span>
                      <span className="text-red-600 text-xs">{s.mevcut_kg} / {s.malzeme?.min_stok_kg} kg</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-red-400 rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          }
        </div>

        {/* Son hammadde girişleri */}
        <div className="card col-span-2">
          <h2 className="text-sm font-medium text-gray-900 mb-4">Son hammadde girişleri</h2>
          {sonHareketler.length === 0
            ? <p className="text-sm text-gray-400">Henüz giriş yok.</p>
            : <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-2">Malzeme</th>
                  <th className="text-left pb-2">Lot no</th>
                  <th className="text-left pb-2">Ağırlık</th>
                  <th className="text-left pb-2">Raf</th>
                  <th className="text-left pb-2">Tarih</th>
                </tr>
              </thead>
              <tbody>
                {sonHareketler.map(h => (
                  <tr key={h.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 font-medium">{h.malzeme?.ad}</td>
                    <td className="py-2 font-mono text-xs text-gray-500">{h.lot_no}</td>
                    <td className="py-2">{h.agirlik_kg} kg</td>
                    <td className="py-2 text-gray-500">{h.depo_raf || '—'}</td>
                    <td className="py-2 text-gray-400 text-xs">
                      {new Date(h.giris_tarihi).toLocaleDateString('tr-TR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        </div>
      </div>
    </div>
  )
}
