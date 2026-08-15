'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { projeRotasiHesapla, katoEniHesapla } from '@/types'
import type { MalzemeTanim, Musteri, ProjeKatman } from '@/types'

const CIKTI_TURLERI = [
  { value:'bobin',        label:'Bobin (rulo)' },
  { value:'doypack',      label:'Doypack' },
  { value:'quadro',       label:'Quadro bag' },
  { value:'flat_bottom',  label:'Flat bottom' },
  { value:'sirt_kaynak',  label:'Sirt kaynak torba' },
  { value:'yan_kesim',    label:'Yan kesim torba' },
  { value:'katlama_torba',label:'Katlama torba (Silka tipi)' },
  { value:'diger',        label:'Diger' },
]

const ADIM_LABEL: Record<string, string> = {
  baski:'Baski', laminasyon_1:'Laminasyon 1', laminasyon_2:'Laminasyon 2',
  laminasyon_3:'Laminasyon 3', kurleme_1:'Kurleme 1 (24-48 saat)',
  kurleme_2:'Kurleme 2 (24-48 saat)', kurleme_3:'Kurleme 3 (24-48 saat)',
  dilimleme:'Dilimleme', katlama:'Katlama', yan_kesim:'Yan kesim',
  doypack:'Doypack kesim (Fason)', quadro:'Quadro kesim (Fason)',
  flat_bottom:'Flat bottom (Fason)', sirt_kaynak:'Sirt kaynak (Fason)',
  sonic:'Sonic islem', diger:'Diger',
}

const ADIM_RENK: Record<string, string> = {
  baski:'bg-blue-100 text-blue-800', laminasyon_1:'bg-teal-100 text-teal-800',
  laminasyon_2:'bg-teal-100 text-teal-800', laminasyon_3:'bg-teal-100 text-teal-800',
  kurleme_1:'bg-amber-100 text-amber-800', kurleme_2:'bg-amber-100 text-amber-800',
  kurleme_3:'bg-amber-100 text-amber-800', dilimleme:'bg-green-100 text-green-800',
  katlama:'bg-purple-100 text-purple-800', yan_kesim:'bg-red-100 text-red-800',
  doypack:'bg-gray-100 text-gray-800', quadro:'bg-gray-100 text-gray-800',
  flat_bottom:'bg-gray-100 text-gray-800', sirt_kaynak:'bg-gray-100 text-gray-800',
  sonic:'bg-pink-100 text-pink-800',
}

interface FormState {
  musteri_id: string; ad: string; aciklama: string
  cikti_turu: string
  en_mm: string; boy_mm: string; kurek_mm: string; kapak_mm: string
  bobin_en_mm: string; bobin_cap_mm: string; bobin_metre: string
  urun_bobin_en_mm: string; bant_sayisi: string
  baskili: boolean; baskili_yuz: string; renk_sayisi: string
  kazan_cap_mm: string; fotosel_cm: string
  yan_yana_baski: string
  zip_var: boolean; sonic_var: boolean; mexika_deligi: boolean; kargo_bandi: boolean
  numune_var: boolean
  kenar_tirasi_mm: string
  notlar: string
}

