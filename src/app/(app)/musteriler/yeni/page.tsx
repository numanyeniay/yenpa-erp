'use client'
import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const SEKTORLER = ['Gida','Tekstil','Kimya','Elektronik','Kirtasiye','Eczane','Kozmetik','Tarim','Diger']
const SEHIRLER = ['Adana','Ankara','Antalya','Bursa','Denizli','Eskisehir','Gaziantep','Istanbul','Izmir','Kayseri','Konya','Mersin','Diger']

export default function YeniMusteriPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [bolum, setBolum] = useState('temel')

  // Her alan icin ayri state — re-render sorunu olmaz
  const [ad, setAd] = useState('')
  const [vergiNo, setVergiNo] = useState('')
  const [vergiDairesi, setVergiDairesi] = useState('')
  const [sektor, setSektor] = useState('')
  const [sehir, setSehir] = useState('')
  const [yetkiliAd, setYetkiliAd] = useState('')
  const [yetkiliTel, setYetkiliTel] = useState('')
  const [yetkiliEmail, setYetkiliEmail] = useState('')
  const [satisAd, setSatisAd] = useState('')
  const [satisTel, setSatisTel] = useState('')
  const [satisEmail, setSatisEmail] = useState('')
  const [muhasebeAd, setMuhasebeAd] = useState('')
  const [muhasebeTel, setMuhasebeTel] = useState('')
  const [muhasebeEmail, setMuhasebeEmail] = useState('')
  const [gmAd, setGmAd] = useState('')
  const [gmTel, setGmTel] = useState('')
  const [faturaAdres, setFaturaAdres] = useState('')
  const [faturaIlce, setFaturaIlce] = useState('')
  const [faturaSehir, setFaturaSehir] = useState('')
  const [faturaPosta, setFaturaPosta] = useState('')
  const [sevkAdres, setSevkAdres] = useState('')
  const [sevkIlce, setSevkIlce] = useState('')
  const [sevkSehir, setSevkSehir] = useState('')
  const [sevkPosta, setSevkPosta] = useState('')
  const [fabrikaAdres, setFabrikaAdres] = useState('')
  const [paraBirimi, setParaBirimi] = useState('USD')
  const [vadeGun, setVadeGun] = useState('30')
  const [krediLimiti, setKrediLimiti] = useState('')
  const [tercihNotlari, setTercihNotlari] = useState('')
  const [notlar, setNotlar] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!ad.trim()) { setMsg('Firma adi zorunlu.'); return }
    setSaving(true); setMsg('')

    const kod = `MUS-${Date.now().toString().slice(-6)}`

    const { error } = await supabase.from('musteri_tanim').insert({
      ad: ad.trim(),
      kod,
      vergi_no: vergiNo||null,
      vergi_dairesi: vergiDairesi||null,
      sektor: sektor||null,
      sehir: sehir||null,
      ulke: 'Turkiye',
      iletisim_ad: yetkiliAd||null,
      telefon: yetkiliTel||null,
      email: yetkiliEmail||null,
      adres: faturaAdres||null,
      para_birimi: paraBirimi,
      vade_gun: parseInt(vadeGun)||30,
      kredi_limiti: parseFloat(krediLimiti)||0,
      notlar: JSON.stringify({
        satis: {ad:satisAd, tel:satisTel, email:satisEmail},
        muhasebe: {ad:muhasebeAd, tel:muhasebeTel, email:muhasebeEmail},
        gm: {ad:gmAd, tel:gmTel},
        fatura_adresi: {adres:faturaAdres, ilce:faturaIlce, sehir:faturaSehir, posta:faturaPosta},
        sevk_adresi: {adres:sevkAdres, ilce:sevkIlce, sehir:sevkSehir, posta:sevkPosta},
        fabrika_adresi: fabrikaAdres,
        tercih_notlari: tercihNotlari,
        genel_notlar: notlar,
      }),
      aktif: true,
    })

    if (error) {
      setMsg('Hata: ' + error.message)
      setSaving(false)
      return
    }
    router.push('/musteriler')
  }

  function sevkAdresiniFaturaGibi() {
    setSevkAdres(faturaAdres)
    setSevkIlce(faturaIlce)
    setSevkSehir(faturaSehir)
    setSevkPosta(faturaPosta)
  }

  const tabCls = (k: string) =>
    `px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors ${bolum===k ? 'border-blue-600 text-blue-600 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`

  return (
    <div className="p-6 max-w-3xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">Yeni musteri</h1>
          <p className="text-gray-500 text-xs mt-0.5">Sadece firma adi zorunlu, diger alanlar sonradan doldurulabilir</p>
        </div>
      </div>

      <form onSubmit={handleSave} autoComplete="off">
        <div className="flex gap-0 border-b border-gray-200 mb-0">
          <button type="button" className={tabCls('temel')} onClick={()=>setBolum('temel')}>Firma bilgileri</button>
          <button type="button" className={tabCls('iletisim')} onClick={()=>setBolum('iletisim')}>Iletisim</button>
          <button type="button" className={tabCls('adres')} onClick={()=>setBolum('adres')}>Adresler</button>
          <button type="button" className={tabCls('ticari')} onClick={()=>setBolum('ticari')}>Ticari</button>
        </div>

        <div className="card" style={{borderTopLeftRadius:0, borderTopRightRadius:0}}>
          <div className="card-body">

            {bolum === 'temel' && (
              <div className="space-y-4">
                <div>
                  <label>Firma unvani <span className="text-red-500">*</span></label>
                  <input value={ad} onChange={e => setAd(e.target.value)} placeholder="ABC Gida San. Tic. A.S." autoFocus />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label>Vergi numarasi</label>
                    <input value={vergiNo} onChange={e => setVergiNo(e.target.value)} placeholder="1234567890" />
                  </div>
                  <div>
                    <label>Vergi dairesi</label>
                    <input value={vergiDairesi} onChange={e => setVergiDairesi(e.target.value)} placeholder="Kadikoy" />
                  </div>
                  <div>
                    <label>Sektor</label>
                    <select value={sektor} onChange={e => setSektor(e.target.value)}>
                      <option value="">Secin...</option>
                      {SEKTORLER.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label>Sehir</label>
                    <select value={sehir} onChange={e => setSehir(e.target.value)}>
                      <option value="">Secin...</option>
                      {SEHIRLER.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="bg-blue-50 rounded-lg px-4 py-3 text-xs text-blue-700">
                  Sadece firma adini girerek hizli kayit yapabilirsiniz. Diger bilgileri sonradan musteri detay sayfasindan doldurabilirsiniz.
                </div>
              </div>
            )}

            {bolum === 'iletisim' && (
              <div className="space-y-5">
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Satin alma / Ana yetkili</div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><label>Ad soyad</label><input value={yetkiliAd} onChange={e=>setYetkiliAd(e.target.value)} placeholder="Ahmet Yilmaz" /></div>
                    <div><label>Telefon</label><input value={yetkiliTel} onChange={e=>setYetkiliTel(e.target.value)} placeholder="0532 xxx xx xx" /></div>
                    <div><label>E-posta</label><input type="email" value={yetkiliEmail} onChange={e=>setYetkiliEmail(e.target.value)} placeholder="ahmet@firma.com" /></div>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Satis sorumlusu</div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><label>Ad soyad</label><input value={satisAd} onChange={e=>setSatisAd(e.target.value)} placeholder="Mehmet Kaya" /></div>
                    <div><label>Telefon</label><input value={satisTel} onChange={e=>setSatisTel(e.target.value)} placeholder="0533 xxx xx xx" /></div>
                    <div><label>E-posta</label><input type="email" value={satisEmail} onChange={e=>setSatisEmail(e.target.value)} placeholder="mehmet@firma.com" /></div>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Muhasebe</div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><label>Ad soyad</label><input value={muhasebeAd} onChange={e=>setMuhasebeAd(e.target.value)} placeholder="Ayse Demir" /></div>
                    <div><label>Telefon</label><input value={muhasebeTel} onChange={e=>setMuhasebeTel(e.target.value)} placeholder="0534 xxx xx xx" /></div>
                    <div><label>E-posta</label><input type="email" value={muhasebeEmail} onChange={e=>setMuhasebeEmail(e.target.value)} placeholder="muhasebe@firma.com" /></div>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Genel mudur / Sahip</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label>Ad soyad</label><input value={gmAd} onChange={e=>setGmAd(e.target.value)} placeholder="Ali Veli" /></div>
                    <div><label>Telefon</label><input value={gmTel} onChange={e=>setGmTel(e.target.value)} placeholder="0535 xxx xx xx" /></div>
                  </div>
                </div>
              </div>
            )}

            {bolum === 'adres' && (
              <div className="space-y-5">
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Fatura adresi</div>
                  <div className="space-y-3">
                    <div><label>Adres</label>
                      <textarea value={faturaAdres} onChange={e=>setFaturaAdres(e.target.value)} rows={2} placeholder="Mahalle, cadde, sokak, bina no..." /></div>
                    <div className="grid grid-cols-3 gap-3">
                      <div><label>Ilce</label><input value={faturaIlce} onChange={e=>setFaturaIlce(e.target.value)} placeholder="Kadikoy" /></div>
                      <div><label>Sehir</label><input value={faturaSehir} onChange={e=>setFaturaSehir(e.target.value)} placeholder="Istanbul" /></div>
                      <div><label>Posta kodu</label><input value={faturaPosta} onChange={e=>setFaturaPosta(e.target.value)} placeholder="34710" /></div>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sevk adresi</div>
                    <button type="button" onClick={sevkAdresiniFaturaGibi} className="text-xs text-blue-600 hover:underline">Fatura adresiyle ayni</button>
                  </div>
                  <div className="space-y-3">
                    <div><label>Adres</label>
                      <textarea value={sevkAdres} onChange={e=>setSevkAdres(e.target.value)} rows={2} placeholder="Sevkiyat adresi..." /></div>
                    <div className="grid grid-cols-3 gap-3">
                      <div><label>Ilce</label><input value={sevkIlce} onChange={e=>setSevkIlce(e.target.value)} placeholder="Esenyurt" /></div>
                      <div><label>Sehir</label><input value={sevkSehir} onChange={e=>setSevkSehir(e.target.value)} placeholder="Istanbul" /></div>
                      <div><label>Posta kodu</label><input value={sevkPosta} onChange={e=>setSevkPosta(e.target.value)} placeholder="34510" /></div>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Fabrika / Depo (opsiyonel)</div>
                  <textarea value={fabrikaAdres} onChange={e=>setFabrikaAdres(e.target.value)} rows={2} placeholder="Fabrika veya depo adresi..." />
                </div>
              </div>
            )}

            {bolum === 'ticari' && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label>Para birimi</label>
                    <select value={paraBirimi} onChange={e=>setParaBirimi(e.target.value)}>
                      <option value="USD">USD — Dolar</option>
                      <option value="EUR">EUR — Euro</option>
                    </select>
                  </div>
                  <div>
                    <label>Odeme vadesi (gun)</label>
                    <input type="number" value={vadeGun} onChange={e=>setVadeGun(e.target.value)} placeholder="30" />
                  </div>
                  <div>
                    <label>Kredi limiti (USD)</label>
                    <input type="number" value={krediLimiti} onChange={e=>setKrediLimiti(e.target.value)} placeholder="50000" />
                  </div>
                </div>
                <div>
                  <label>Ambalaj tercihleri / ozel istekler</label>
                  <textarea value={tercihNotlari} onChange={e=>setTercihNotlari(e.target.value)}
                    rows={3} placeholder="Ornek: Minimum 1500m sargi, max 30cm cap, gida onayli malzeme..." />
                </div>
                <div>
                  <label>Genel notlar</label>
                  <textarea value={notlar} onChange={e=>setNotlar(e.target.value)} rows={2} placeholder="Diger notlar..." />
                </div>
              </div>
            )}
          </div>
        </div>

        {msg && <div className="mt-3 bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3 border border-red-200">{msg}</div>}

        <div className="flex gap-3 mt-4 items-center">
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? 'Kaydediliyor...' : 'Musteri kaydet'}
          </button>
          <button type="button" onClick={() => router.back()} className="btn">Iptal</button>
          <span className="text-xs text-gray-400 ml-2">Sadece firma adi zorunlu</span>
        </div>
      </form>
    </div>
  )
}
