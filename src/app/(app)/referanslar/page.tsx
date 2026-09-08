'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

const TUR_LABEL: Record<string, string> = {
  doypack: 'Doypack',
  sirt_kaynak: 'Sirt kaynak',
  quadro: 'Quadro',
  flat_bottom: 'Flat bottom',
  diger: 'Diger',
}

export default function ReferanslarPage() {
  const { user } = useAuth()
  const isAdmin = user?.rol === 'admin'

  const [parametre, setParametre] = useState<any>(null)
  const [taslak, setTaslak] = useState<any>(null)
  const [fasonFiyatlar, setFasonFiyatlar] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [duzenle, setDuzenle] = useState<any>(null)
  const [yeniAralik, setYeniAralik] = useState<{ tur: string; min_gram: string; max_gram: string; birim_fiyat_kg: string } | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: p }, { data: ff }] = await Promise.all([
      supabase.from('referans_parametre').select('*').eq('id', 1).single(),
      supabase.from('fason_fiyat').select('*').eq('aktif', true).order('tur').order('min_gram'),
    ])
    setParametre(p)
    setTaslak(p)
    setFasonFiyatlar(ff || [])
    setLoading(false)
  }

  async function parametreKaydet() {
    setSaving(true)
    const { error } = await supabase.from('referans_parametre').update({
      boya_fiyat_kg: parseFloat(taslak.boya_fiyat_kg),
      tutkal_fiyat_kg: parseFloat(taslak.tutkal_fiyat_kg),
      iscilik_fiyat_kg: parseFloat(taslak.iscilik_fiyat_kg),
      baslangic_fire_kg: parseFloat(taslak.baslangic_fire_kg),
      ortalama_kenar_fire_pct: parseFloat(taslak.ortalama_kenar_fire_pct),
      guncelleyen_id: user?.id || null,
      guncelleme: new Date().toISOString(),
    }).eq('id', 1)
    if (!error) { setMsg('Parametreler guncellendi.'); load() }
    else { setMsg('Hata: ' + error.message) }
    setSaving(false)
    setTimeout(() => setMsg(''), 3000)
  }

  async function fasonFiyatGuncelle(id: string, yeni_fiyat: number) {
    setSaving(true)
    await supabase.from('fason_fiyat').update({
      birim_fiyat_kg: yeni_fiyat,
      guncelleme: new Date().toISOString(),
    }).eq('id', id)
    setMsg('Fason fiyati guncellendi.')
    setDuzenle(null)
    load()
    setSaving(false)
    setTimeout(() => setMsg(''), 3000)
  }

  async function yeniAralikEkle() {
    if (!yeniAralik) return
    setSaving(true)
    const { error } = await supabase.from('fason_fiyat').insert({
      tur: yeniAralik.tur,
      min_gram: parseFloat(yeniAralik.min_gram),
      max_gram: yeniAralik.max_gram ? parseFloat(yeniAralik.max_gram) : null,
      birim_fiyat_kg: parseFloat(yeniAralik.birim_fiyat_kg),
      aktif: true,
      guncelleme: new Date().toISOString(),
    })
    if (!error) { setMsg('Yeni aralik eklendi.'); setYeniAralik(null); load() }
    else { setMsg('Hata: ' + error.message) }
    setSaving(false)
    setTimeout(() => setMsg(''), 3000)
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Yukleniyor...</div>

  const turler = fasonFiyatlar.map(f => f.tur).filter((v, i, a) => a.indexOf(v) === i)

  return (
    <div className="p-6 max-w-3xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">Referanslar</h1>
          <p className="text-gray-500 text-xs mt-0.5">
            Boya, tutkal, iscilik, baslangic firesi, ortalama kenar firesi ve fason kesim fiyatlari — sadece yonetici degistirebilir.
            Hizli Hesap Makinesi ve fiyatlama motoru buradaki degerleri kullanir.
          </p>
        </div>
      </div>

      {msg && (
        <div className="mb-4 bg-green-50 text-green-700 text-sm rounded-lg px-4 py-3 border border-green-200">{msg}</div>
      )}

      {!isAdmin && (
        <div className="mb-4 bg-amber-50 text-amber-800 text-xs rounded-lg px-4 py-3 border border-amber-200">
          Bu sayfadaki degerleri sadece admin rolundeki kullanicilar degistirebilir. Sen sadece goruntuleyebilirsin.
        </div>
      )}

      <div className="card card-body space-y-3 mb-6">
        <div className="font-medium text-sm mb-1">Genel maliyet parametreleri</div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-400">Boya fiyati (USD/kg)</label>
            {isAdmin ? (
              <input type="number" step="0.01" value={taslak.boya_fiyat_kg} onChange={e => setTaslak({ ...taslak, boya_fiyat_kg: e.target.value })} />
            ) : (
              <div className="font-mono text-sm py-1.5">${Number(parametre.boya_fiyat_kg).toFixed(2)}</div>
            )}
          </div>
          <div>
            <label className="text-xs text-gray-400">Tutkal fiyati (USD/kg)</label>
            {isAdmin ? (
              <input type="number" step="0.01" value={taslak.tutkal_fiyat_kg} onChange={e => setTaslak({ ...taslak, tutkal_fiyat_kg: e.target.value })} />
            ) : (
              <div className="font-mono text-sm py-1.5">${Number(parametre.tutkal_fiyat_kg).toFixed(2)}</div>
            )}
          </div>
          <div>
            <label className="text-xs text-gray-400">Iscilik (USD/kg)</label>
            {isAdmin ? (
              <input type="number" step="0.01" value={taslak.iscilik_fiyat_kg} onChange={e => setTaslak({ ...taslak, iscilik_fiyat_kg: e.target.value })} />
            ) : (
              <div className="font-mono text-sm py-1.5">${Number(parametre.iscilik_fiyat_kg).toFixed(2)}</div>
            )}
          </div>
          <div>
            <label className="text-xs text-gray-400">Baslangic firesi (kg)</label>
            {isAdmin ? (
              <input type="number" step="1" value={taslak.baslangic_fire_kg} onChange={e => setTaslak({ ...taslak, baslangic_fire_kg: e.target.value })} />
            ) : (
              <div className="font-mono text-sm py-1.5">{Number(parametre.baslangic_fire_kg).toFixed(0)} kg</div>
            )}
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-400">Ortalama kenar firesi (%) — kato eni henuz belli olmadan hizli teklif icin kullanilan varsayim</label>
            {isAdmin ? (
              <input type="number" step="0.1" value={taslak.ortalama_kenar_fire_pct} onChange={e => setTaslak({ ...taslak, ortalama_kenar_fire_pct: e.target.value })} />
            ) : (
              <div className="font-mono text-sm py-1.5">%{Number(parametre.ortalama_kenar_fire_pct).toFixed(1)}</div>
            )}
          </div>
        </div>
        {isAdmin && (
          <button onClick={parametreKaydet} disabled={saving} className="btn btn-primary btn-sm mt-2">
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        )}
      </div>

      <div className="space-y-4">
        <div className="font-medium text-sm">Fason kesim fiyatlari (adet agirligina gore)</div>
        {turler.map(tur => (
          <div key={tur} className="card">
            <div className="card-header"><span className="font-medium text-sm">{TUR_LABEL[tur] || tur}</span></div>
            <div className="overflow-hidden">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Adet agirligi</th>
                    <th>Birim fiyat (USD/kg)</th>
                    <th>Son guncelleme</th>
                    {isAdmin && <th>Islem</th>}
                  </tr>
                </thead>
                <tbody>
                  {fasonFiyatlar.filter(f => f.tur === tur).map(f => (
                    <tr key={f.id}>
                      <td className="text-sm">{f.min_gram} g — {f.max_gram ? f.max_gram + ' g' : 've uzeri'}</td>
                      <td>
                        {duzenle?.id === f.id ? (
                          <div className="flex items-center gap-2">
                            <input type="number" step="0.0001" defaultValue={f.birim_fiyat_kg} id={`fiyat-${f.id}`} className="w-28" />
                            <button onClick={() => {
                              const el = document.getElementById(`fiyat-${f.id}`) as HTMLInputElement
                              fasonFiyatGuncelle(f.id, parseFloat(el.value))
                            }} disabled={saving} className="btn btn-sm btn-success">Kaydet</button>
                            <button onClick={() => setDuzenle(null)} className="btn btn-sm">Iptal</button>
                          </div>
                        ) : (
                          <span className="font-semibold text-green-700">${parseFloat(f.birim_fiyat_kg).toFixed(4)}</span>
                        )}
                      </td>
                      <td className="text-gray-400 text-xs">{new Date(f.guncelleme).toLocaleDateString('tr-TR')}</td>
                      {isAdmin && (
                        <td>
                          {duzenle?.id !== f.id && (
                            <button onClick={() => setDuzenle(f)} className="btn btn-sm">Duzenle</button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {isAdmin && (
              <div className="px-4 py-3 border-t border-gray-100">
                {yeniAralik?.tur === tur ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <input type="number" placeholder="min g" value={yeniAralik.min_gram} onChange={e => setYeniAralik({ ...yeniAralik, min_gram: e.target.value })} className="!w-24" />
                    <input type="number" placeholder="max g (bos=sinirsiz)" value={yeniAralik.max_gram} onChange={e => setYeniAralik({ ...yeniAralik, max_gram: e.target.value })} className="!w-36" />
                    <input type="number" step="0.0001" placeholder="USD/kg" value={yeniAralik.birim_fiyat_kg} onChange={e => setYeniAralik({ ...yeniAralik, birim_fiyat_kg: e.target.value })} className="!w-28" />
                    <button onClick={yeniAralikEkle} disabled={saving} className="btn btn-sm btn-success">Ekle</button>
                    <button onClick={() => setYeniAralik(null)} className="btn btn-sm">Iptal</button>
                  </div>
                ) : (
                  <button onClick={() => setYeniAralik({ tur, min_gram: '', max_gram: '', birim_fiyat_kg: '' })} className="btn btn-sm">+ Yeni aralik ekle ({TUR_LABEL[tur] || tur})</button>
                )}
              </div>
            )}
          </div>
        ))}
        <div className="card card-body bg-amber-50 border border-amber-100 text-xs text-amber-800">
          Not: Doypack icin su an sadece 3.000-3.500g araligi tanimli. Daha buyuk doypack'ler icin fason fiyati
          tanimli degil — Hizli Hesap Makinesi'nde bu durumda uyari cikar ve fason maliyeti 0 sayilir.
          Yukaridan "Doypack" kartina yeni bir agirlik araligi ekleyerek bunu tamamlayabilirsin.
        </div>
      </div>
    </div>
  )
}