export default function YeniProjePage() {
  const router = useRouter()
  const [musteriler, setMusteriler] = useState<Musteri[]>([])
  const [malzemeler, setMalzemeler] = useState<MalzemeTanim[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const [form, setForm] = useState<FormState>({
    musteri_id:'', ad:'', aciklama:'',
    cikti_turu:'bobin',
    en_mm:'', boy_mm:'', kurek_mm:'', kapak_mm:'',
    bobin_en_mm:'', bobin_cap_mm:'', bobin_metre:'',
    urun_bobin_en_mm:'', bant_sayisi:'',
    baskili:false, baskili_yuz:'ust', renk_sayisi:'1',
    kazan_cap_mm:'', fotosel_cm:'',
    yan_yana_baski:'1',
    zip_var:false, sonic_var:false, mexika_deligi:false, kargo_bandi:false,
    numune_var:false,
    kenar_tirasi_mm:'',
    notlar:'',
  })

  const [katmanlar, setKatmanlar] = useState<ProjeKatman[]>([
    { sira:1, malzeme_id:'', mikron:0, baskili:false, laminasyon_onceki:false }
  ])

  useEffect(() => {
    Promise.all([
      supabase.from('musteri_tanim').select('*').eq('aktif',true).order('ad'),
      supabase.from('malzeme_tanim').select('*').eq('aktif',true).order('ad'),
    ]).then(([{ data:m }, { data:mal }]) => {
      setMusteriler((m || []) as Musteri[])
      setMalzemeler((mal || []) as MalzemeTanim[])
    })
  }, [])

  function setF(k: keyof FormState, v: any) {
    setForm(p => ({ ...p, [k]: v }))
  }

  function katmanEkle() {
    setKatmanlar(p => [...p, {
      sira: p.length + 1,
      malzeme_id:'', mikron:0, baskili:false,
      laminasyon_onceki: p.length > 0,
    }])
  }

  function katmanSil(i: number) {
    if (katmanlar.length <= 1) return
    setKatmanlar(p => p.filter((_,j) => j !== i).map((k,j) => ({ ...k, sira:j+1 })))
  }

  function katmanGuncelle(i: number, alan: string, val: any) {
    setKatmanlar(p => p.map((k,j) => j === i ? { ...k, [alan]:val } : k))
  }

  const n = (s: string) => parseFloat(s) || 0
  const ni = (s: string) => parseInt(s) || 0

  // Baskili durumu katmanlardan turetilir (fiyatlama motoruyla ayni mantik) —
  // form.baskili alaninin arayuzde girisi yok, tek basina kullanilmaz.
  const baskiliDerived = katmanlar.some(k => k.baskili)

  // Otomatik rota
  const rota = projeRotasiHesapla(
    {
      baskili: baskiliDerived,
      sonic_var: form.sonic_var,
      cikti_turu: form.cikti_turu as any,
    },
    katmanlar
  )

  // Kato eni hesabi
  const katoEni = katoEniHesapla({
    en_mm: n(form.en_mm),
    boy_mm: n(form.boy_mm),
    kurek_mm: n(form.kurek_mm),
    kapak_mm: n(form.kapak_mm),
    bobin_en_mm: n(form.bobin_en_mm),
    yan_yana_baski: ni(form.yan_yana_baski),
    cikti_turu: form.cikti_turu as any,
  })

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setMsg('')

    if (!form.musteri_id || !form.ad || katmanlar.some(k => !k.malzeme_id || !k.mikron)) {
      setMsg('Musteri, urun adi ve tum katman bilgilerini doldurun.')
      setSaving(false); return
    }

    const { count } = await supabase.from('proje').select('id', { count:'exact', head:true })
    const no = `YEN-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4,'0')}`

    const { data: proje, error } = await supabase.from('proje').insert({
      proje_no: no,
      musteri_id: form.musteri_id,
      ad: form.ad,
      aciklama: form.aciklama || null,
      cikti_turu: form.cikti_turu,
      en_mm: n(form.en_mm) || null,
      boy_mm: n(form.boy_mm) || null,
      kurek_mm: n(form.kurek_mm) || null,
      kapak_mm: n(form.kapak_mm) || null,
      bobin_en_mm: n(form.bobin_en_mm) || null,
      bobin_cap_mm: n(form.bobin_cap_mm) || null,
      bobin_metre: n(form.bobin_metre) || null,
      urun_bobin_en_mm: n(form.urun_bobin_en_mm) || null,
      bant_sayisi: ni(form.bant_sayisi) || null,
      baskili: baskiliDerived,
      baskili_yuz: baskiliDerived ? form.baskili_yuz : null,
      renk_sayisi: baskiliDerived ? ni(form.renk_sayisi) : null,
      kazan_cap_mm: baskiliDerived ? (n(form.kazan_cap_mm) || null) : null,
      fotosel_cm: baskiliDerived ? (n(form.fotosel_cm) || null) : null,
      kato_eni_mm: katoEni || null,
      yan_yana_baski: ni(form.yan_yana_baski),
      zip_var: form.zip_var,
      sonic_var: form.sonic_var,
      mexika_deligi: form.mexika_deligi,
      kargo_bandi: form.kargo_bandi,
      numune_var: form.numune_var,
      kenar_tirasi_mm: n(form.kenar_tirasi_mm) || null,
      notlar: form.notlar || null,
      durum: 'taslak',
    }).select().single()

    if (error) { setMsg('Hata: ' + error.message); setSaving(false); return }

    await supabase.from('proje_katman').insert(
      katmanlar.map(k => ({ ...k, proje_id: proje.id }))
    )

    router.push(`/projeler/${proje.id}`)
  }

  const showBobin = form.cikti_turu === 'bobin'
  const showEbat = form.cikti_turu !== 'bobin'

  return (
    <div className="p-6 max-w-4xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">Yeni proje</h1>
          <p className="text-gray-500 text-xs mt-0.5">Her musteri siparisi icin ayri proje olusturun</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="card">
          <div className="card-header"><span className="font-medium">Temel bilgiler</span></div>
          <div className="card-body space-y-4">
            <div className="form-grid-2">
              <div>
                <label>Musteri</label>
                <select value={form.musteri_id} onChange={e => setF('musteri_id', e.target.value)} required>
                  <option value="">Secin...</option>
                  {musteriler.map(m => <option key={m.id} value={m.id}>{m.ad}</option>)}
                </select>
              </div>
              <div>
                <label>Urun / proje adi</label>
                <input value={form.ad} onChange={e => setF('ad', e.target.value)}
                  placeholder="Ornek: Silka Okul Seti Torbasi" required />
              </div>
            </div>
            <div>
              <label>Aciklama (opsiyonel)</label>
              <textarea value={form.aciklama} onChange={e => setF('aciklama', e.target.value)}
                rows={2} placeholder="Musteri notu veya ozel istek..." />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="font-medium">Cikti turu ve ebatlar</span></div>
          <div className="card-body space-y-4">
            <div>
              <label>Cikti turu</label>
              <select value={form.cikti_turu} onChange={e => setF('cikti_turu', e.target.value)}>
                {CIKTI_TURLERI.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>

            {showBobin && (
              <div className="form-grid-3">
                <div><label>Ana bobin eni (mm) — kato eni</label>
                  <input type="number" value={form.bobin_en_mm} onChange={e => setF('bobin_en_mm', e.target.value)} placeholder="350" />
                  <p className="text-xs text-gray-400 mt-0.5">Baskiya giren ham/genis bobinin eni</p></div>
                <div><label>Urun (bitmis) bobin eni (mm)</label>
                  <input type="number" value={form.urun_bobin_en_mm} onChange={e => setF('urun_bobin_en_mm', e.target.value)} placeholder="150" />
                  <p className="text-xs text-gray-400 mt-0.5">Dilimleme sonrasi musteriye giden bobin eni</p></div>
                <div><label>Bant sayisi</label>
                  <input type="number" value={form.bant_sayisi} onChange={e => setF('bant_sayisi', e.target.value)} placeholder="1" min={1} /></div>
                <div><label>Bobin capi (mm)</label>
                  <input type="number" value={form.bobin_cap_mm} onChange={e => setF('bobin_cap_mm', e.target.value)} placeholder="300" /></div>
                <div><label>Bobin metre</label>
                  <input type="number" value={form.bobin_metre} onChange={e => setF('bobin_metre', e.target.value)} placeholder="1500" /></div>
              </div>
            )}

            {showEbat && (
              <div className="form-grid-3">
                <div><label>En (mm)</label>
                  <input type="number" value={form.en_mm} onChange={e => setF('en_mm', e.target.value)} placeholder="200" /></div>
                <div><label>Boy (mm)</label>
                  <input type="number" value={form.boy_mm} onChange={e => setF('boy_mm', e.target.value)} placeholder="300" /></div>
                <div><label>Kurek / korpus (mm)</label>
                  <input type="number" value={form.kurek_mm} onChange={e => setF('kurek_mm', e.target.value)} placeholder="50" /></div>
                <div><label>Kapak payi (mm)</label>
                  <input type="number" value={form.kapak_mm} onChange={e => setF('kapak_mm', e.target.value)} placeholder="50" /></div>
                <div><label>Yan yana baski</label>
                  <select value={form.yan_yana_baski} onChange={e => setF('yan_yana_baski', e.target.value)}>
                    {[1,2,3,4].map(n => <option key={n} value={n}>{n} adet</option>)}
                  </select>
                </div>
                <div><label>Kenar tirasi (her taraftan mm)</label>
                  <input type="number" value={form.kenar_tirasi_mm} onChange={e => setF('kenar_tirasi_mm', e.target.value)} placeholder="5" step="0.5" /></div>
              </div>
            )}

            {katoEni > 0 && (
              <div className="bg-blue-50 rounded-lg px-4 py-3 text-sm text-blue-800">
                Hesaplanan kato eni: <strong>{katoEni.toFixed(0)} mm</strong>
                {ni(form.yan_yana_baski) > 1 && <span className="ml-2 text-blue-600">({form.yan_yana_baski} adet yan yana)</span>}
              </div>
            )}

            <div>
              <label className="mb-2 block">Ozel islemler</label>
              <div className="flex flex-wrap gap-3">
                {[
                  { key:'zip_var' as keyof FormState,       label:'Zip / fermuar' },
                  { key:'sonic_var' as keyof FormState,     label:'Sonic islem' },
                  { key:'mexika_deligi' as keyof FormState, label:'Meksika sapkasi deligi' },
                  { key:'kargo_bandi' as keyof FormState,   label:'Kargo bandi' },
                  { key:'numune_var' as keyof FormState,    label:'Numune var' },
                ].map(opt => (
                  <label key={opt.key} className="flex items-center gap-2 cursor-pointer mb-0">
                    <input type="checkbox" checked={!!form[opt.key]}
                      onChange={e => setF(opt.key, e.target.checked)} className="w-auto" />
                    <span className="text-sm text-gray-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="font-medium">Film katmanlari</span>
            <button type="button" onClick={katmanEkle} className="btn btn-sm btn-primary">+ Katman ekle</button>
          </div>
          <div className="card-body space-y-3">
            {katmanlar.map((k, i) => (
              <div key={i} className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-sm text-gray-700">
                    Katman {k.sira} {i === 0 ? '(dis yuzey)' : i === katmanlar.length-1 ? '(ic yuzey)' : '(ara katman)'}
                  </span>
                  {katmanlar.length > 1 && (
                    <button type="button" onClick={() => katmanSil(i)} className="text-red-400 hover:text-red-600 text-xs">Sil</button>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div className="col-span-2">
                    <label>Malzeme</label>
                    <select value={k.malzeme_id} onChange={e => katmanGuncelle(i, 'malzeme_id', e.target.value)} required>
                      <option value="">Secin...</option>
                      {malzemeler.filter(m => !['BOYA','TUTKAL','SOLVENT','ZIP'].includes(m.tur)).map(m => (
                        <option key={m.id} value={m.id}>{m.ad}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Kalinlik (mikron)</label>
                    <input type="number" value={k.mikron || ''} min={1}
                      onChange={e => katmanGuncelle(i, 'mikron', parseInt(e.target.value) || 0)} required />
                  </div>
                  <div className="flex flex-col gap-2 pt-5">
                    <label className="flex items-center gap-2 cursor-pointer mb-0">
                      <input type="checkbox" checked={k.baskili}
                        onChange={e => katmanGuncelle(i, 'baskili', e.target.checked)} className="w-auto" />
                      <span className="text-xs text-gray-600">Bu katmana baski var</span>
                    </label>
                    {i > 0 && (
                      <label className="flex items-center gap-2 cursor-pointer mb-0">
                        <input type="checkbox" checked={k.laminasyon_onceki}
                          onChange={e => katmanGuncelle(i, 'laminasyon_onceki', e.target.checked)} className="w-auto" />
                        <span className="text-xs text-gray-600">Onceki katmanla lamine</span>
                      </label>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {katmanlar.some(k => k.baskili) && (
              <div className="border border-blue-100 rounded-xl p-4 bg-blue-50">
                <div className="font-medium text-sm text-blue-800 mb-3">Baski detaylari</div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label>Baski yuzu</label>
                    <select value={form.baskili_yuz} onChange={e => setF('baskili_yuz', e.target.value)}>
                      <option value="ust">Ust baski</option>
                      <option value="alt">Alt baski (lamine arasi)</option>
                    </select>
                  </div>
                  <div>
                    <label>Renk sayisi</label>
                    <select value={form.renk_sayisi} onChange={e => setF('renk_sayisi', e.target.value)}>
                      {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n} renk</option>)}
                    </select>
                  </div>
                  <div>
                    <label>Kazan capi (mm)</label>
                    <input type="number" value={form.kazan_cap_mm} onChange={e => setF('kazan_cap_mm', e.target.value)} placeholder="420" /></div>
                  <div>
                    <label>Fotosel (cm)</label>
                    <input type="number" value={form.fotosel_cm} onChange={e => setF('fotosel_cm', e.target.value)} placeholder="21" step="0.1" />
                    <p className="text-xs text-gray-400 mt-0.5">Is emrindeki fotosel araligi (cm)</p></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {rota.length > 0 && (
          <div className="card">
            <div className="card-header"><span className="font-medium">Otomatik uretim rotasi</span></div>
            <div className="card-body">
              <div className="flex flex-wrap gap-2">
                {rota.map((adim, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className={`px-3 py-1.5 rounded-lg text-xs font-medium ${ADIM_RENK[adim] || 'bg-gray-100 text-gray-700'}`}>
                      {i+1}. {ADIM_LABEL[adim] || adim}
                    </span>
                    {i < rota.length-1 && <span className="text-gray-300">→</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-body">
            <label>Notlar</label>
            <textarea value={form.notlar} onChange={e => setF('notlar', e.target.value)} rows={3}
              placeholder="Ozel uretim notu..." />
          </div>
        </div>

        {msg && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3 border border-red-200">{msg}</div>}

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? 'Kaydediliyor...' : 'Projeyi kaydet'}
          </button>
          <button type="button" onClick={() => router.back()} className="btn">Iptal</button>
        </div>
      </form>
    </div>
  )
}
