'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function RaporlarPage() {
  const [loading, setLoading] = useState(true)
  const [projeDurum, setProjeDurum] = useState<Record<string, number>>({})
  const [musteriToplam, setMusteriToplam] = useState<any[]>([])
  const [makinePerf, setMakinePerf] = useState<any[]>([])
  const [kritikStok, setKritikStok] = useState<any[]>([])
  const [stokDegeri, setStokDegeri] = useState(0)
  const [acikPO, setAcikPO] = useState<any[]>([])
  const [proformaToplam, setProformaToplam] = useState(0)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: projeler }, { data: proformalar }, { data: adimlar }, { data: stoklar }, { data: pos }] = await Promise.all([
      supabase.from('proje').select('durum, musteri:musteri_tanim(ad)'),
      supabase.from('proforma').select('toplam_tutar, durum'),
      supabase.from('uretim_adim').select('*, makine:makine_tanim(ad,hedef_hiz_m_dk)').not('bitis', 'is', null),
      supabase.from('depo_stok').select('*, malzeme:malzeme_tanim(ad,min_stok_kg)'),
      supabase.from('satinalma_siparis').select('*, tedarikci:tedarikci_tanim(ad)').not('durum', 'in', '(teslim_alindi,iptal)'),
    ])

    // Proje durum dagilimi
    const pd: Record<string, number> = {}
    for (const p of projeler || []) pd[p.durum] = (pd[p.durum] || 0) + 1
    setProjeDurum(pd)

    // Musteri bazinda proje sayisi
    const mt: Record<string, number> = {}
    for (const p of (projeler || []) as any[]) {
      const ad = p.musteri?.ad || 'Bilinmiyor'
      mt[ad] = (mt[ad] || 0) + 1
    }
    setMusteriToplam(Object.entries(mt).sort((a, b) => b[1] - a[1]).slice(0, 8))

    // Onaylanan proforma toplami
    setProformaToplam((proformalar || []).filter(p => p.durum === 'onaylandi').reduce((s, p) => s + (p.toplam_tutar || 0), 0))

    // Makine performansi: ortalama hiz / hedef hiz
    const mp: Record<string, { toplamHiz: number; sayi: number; hedef: number; ad: string; toplamDurus: number }> = {}
    for (const a of (adimlar || []) as any[]) {
      if (!a.makine) continue
      const key = a.makine.ad
      if (!mp[key]) mp[key] = { toplamHiz: 0, sayi: 0, hedef: a.makine.hedef_hiz_m_dk || 0, ad: key, toplamDurus: 0 }
      if (a.hiz_m_dk) { mp[key].toplamHiz += a.hiz_m_dk; mp[key].sayi++ }
      mp[key].toplamDurus += a.durus_dk || 0
    }
    setMakinePerf(Object.values(mp).map(m => ({ ...m, ortalamaHiz: m.sayi > 0 ? m.toplamHiz / m.sayi : 0 })))

    // Kritik stok
    const malzemeToplam: Record<string, number> = {}
    const malzemeMap: Record<string, any> = {}
    for (const s of (stoklar || []) as any[]) {
      malzemeToplam[s.malzeme_id] = (malzemeToplam[s.malzeme_id] || 0) + (s.agirlik_kg || 0)
      malzemeMap[s.malzeme_id] = s.malzeme
    }
    const kritik = Object.entries(malzemeToplam)
      .filter(([id, kg]) => malzemeMap[id]?.min_stok_kg && kg < malzemeMap[id].min_stok_kg)
      .map(([id, kg]) => ({ ad: malzemeMap[id]?.ad, kalan: kg, esik: malzemeMap[id]?.min_stok_kg }))
    setKritikStok(kritik)

    // Toplam stok degeri
    const deger = (stoklar || []).reduce((s: number, x: any) => s + (x.agirlik_kg || 0) * (x.birim_fiyat || 0), 0)
    setStokDegeri(deger)

    setAcikPO(pos || [])
    setLoading(false)
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Yukleniyor...</div>

  const toplamProje = Object.values(projeDurum).reduce((a, b) => a + b, 0)

  return (
    <div className="p-6">
      <div className="page-header">
        <h1 className="page-title">Raporlar</h1>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <div className="stat-lbl">Toplam proje</div>
          <div className="stat-val">{toplamProje}</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">Onaylanan proforma toplami</div>
          <div className="stat-val text-green-600">${proformaToplam.toFixed(0)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">Depo stok degeri</div>
          <div className="stat-val">${stokDegeri.toFixed(0)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">Acik satin alma siparisi</div>
          <div className={`stat-val ${acikPO.length > 0 ? 'text-amber-600' : ''}`}>{acikPO.length}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="card">
          <div className="card-header"><span className="font-medium text-sm">Proje durum dagilimi</span></div>
          <div className="card-body space-y-2">
            {Object.entries(projeDurum).map(([durum, sayi]) => (
              <div key={durum} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{durum}</span>
                <div className="flex items-center gap-2 flex-1 mx-3">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${toplamProje > 0 ? (sayi / toplamProje) * 100 : 0}%` }} />
                  </div>
                </div>
                <span className="font-medium">{sayi}</span>
              </div>
            ))}
            {toplamProje === 0 && <div className="text-gray-400 text-sm text-center py-4">Veri yok</div>}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="font-medium text-sm">En cok proje veren musteriler</span></div>
          <div className="card-body space-y-2">
            {musteriToplam.map(([ad, sayi]) => (
              <div key={ad} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{ad}</span>
                <span className="font-medium">{sayi} proje</span>
              </div>
            ))}
            {musteriToplam.length === 0 && <div className="text-gray-400 text-sm text-center py-4">Veri yok</div>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="card">
          <div className="card-header"><span className="font-medium text-sm">Makine performansi (ortalama hiz)</span></div>
          <div className="card-body">
            <table className="table-base">
              <thead><tr><th>Makine</th><th>Ort. hiz</th><th>Hedef</th><th>Toplam durus</th></tr></thead>
              <tbody>
                {makinePerf.map(m => (
                  <tr key={m.ad}>
                    <td className="font-medium">{m.ad}</td>
                    <td className={m.hedef && m.ortalamaHiz < m.hedef * 0.8 ? 'text-red-600' : 'text-green-700'}>{m.ortalamaHiz.toFixed(1)} m/dk</td>
                    <td className="text-gray-400">{m.hedef || '—'}</td>
                    <td className="text-gray-500">{m.toplamDurus} dk</td>
                  </tr>
                ))}
                {makinePerf.length === 0 && <tr><td colSpan={4} className="text-center text-gray-400 py-6">Tamamlanmis uretim kaydi yok</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="font-medium text-sm">Kritik stok</span>
            {kritikStok.length > 0 && <span className="badge badge-red">{kritikStok.length}</span>}
          </div>
          <div className="card-body space-y-2">
            {kritikStok.map(k => (
              <div key={k.ad} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{k.ad}</span>
                <span className="font-medium text-red-600">{k.kalan.toFixed(0)} / {k.esik} kg</span>
              </div>
            ))}
            {kritikStok.length === 0 && <div className="text-gray-400 text-sm text-center py-4">Kritik stok yok</div>}
          </div>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="card-header"><span className="font-medium text-sm">Acik satin alma siparisleri</span></div>
        <table className="table-base">
          <thead><tr><th>PO No</th><th>Tedarikci</th><th>Tutar</th><th>Ihtiyac tarihi</th><th>Durum</th></tr></thead>
          <tbody>
            {acikPO.map(p => (
              <tr key={p.id}>
                <td className="font-mono font-medium">{p.po_no}</td>
                <td>{p.tedarikci?.ad}</td>
                <td className="font-semibold">${Number(p.toplam_tutar || 0).toFixed(2)}</td>
                <td className="text-gray-500 text-xs">{p.ihtiyac_tarihi ? new Date(p.ihtiyac_tarihi).toLocaleDateString('tr-TR') : '—'}</td>
                <td><span className="badge badge-amber">{p.durum}</span></td>
              </tr>
            ))}
            {acikPO.length === 0 && <tr><td colSpan={5} className="text-center text-gray-400 py-8">Acik siparis yok</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
