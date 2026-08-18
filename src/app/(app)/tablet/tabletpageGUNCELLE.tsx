'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ADIM_LABEL, sonrakiAdimiAc } from '@/lib/uretimAkis'

// Operatorlerin sahada kullanacagi, buyuk butonlu, minimum yazi ile
// hizli baslat/bitir arayuzu. Bir makine secip o makinenin sirasi
// gelen isini gorur.
export default function TabletPage() {
  const [makineler, setMakineler] = useState<any[]>([])
  const [secilenMakine, setSecilenMakine] = useState('')
  const [planlar, setPlanlar] = useState<any[]>([])
  const [aktifAdim, setAktifAdim] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [bitirEkrani, setBitirEkrani] = useState(false)
  const [form, setForm] = useState({ uretilen_metre: '', uretilen_kg: '', durus_dk: '0', notlar: '' })

  useEffect(() => { load() }, [])
  useEffect(() => { if (secilenMakine) loadMakinePlani() }, [secilenMakine])

  async function load() {
    const { data: m } = await supabase.from('makine_tanim').select('*').eq('aktif', true).order('kod')
    setMakineler(m || [])
    setLoading(false)
  }

  async function loadMakinePlani() {
    const { data: p } = await supabase.from('uretim_plani')
      .select('*, proje:proje(proje_no,ad,en_mm,boy_mm)')
      .eq('makine_id', secilenMakine).in('durum', ['hazir', 'calisiyor'])
      .order('planlanan_tarih').order('adim_sira')
    setPlanlar(p || [])
    const calisan = (p || []).find(x => x.durum === 'calisiyor')
    if (calisan) {
      const { data: a } = await supabase.from('uretim_adim').select('*').eq('plan_id', calisan.id).is('bitis', null).order('baslangic', { ascending: false }).limit(1).single()
      setAktifAdim(a)
    } else {
      setAktifAdim(null)
    }
  }

  const guncelIs = planlar[0]

  async function baslat() {
    if (!guncelIs) return
    setSaving(true)
    const { data: a } = await supabase.from('uretim_adim').insert({
      plan_id: guncelIs.id, proje_id: guncelIs.proje_id, makine_id: secilenMakine,
      baslangic: new Date().toISOString(),
    }).select().single()
    await supabase.from('uretim_plani').update({ durum: 'calisiyor' }).eq('id', guncelIs.id)
    setAktifAdim(a)
    setSaving(false)
    loadMakinePlani()
  }

  async function bitir() {
    if (!aktifAdim || !guncelIs) return
    setSaving(true)
    const bitis = new Date()
    const baslangic = new Date(aktifAdim.baslangic)
    const sureDk = Math.max(1, Math.round((bitis.getTime() - baslangic.getTime()) / 60000))
    const metre = parseFloat(form.uretilen_metre) || 0
    await supabase.from('uretim_adim').update({
      bitis: bitis.toISOString(), sure_dk: sureDk,
      uretilen_metre: metre || null, uretilen_kg: parseFloat(form.uretilen_kg) || null,
      hiz_m_dk: sureDk > 0 ? metre / sureDk : null,
      durus_dk: parseInt(form.durus_dk) || 0,
      notlar: form.notlar || null,
    }).eq('id', aktifAdim.id)
    await supabase.from('uretim_plani').update({ durum: 'tamamlandi' }).eq('id', guncelIs.id)
    // Bu adim bitti — siradaki adimi ac (kurlenme varsa otomatik atlanir,
    // bir sonraki gercek adim operatorun tablet panelinde "hazir" olarak belirir).
    await sonrakiAdimiAc(guncelIs.proje_id, guncelIs.adim_sira)
    setForm({ uretilen_metre: '', uretilen_kg: '', durus_dk: '0', notlar: '' })
    setBitirEkrani(false)
    setAktifAdim(null)
    setSaving(false)
    loadMakinePlani()
  }

  if (loading) return <div className="p-8 text-gray-400 text-lg">Yukleniyor...</div>

  if (!secilenMakine) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">Makinenizi secin</h1>
        <div className="grid grid-cols-2 gap-4">
          {makineler.map(m => (
            <button key={m.id} onClick={() => setSecilenMakine(m.id)}
              className="card card-body text-center py-8 text-xl font-semibold hover:shadow-lg hover:border-blue-400 transition-all cursor-pointer">
              {m.ad}
            </button>
          ))}
        </div>
      </div>
    )
  }

  const makine = makineler.find(m => m.id === secilenMakine)

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">{makine?.ad}</h1>
        <button onClick={() => { setSecilenMakine(''); setBitirEkrani(false) }} className="btn">Makine degistir</button>
      </div>

      {!guncelIs && (
        <div className="card card-body text-center py-16 text-gray-400 text-xl">Bu makine icin bekleyen is yok</div>
      )}

      {guncelIs && !bitirEkrani && (
        <div className="card card-body py-10 text-center">
          <div className="text-3xl font-bold text-gray-900 mb-2">{ADIM_LABEL[guncelIs.adim_tur] || guncelIs.adim_tur}</div>
          <div className="text-lg text-gray-500 mb-1">{guncelIs.proje?.ad}</div>
          <div className="font-mono text-gray-400 mb-8">{guncelIs.proje?.proje_no}</div>
          {guncelIs.proje?.en_mm && (
            <div className="text-sm text-gray-500 mb-8">Ebat: {guncelIs.proje.en_mm} × {guncelIs.proje.boy_mm} mm</div>
          )}

          {guncelIs.durum === 'hazir' && (
            <button onClick={baslat} disabled={saving}
              className="w-full py-6 rounded-2xl bg-green-600 text-white text-2xl font-bold hover:bg-green-700 transition-colors disabled:opacity-50">
              ▶ BASLAT
            </button>
          )}
          {guncelIs.durum === 'calisiyor' && (
            <button onClick={() => setBitirEkrani(true)}
              className="w-full py-6 rounded-2xl bg-red-600 text-white text-2xl font-bold hover:bg-red-700 transition-colors">
              ■ BITIR
            </button>
          )}
        </div>
      )}

      {guncelIs && bitirEkrani && (
        <div className="card card-body py-8 space-y-5">
          <div className="text-2xl font-bold text-gray-900 text-center mb-4">Uretim Bilgileri</div>
          <div>
            <label className="!text-base">Uretilen metre</label>
            <input type="number" autoFocus value={form.uretilen_metre} onChange={e => setForm(f => ({ ...f, uretilen_metre: e.target.value }))}
              className="!text-2xl !py-4 text-center" />
          </div>
          <div>
            <label className="!text-base">Uretilen kg</label>
            <input type="number" value={form.uretilen_kg} onChange={e => setForm(f => ({ ...f, uretilen_kg: e.target.value }))}
              className="!text-2xl !py-4 text-center" />
          </div>
          <div>
            <label className="!text-base">Durus suresi (dk, varsa)</label>
            <input type="number" value={form.durus_dk} onChange={e => setForm(f => ({ ...f, durus_dk: e.target.value }))}
              className="!text-2xl !py-4 text-center" />
          </div>
          <div>
            <label className="!text-base">Not (opsiyonel)</label>
            <textarea value={form.notlar} onChange={e => setForm(f => ({ ...f, notlar: e.target.value }))}
              rows={3} className="!text-lg w-full" placeholder="Ornek: renk sapmasi oldu, 2. rulo iskartaya ayrildi..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setBitirEkrani(false)} className="flex-1 py-4 rounded-xl border border-gray-200 text-lg font-medium">Geri</button>
            <button onClick={bitir} disabled={saving} className="flex-1 py-4 rounded-xl bg-blue-600 text-white text-lg font-bold disabled:opacity-50">Tamamla</button>
          </div>
        </div>
      )}
    </div>
  )
}
