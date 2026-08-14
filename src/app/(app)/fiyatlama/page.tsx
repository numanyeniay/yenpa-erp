'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function FiyatlamaPage() {
  const [fasonFiyatlar, setFasonFiyatlar] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [duzenle, setDuzenle] = useState<any>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('fason_fiyat')
      .select('*')
      .eq('aktif', true)
      .order('tur')
      .order('min_gram')
    setFasonFiyatlar(data || [])
    setLoading(false)
  }

  async function fiyatGuncelle(id: string, yeni_fiyat: number) {
    setSaving(true)
    await supabase.from('fason_fiyat').update({
      birim_fiyat_kg: yeni_fiyat,
      guncelleme: new Date().toISOString()
    }).eq('id', id)
    setMsg('Fiyat guncellendi.')
    setDuzenle(null)
    load()
    setSaving(false)
    setTimeout(() => setMsg(''), 3000)
  }

  const TUR_LABEL: Record<string, string> = {
    doypack: 'Doypack',
    sirt_kaynak: 'Sirt kaynak',
    quadro: 'Quadro',
    flat_bottom: 'Flat bottom',
    diger: 'Diger',
  }

  const turler = [...new Set(fasonFiyatlar.map(f => f.tur))]

  if (loading) return <div className="p-8 text-gray-400 text-sm">Yukleniyor...</div>

  return (
    <div className="p-6 max-w-3xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">Fason Fiyat Listesi</h1>
          <p className="text-gray-500 text-xs mt-0.5">Doypack, quadro, flat bottom kesim fiyatlari</p>
        </div>
      </div>

      {msg && (
        <div className="mb-4 bg-green-50 text-green-700 text-sm rounded-lg px-4 py-3 border border-green-200">
          {msg}
        </div>
      )}

      <div className="space-y-4">
        {turler.map(tur => (
          <div key={tur} className="card">
            <div className="card-header">
              <span className="font-medium text-sm">{TUR_LABEL[tur] || tur}</span>
            </div>
            <div className="overflow-hidden">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Adet agirligi</th>
                    <th>Birim fiyat (USD/kg)</th>
                    <th>Son guncelleme</th>
                    <th>Islem</th>
                  </tr>
                </thead>
                <tbody>
                  {fasonFiyatlar.filter(f => f.tur === tur).map(f => (
                    <tr key={f.id}>
                      <td className="text-sm">
                        {f.min_gram} g — {f.max_gram ? f.max_gram + ' g' : 've uzeri'}
                      </td>
                      <td>
                        {duzenle?.id === f.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.0001"
                              defaultValue={f.birim_fiyat_kg}
                              id={`fiyat-${f.id}`}
                              className="w-28"
                            />
                            <button
                              onClick={() => {
                                const el = document.getElementById(`fiyat-${f.id}`) as HTMLInputElement
                                fiyatGuncelle(f.id, parseFloat(el.value))
                              }}
                              disabled={saving}
                              className="btn btn-sm btn-success"
                            >
                              Kaydet
                            </button>
                            <button onClick={() => setDuzenle(null)} className="btn btn-sm">Iptal</button>
                          </div>
                        ) : (
                          <span className="font-semibold text-green-700">
                            ${parseFloat(f.birim_fiyat_kg).toFixed(4)}
                          </span>
                        )}
                      </td>
                      <td className="text-gray-400 text-xs">
                        {new Date(f.guncelleme).toLocaleDateString('tr-TR')}
                      </td>
                      <td>
                        {duzenle?.id !== f.id && (
                          <button onClick={() => setDuzenle(f)} className="btn btn-sm">
                            Duzenle
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 card card-body bg-blue-50 border border-blue-100">
        <div className="text-xs text-blue-800 leading-relaxed">
          <div className="font-medium mb-1">Fason maliyet nasil hesaplaniyor?</div>
          <div>1 adet urunun gram agirligi hesaplanir (film + zip varsa zip)</div>
          <div>O agirlik hangi kademeye giriyorsa o birim fiyat uygulanir</div>
          <div>Toplam fason maliyet = toplam mamul kg x birim fiyat</div>
        </div>
      </div>
    </div>
  )
}
