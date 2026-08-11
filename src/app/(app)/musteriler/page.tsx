'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const SEKTORLER = ['Gida','Tekstil','Kimya','Elektronik','Kirtasiye','Eczane','Kozmetik','Tarim','Diger']
const SEHIRLER = ['Adana','Ankara','Antalya','Bursa','Denizli','Eskisehir','Gaziantep','Istanbul','Izmir','Kayseri','Konya','Mersin','Diger']

export default function YeniMusteriPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [bolum, setBolum] = useState<'temel'|'iletisim'|'adres'|'ticari'>('temel')
  const [form, setForm] = useState({
    ad:'', vergi_no:'', vergi_dairesi:'', sektor:'', sehir:'', ulke:'Turkiye',
    yetkili_ad:'', yetkili_tel:'', yetkili_email:'',
    satis_ad:'', satis_tel:'', satis_email:'',
    muhasebe_ad:'', muhasebe_tel:'', muhasebe_email:'',
    gm_ad:'', gm_tel:'',
    fatura_adresi:'', fatura_ilce:'', fatura_sehir:'', fatura_posta_kodu:'',
    sevk_adresi:'', sevk_ilce:'', sevk_sehir:'', sevk_posta_kodu:'',
    fabrika_adresi:'',
    para_birimi:'USD', vade_gun:'30', kredi_limiti:'',
    tercih_notlari:'', notlar:'',
  })

  function setF(k: string, v: string) { setForm(p => ({...p, [k]:v})) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setMsg('')
    if (!form.ad.trim()) { setMsg('Firma adi zorunlu.'); setSaving(false); return }

    const { count } = await supabase.from('musteri_tanim').select('id', {count:'exact', head:true})
    const kod = `MUS-${String((count||0)+1).padStart(4,'0')}`

    const { error } = await supabase.from('musteri_tanim').insert({
      ad: form.ad.trim(), kod,
      vergi_no: form.vergi_no||null,
      vergi_dairesi: form.vergi_dairesi||null,
      sektor: form.sektor||null,
      sehir: form.sehir||null,
      ulke: form.ulke||'Turkiye',
      iletisim_ad: form.yetkili_ad||null,
      telefon: form.yetkili_tel||null,
      email: form.yetkili_email||null,
      adres: form.fatura_adresi||null,
      para_birimi: form.para_birimi,
      vade_gun: parseInt(form.vade_gun)||30,
      kredi_limiti: parseFloat(form.kredi_limiti)||0,
      notlar: JSON.stringify({
        satis: {ad:form.satis_ad,tel:form.satis_tel,email:form.satis_email},
        muhasebe: {ad:form.muhasebe_ad,tel:form.muhasebe_tel,email:form.muhasebe_email},
        gm: {ad:form.gm_ad,tel:form.gm_tel},
        fatura_adresi: {adres:form.fatura_adresi,ilce:form.fatura_ilce,sehir:form.fatura_sehir,posta:form.fatura_posta_kodu},
        sevk_adresi: {adres:form.sevk_adresi,ilce:form.sevk_ilce,sehir:form.sevk_sehir,posta:form.sevk_posta_kodu},
        fabrika_adresi: form.fabrika_adresi,
        tercih_notlari: form.tercih_notlari,
        genel_notlar: form.notlar,
      }),
      aktif: true,
    })

    if (error) { setMsg('Hata: '+error.message); setSaving(false); return }
    router.push('/musteriler')
  }

  const Tab = ({k, l}: {k: typeof bolum, l: string}) => (
    <button type="button" onClick={()=>setBolum(k)}
      className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${bolum===k?'border-blue-600 text-blue-600 font-medium':'border-transparent text-gray-500 hover:text-gray-700'}`}>
      {l}
    </button>
  )

  const Field = ({label, k, type='text', placeholder='', required=false, col=1}: any) => (
    <div className={col===2?'col-span-2':''}>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}{required&&<span className="text-red-500 ml-0.5">*</span>}</label>
      <input type={type} value={(form as any)[k]} onChange={e=>setF(k,e.target.value)} placeholder={placeholder} required={required} />
    </div>
  )

  return (
    <div className="p-6 max-w-3xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">Yeni musteri</h1>
          <p className="text-gray-500 text-xs mt-0.5">Sadece firma adi zorunlu, diger alanlar sonradan doldurulabilir</p>
        </div>
      </div>

      <form onSubmit={handleSave}>
        {/* Sekmeler */}
        <div className="flex gap-0 mb-0 border-b border-gray-200">
          <Tab k="temel" l="Firma bilgileri" />
          <Tab k="iletisim" l="Iletisim" />
          <Tab k="adres" l="Adresler" />
          <Tab k="ticari" l="Ticari" />
        </div>

        <div className="card rounded-tl-none mt-0" style={{borderTopLeftRadius:0}}>
          <div className="card-body">

            {/* TEMEL */}
            {bolum === 'temel' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Firma unvani <span className="text-red-500">*</span></label>
                  <input value={form.ad} onChange={e=>setF('ad',e.target.value)}
                    placeholder="ABC Gida San. Tic. A.S." required
                    className="text-base font-medium" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Vergi numarasi" k="vergi_no" placeholder="1234567890" />
                  <Field label="Vergi dairesi" k="vergi_dairesi" placeholder="Kadikoy" />
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Sektor</label>
                    <select value={form.sektor} onChange={e=>setF('sektor',e.target.value)}>
                      <option value="">Secin...</option>
                      {SEKTORLER.map(s=><option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Sehir</label>
                    <select value={form.sehir} onChange={e=>setF('sehir',e.target.value)}>
                      <option value="">Secin...</option>
                      {SEHIRLER.map(s=><option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="bg-blue-50 rounded-lg px-4 py-3 text-xs text-blue-700">
                  Sadece firma adini girerek hizli kayit yapabilirsiniz. Diger bilgileri sonradan musteri detay sayfasindan doldurabilirsiniz.
                </div>
              </div>
            )}

            {/* ILETISIM */}
            {bolum === 'iletisim' && (
              <div className="space-y-5">
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Satin alma / Ana yetkili</div>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Ad soyad" k="yetkili_ad" placeholder="Ahmet Yilmaz" />
                    <Field label="Telefon" k="yetkili_tel" type="tel" placeholder="0532 xxx xx xx" />
                    <Field label="E-posta" k="yetkili_email" type="email" placeholder="ahmet@firma.com" />
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Satis sorumlusu</div>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Ad soyad" k="satis_ad" placeholder="Mehmet Kaya" />
                    <Field label="Telefon" k="satis_tel" type="tel" placeholder="0533 xxx xx xx" />
                    <Field label="E-posta" k="satis_email" type="email" placeholder="mehmet@firma.com" />
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Muhasebe</div>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Ad soyad" k="muhasebe_ad" placeholder="Ayse Demir" />
                    <Field label="Telefon" k="muhasebe_tel" type="tel" placeholder="0534 xxx xx xx" />
                    <Field label="E-posta" k="muhasebe_email" type="email" placeholder="muhasebe@firma.com" />
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Genel mudur / Sahip</div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Ad soyad" k="gm_ad" placeholder="Ali Veli" />
                    <Field label="Telefon" k="gm_tel" type="tel" placeholder="0535 xxx xx xx" />
                  </div>
                </div>
              </div>
            )}

            {/* ADRES */}
            {bolum === 'adres' && (
              <div className="space-y-5">
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Fatura adresi</div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Adres</label>
                      <textarea value={form.fatura_adresi} onChange={e=>setF('fatura_adresi',e.target.value)} rows={2} placeholder="Mahalle, cadde, sokak, bina no..." />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="Ilce" k="fatura_ilce" placeholder="Kadikoy" />
                      <Field label="Sehir" k="fatura_sehir" placeholder="Istanbul" />
                      <Field label="Posta kodu" k="fatura_posta_kodu" placeholder="34710" />
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sevk adresi</div>
                    <button type="button" className="text-xs text-blue-600 hover:underline"
                      onClick={()=>setForm(p=>({...p,sevk_adresi:p.fatura_adresi,sevk_ilce:p.fatura_ilce,sevk_sehir:p.fatura_sehir,sevk_posta_kodu:p.fatura_posta_kodu}))}>
                      Fatura adresiyle ayni
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Adres</label>
                      <textarea value={form.sevk_adresi} onChange={e=>setF('sevk_adresi',e.target.value)} rows={2} placeholder="Sevkiyat adresi..." />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="Ilce" k="sevk_ilce" placeholder="Esenyurt" />
                      <Field label="Sehir" k="sevk_sehir" placeholder="Istanbul" />
                      <Field label="Posta kodu" k="sevk_posta_kodu" placeholder="34510" />
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Fabrika / Depo (opsiyonel)</div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Adres</label>
                    <textarea value={form.fabrika_adresi} onChange={e=>setF('fabrika_adresi',e.target.value)} rows={2} placeholder="Fabrika veya depo adresi..." />
                  </div>
                </div>
              </div>
            )}

            {/* TICARI */}
            {bolum === 'ticari' && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Para birimi</label>
                    <select value={form.para_birimi} onChange={e=>setF('para_birimi',e.target.value)}>
                      <option value="USD">USD — Amerikan Dolari</option>
                      <option value="EUR">EUR — Euro</option>
                    </select>
                  </div>
                  <Field label="Odeme vadesi (gun)" k="vade_gun" type="number" placeholder="30" />
                  <Field label="Kredi limiti (USD)" k="kredi_limiti" type="number" placeholder="50000" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ambalaj tercihleri / ozel istekler</label>
                  <textarea value={form.tercih_notlari} onChange={e=>setF('tercih_notlari',e.target.value)}
                    rows={3} placeholder="Ornek: Minimum 1500m sargi, max 30cm cap, gida onayli malzeme..." />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Genel notlar</label>
                  <textarea value={form.notlar} onChange={e=>setF('notlar',e.target.value)} rows={2} placeholder="Diger notlar..." />
                </div>
              </div>
            )}
          </div>
        </div>

        {msg && <div className="mt-3 bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3 border border-red-200">{msg}</div>}

        <div className="flex gap-3 mt-4">
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? 'Kaydediliyor...' : 'Musteri kaydet'}
          </button>
          <button type="button" onClick={() => router.back()} className="btn">Iptal</button>
          <span className="text-xs text-gray-400 self-center ml-2">Sadece firma adi zorunlu, digerleri opsiyonel</span>
        </div>
      </form>
    </div>
  )
}
