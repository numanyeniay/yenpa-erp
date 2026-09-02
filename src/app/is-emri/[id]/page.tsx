'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { LOGO_BASE64 } from '@/lib/logo'
import Link from 'next/link'
import { ADIM_LABEL, KALITE_ALANLARI } from '@/lib/uretimAkis'

// Musteriye degil, uretim sahasina (operatore) yonelik dokumandir — fiyat
// bilgisi kasten gosterilmez, teknik parametreler (katman yapisi, hedefler,
// kalite kontrol noktalari) on plandadir. /proforma/[id] ile ayni yazdirma
// desenini kullanir (no-print + @media print).

export default function IsEmriPage() {
  const { id } = useParams()
  const [proje, setProje] = useState<any>(null)
  const [katmanlar, setKatmanlar] = useState<any[]>([])
  const [planlar, setPlanlar] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [id])

  async function load() {
    const [{ data: p }, { data: k }, { data: pl }] = await Promise.all([
      supabase.from('proje').select('*, musteri:musteri_tanim(ad)').eq('id', id).single(),
      supabase.from('proje_katman').select('*, malzeme:malzeme_tanim(ad,yogunluk)').eq('proje_id', id).order('sira'),
      supabase.from('uretim_plani').select('*, makine:makine_tanim(ad)').eq('proje_id', id).order('adim_sira'),
    ])
    setProje(p); setKatmanlar(k || []); setPlanlar(pl || [])
    setLoading(false)
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Yukleniyor...</div>
  if (!proje) return <div className="p-8 text-red-500 text-sm">Proje bulunamadi</div>

  // mikron (um) * yogunluk (g/cm3) birim ozdesligi geregi doğrudan g/m2 verir — /1000
  // BOLME YOK (projeler/[id] sayfasindaki filmGm2, farkli bir kg-bazli maliyet
  // formulunun ara adimi oldugu icin orada /1000 var; burada dogrudan gramaj gosteriliyor).
  const filmGm2 = katmanlar.reduce((s, k) => s + (Number(k.mikron) || 0) * (Number(k.malzeme?.yogunluk) || 0.92), 0)

  return (
    <div className="min-h-screen bg-gray-100 py-8 print:bg-white print:py-0">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .sayfa-kes { page-break-before: always; }
        }
      `}</style>

      <div className="no-print max-w-3xl mx-auto mb-4 flex items-center justify-between px-2">
        <Link href={`/projeler/${id}`} className="text-sm text-blue-600 hover:underline">← Projeye don</Link>
        <button onClick={() => window.print()} className="btn btn-sm btn-success">Yazdir / PDF kaydet</button>
      </div>

      <div className="max-w-3xl mx-auto bg-white shadow-lg print:shadow-none rounded-xl print:rounded-none p-10 text-sm text-gray-800">
        <div className="flex items-start justify-between border-b border-gray-200 pb-6 mb-6">
          <img src={LOGO_BASE64} alt="Yenpa Ambalaj" className="h-14 object-contain" />
          <div className="text-right">
            <div className="text-xl font-bold text-gray-900">IS EMRI</div>
            <div className="font-mono text-gray-500 mt-1">{proje.proje_no}</div>
            <div className="text-xs text-gray-400 mt-1">{new Date().toLocaleDateString('tr-TR')}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase mb-2">Musteri / Is</div>
            <div className="font-semibold text-gray-900">{proje.musteri?.ad}</div>
            <div className="text-gray-500">{proje.ad}</div>
            <div className="flex gap-1.5 mt-2 flex-wrap">
              <span className="badge badge-gray">{proje.cikti_turu}</span>
              {proje.baskili && <span className="badge badge-blue">{proje.baskili_yuz === 'alt' ? 'Alt baski' : 'Ust baski'}</span>}
              {proje.is_tipi && proje.is_tipi !== 'yeni' && (
                <span className={`badge ${proje.is_tipi === 'revizyon' ? 'badge-red' : 'badge-amber'}`}>
                  {proje.is_tipi === 'revizyon' ? 'Revizyon' : 'Tekrar'}
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="grid grid-cols-2 gap-1 text-gray-600">
              {proje.en_mm && <><span className="text-gray-400">Ebat</span><span>{proje.en_mm} × {proje.boy_mm || '—'} mm</span></>}
              {proje.kato_eni_mm && <><span className="text-gray-400">Kato eni</span><span className="font-medium">{proje.kato_eni_mm} mm</span></>}
              {proje.urun_bobin_en_mm && <><span className="text-gray-400">Urun bobin eni</span><span>{proje.urun_bobin_en_mm} mm</span></>}
              {proje.bant_sayisi && <><span className="text-gray-400">Bant sayisi</span><span>{proje.bant_sayisi}</span></>}
              {proje.renk_sayisi && <><span className="text-gray-400">Renk sayisi</span><span>{proje.renk_sayisi}</span></>}
              {proje.kazan_cap_mm && <><span className="text-gray-400">Kazan capi</span><span>{proje.kazan_cap_mm} mm</span></>}
              {proje.kazan_sayisi && <><span className="text-gray-400">Kazan sayisi</span><span>{proje.kazan_sayisi}</span></>}
              {filmGm2 > 0 && <><span className="text-gray-400">Toplam film</span><span>{filmGm2.toFixed(1)} g/m²</span></>}
            </div>
          </div>
        </div>

        <div className="border border-gray-100 rounded-xl overflow-hidden mb-8">
          <div className="bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500">Film katmanlari (disaridan ice)</div>
          {katmanlar.length === 0 && <div className="px-4 py-3 text-xs text-gray-400">Katman tanimlanmamis</div>}
          {katmanlar.map(k => (
            <div key={k.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center flex-shrink-0">{k.sira}</div>
              <div className="flex-1">
                <span className="font-medium text-sm">{k.malzeme?.ad}</span>
                <span className="text-gray-400 text-xs ml-2">{k.mikron} μm · {k.malzeme?.yogunluk} g/cm³</span>
              </div>
              <div className="flex gap-1.5">
                {k.baskili && <span className="badge badge-blue text-xs">Baskili</span>}
                {k.laminasyon_onceki && <span className="badge text-xs" style={{ background: '#ccfbf1', color: '#0f766e' }}>Lamine</span>}
              </div>
            </div>
          ))}
        </div>

        <div className="mb-2">
          <div className="text-xs font-semibold text-gray-400 uppercase mb-2">Uretim rotasi</div>
        </div>
        <table className="w-full text-xs mb-8 border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-800 text-left">
              <th className="py-2 pr-2">#</th>
              <th className="py-2 pr-2">Adim</th>
              <th className="py-2 pr-2">Makine</th>
              <th className="py-2 pr-2">Planlanan</th>
              <th className="py-2 pr-2">Hedef kg</th>
              <th className="py-2 pr-2">Hedef m</th>
              <th className="py-2">Kalite kontrol</th>
            </tr>
          </thead>
          <tbody>
            {planlar.map(p => {
              const kalite = KALITE_ALANLARI[p.adim_tur]
              return (
                <tr key={p.id} className="border-b border-gray-100">
                  <td className="py-2 pr-2">{p.adim_sira}</td>
                  <td className="py-2 pr-2 font-medium">{ADIM_LABEL[p.adim_tur] || p.adim_tur}</td>
                  <td className="py-2 pr-2 text-gray-500">{p.makine?.ad || '—'}</td>
                  <td className="py-2 pr-2 text-gray-500">
                    {p.planlanan_tarih ? new Date(p.planlanan_tarih).toLocaleDateString('tr-TR') : '—'}
                    {p.planlanan_baslangic ? ` ${p.planlanan_baslangic.slice(0, 5)}` : ''}
                  </td>
                  <td className="py-2 pr-2">{p.hedef_kg ? `${Number(p.hedef_kg).toFixed(0)} kg` : '—'}</td>
                  <td className="py-2 pr-2">{p.hedef_metre ? `${Number(p.hedef_metre).toFixed(0)} m` : '—'}</td>
                  <td className="py-2">
                    {kalite ? (
                      <span className="text-gray-500">{kalite.label} ({kalite.birim}): _______</span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              )
            })}
            {planlar.length === 0 && (
              <tr><td colSpan={7} className="py-4 text-center text-gray-400">Uretim plani henuz olusturulmamis</td></tr>
            )}
          </tbody>
        </table>

        <div className="grid grid-cols-2 gap-8 mt-10 pt-6 border-t border-gray-100 text-xs text-gray-500">
          <div>
            <div className="mb-8">Uretimi yapan: ______________________</div>
            <div>Tarih / Imza: ______________________</div>
          </div>
          <div>
            <div className="mb-8">Kontrol eden: ______________________</div>
            <div>Tarih / Imza: ______________________</div>
          </div>
        </div>
      </div>
    </div>
  )
}
