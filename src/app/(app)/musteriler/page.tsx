'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const SEKTORLER = ['Gida','Tekstil','Kimya','Elektronik','Kirtasiye','Eczane','Kozmetik','Tarim','Diger']
const SEHIRLER = ['Adana','Ankara','Antalya','Bursa','Denizli','Eskisehir','Gaziantep','Istanbul','Izmir','Kayseri','Konya','Mersin','Diger']

function notlarParse(notlar: string | null) {
  const bos = {
    satis: { ad: '', tel: '', email: '' },
    muhasebe: { ad: '', tel: '', email: '' },
    gm: { ad: '', tel: '' },
    fatura_adresi: { adres: '', ilce: '', sehir: '', posta: '' },
    sevk_adresi: { adres: '', ilce: '', sehir: '', posta: '' },
    fabrika_adresi: '',
    tercih_notlari: '',
    genel_notlar: '',
  }
  if (!notlar) return bos
  try {
    const j = JSON.parse(notlar)
    return {
      satis: { ...bos.satis, ...(j.satis || {}) },
      muhasebe: { ...bos.muhasebe, ...(j.muhasebe || {}) },
      gm: { ...bos.gm, ...(j.gm || {}) },
      fatura_adresi: { ...bos.fatura_adresi, ...(j.fatura_adresi || {}) },
      sevk_adresi: { ...bos.sevk_adresi, ...(j.sevk_adresi || {}) },
      fabrika_adresi: j.fabrika_adresi || '',
      tercih_notlari: j.tercih_notlari || '',
      genel_notlar: j.genel_notlar || '',
    }
  } catch {
    // Eski kayitlarda notlar duz metin olabilir — kaybetmeyelim, genel notlara koy
    return { ...bos, genel_notlar: notlar }
  }
}

export default function MusterilerPage() {
  const [musteriler, setMusteriler] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [arama, setArama] = useState('')
  const [pasifGoster, setPasifGoster] = useState(false)
  const [acikId, setAcikId] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('musteri_tanim').select('*').order('ad')
    setMusteriler(data || [])
    setLoading(false)
  }

  const filtreli = useMemo(() => {
    const q = arama.trim().toLowerCase()
    return musteriler.filter(m => {
      if (!pasifGoster && !m.aktif) return false
      if (!q) return true
      return (m.ad || '').toLowerCase().includes(q)
        || (m.kod || '').toLowerCase().includes(q)
        || (m.sehir || '').toLowerCase().includes(q)
        || (m.sektor || '').toLowerCase().includes(q)
        || (m.iletisim_ad || '').toLowerCase().includes(q)
    })
  }, [musteriler, arama, pasifGoster])

  if (loading) return <div className="p-8 text-gray-400 text-sm">Yukleniyor...</div>

  return (
    <div className="p-6">
      <div className="page-header">
        <h1 className="page-title">Musteriler</h1>
        <Link href="/musteriler/yeni" className="btn btn-primary btn-sm">+ Yeni Musteri</Link>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <input
          value={arama}
          onChange={e => setArama(e.target.value)}
          placeholder="Ad, kod, sehir, sektor veya yetkili ara..."
          className="!w-80"
        />
        <label className="flex items-center gap-2 !mb-0 text-sm font-normal text-gray-600">
          <input type="checkbox" className="!w-auto" checked={pasifGoster} onChange={e => setPasifGoster(e.target.checked)} />
          Pasif musterileri de goster
        </label>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="table-base">
          <thead>
            <tr><th>Kod</th><th>Firma</th><th>Sektor</th><th>Sehir</th><th>Yetkili</th><th>Vade/Limit</th><th>Durum</th><th></th></tr>
          </thead>
          <tbody>
            {filtreli.map(m => (
              <MusteriSatiri key={m.id} m={m} acik={acikId === m.id} onToggle={() => setAcikId(acikId === m.id ? null : m.id)} onSaved={load} />
            ))}
            {filtreli.length === 0 && (
              <tr><td colSpan={8} className="text-center text-gray-400 py-8">
                {musteriler.length === 0 ? 'Henuz musteri yok' : 'Aramaya uyan musteri bulunamadi'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MusteriSatiri({ m, acik, onToggle, onSaved }: any) {
  return (
    <>
      <tr className="cursor-pointer" onClick={onToggle}>
        <td className="font-mono text-xs">{m.kod}</td>
        <td className="font-medium">{m.ad}</td>
        <td className="text-gray-500">{m.sektor || '—'}</td>
        <td className="text-gray-500">{m.sehir || '—'}</td>
        <td className="text-gray-500 text-xs">{m.iletisim_ad || '—'}{m.telefon ? ` · ${m.telefon}` : ''}</td>
        <td className="text-gray-400 text-xs">{m.vade_gun || 30} gun{m.kredi_limiti ? ` · ${m.para_birimi || 'USD'} ${Number(m.kredi_limiti).toLocaleString('tr-TR')}` : ''}</td>
        <td><span className={`badge ${m.aktif ? 'badge-green' : 'badge-gray'}`}>{m.aktif ? 'Aktif' : 'Pasif'}</span></td>
        <td className="text-gray-400 text-xs">{acik ? '▲' : '▼'}</td>
      </tr>
      {acik && (
        <tr>
          <td colSpan={8} className="bg-gray-50 !py-5" onClick={e => e.stopPropagation()}>
            <MusteriDuzenle m={m} onSaved={onSaved} />
          </td>
        </tr>
      )}
    </>
  )
}

function MusteriDuzenle({ m, onSaved }: { m: any; onSaved: () => void }) {
  const [bolum, setBolum] = useState('temel')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const n = useMemo(() => notlarParse(m.notlar), [m.notlar])

  const [ad, setAd] = useState(m.ad || '')
  const [vergiNo, setVergiNo] = useState(m.vergi_no || '')
  const [vergiDairesi, setVergiDairesi] = useState(m.vergi_dairesi || '')
  const [sektor, setSektor] = useState(m.sektor || '')
  const [sehir, setSehir] = useState(m.sehir || '')
  const [yetkiliAd, setYetkiliAd] = useState(m.iletisim_ad || '')
  const [yetkiliTel, setYetkiliTel] = useState(m.telefon || '')
  const [yetkiliEmail, setYetkiliEmail] = useState(m.email || '')
  const [satisAd, setSatisAd] = useState(n.satis.ad)
  const [satisTel, setSatisTel] = useState(n.satis.tel)
  const [satisEmail, setSatisEmail] = useState(n.satis.email)
  const [muhasebeAd, setMuhasebeAd] = useState(n.muhasebe.ad)
  const [muhasebeTel, setMuhasebeTel] = useState(n.muhasebe.tel)
  const [muhasebeEmail, setMuhasebeEmail] = useState(n.muhasebe.email)
  const [gmAd, setGmAd] = useState(n.gm.ad)
  const [gmTel, setGmTel] = useState(n.gm.tel)
  const [faturaAdres, setFaturaAdres] = useState(n.fatura_adresi.adres || m.adres || '')
  const [faturaIlce, setFaturaIlce] = useState(n.fatura_adresi.ilce)
  const [faturaSehir, setFaturaSehir] = useState(n.fatura_adresi.sehir)
  const [faturaPosta, setFaturaPosta] = useState(n.fatura_adresi.posta)
  const [sevkAdres, setSevkAdres] = useState(n.sevk_adresi.adres)
  const [sevkIlce, setSevkIlce] = useState(n.sevk_adresi.ilce)
  const [sevkSehir, setSevkSehir] = useState(n.sevk_adresi.sehir)
  const [sevkPosta, setSevkPosta] = useState(n.sevk_adresi.posta)
  const [fabrikaAdres, setFabrikaAdres] = useState(n.fabrika_adresi)
  const [paraBirimi, setParaBirimi] = useState(m.para_birimi || 'USD')
  const [vadeGun, setVadeGun] = useState(String(m.vade_gun ?? 30))
  const [krediLimiti, setKrediLimiti] = useState(m.kredi_limiti ? String(m.kredi_limiti) : '')
  const [tercihNotlari, setTercihNotlari] = useState(n.tercih_notlari)
  const [notlarGenel, setNotlarGenel] = useState(n.genel_notlar)

  function sevkAdresiniFaturaGibi() {
    setSevkAdres(faturaAdres); setSevkIlce(faturaIlce); setSevkSehir(faturaSehir); setSevkPosta(faturaPosta)
  }

  async function kaydet() {
    if (!ad.trim()) { setMsg('Firma adi zorunlu.'); return }
    setSaving(true); setMsg('')
    const { error } = await supabase.from('musteri_tanim').update({
      ad: ad.trim(), vergi_no: vergiNo || null, vergi_dairesi: vergiDairesi || null,
      sektor: sektor || null, sehir: sehir || null,
      iletisim_ad: yetkiliAd || null, telefon: yetkiliTel || null, email: yetkiliEmail || null,
      adres: faturaAdres || null, para_birimi: paraBirimi,
      vade_gun: parseInt(vadeGun) || 30, kredi_limiti: parseFloat(krediLimiti) || 0,
      notlar: JSON.stringify({
        satis: { ad: satisAd, tel: satisTel, email: satisEmail },
        muhasebe: { ad: muhasebeAd, tel: muhasebeTel, email: muhasebeEmail },
        gm: { ad: gmAd, tel: gmTel },
        fatura_adresi: { adres: faturaAdres, ilce: faturaIlce, sehir: faturaSehir, posta: faturaPosta },
        sevk_adresi: { adres: sevkAdres, ilce: sevkIlce, sehir: sevkSehir, posta: sevkPosta },
        fabrika_adresi: fabrikaAdres, tercih_notlari: tercihNotlari, genel_notlar: notlarGenel,
      }),
    }).eq('id', m.id)
    setSaving(false)
    if (error) { setMsg('Hata: ' + error.message); return }
    setMsg('Kaydedildi.')
    onSaved()
  }

  async function durumDegistir() {
    await supabase.from('musteri_tanim').update({ aktif: !m.aktif }).eq('id', m.id)
    onSaved()
  }

  const tabCls = (k: string) =>
    `px-4 py-2 text-xs border-b-2 -mb-px transition-colors ${bolum === k ? 'border-blue-600 text-blue-600 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`

  return (
    <div className="max-w-3xl">
      <div className="flex gap-0 border-b border-gray-200">
        <button type="button" className={tabCls('temel')} onClick={() => setBolum('temel')}>Firma bilgileri</button>
        <button type="button" className={tabCls('iletisim')} onClick={() => setBolum('iletisim')}>Iletisim</button>
        <button type="button" className={tabCls('adres')} onClick={() => setBolum('adres')}>Adresler</button>
        <button type="button" className={tabCls('ticari')} onClick={() => setBolum('ticari')}>Ticari</button>
      </div>

      <div className="bg-white border border-t-0 border-gray-100 rounded-b-xl p-5">
        {bolum === 'temel' && (
          <div className="space-y-4">
            <div><label>Firma unvani</label><input value={ad} onChange={e => setAd(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label>Vergi numarasi</label><input value={vergiNo} onChange={e => setVergiNo(e.target.value)} /></div>
              <div><label>Vergi dairesi</label><input value={vergiDairesi} onChange={e => setVergiDairesi(e.target.value)} /></div>
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
          </div>
        )}

        {bolum === 'iletisim' && (
          <div className="space-y-5">
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Satin alma / Ana yetkili</div>
              <div className="grid grid-cols-3 gap-3">
                <div><label>Ad soyad</label><input value={yetkiliAd} onChange={e => setYetkiliAd(e.target.value)} /></div>
                <div><label>Telefon</label><input value={yetkiliTel} onChange={e => setYetkiliTel(e.target.value)} /></div>
                <div><label>E-posta</label><input type="email" value={yetkiliEmail} onChange={e => setYetkiliEmail(e.target.value)} /></div>
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Satis sorumlusu</div>
              <div className="grid grid-cols-3 gap-3">
                <div><label>Ad soyad</label><input value={satisAd} onChange={e => setSatisAd(e.target.value)} /></div>
                <div><label>Telefon</label><input value={satisTel} onChange={e => setSatisTel(e.target.value)} /></div>
                <div><label>E-posta</label><input type="email" value={satisEmail} onChange={e => setSatisEmail(e.target.value)} /></div>
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Muhasebe</div>
              <div className="grid grid-cols-3 gap-3">
                <div><label>Ad soyad</label><input value={muhasebeAd} onChange={e => setMuhasebeAd(e.target.value)} /></div>
                <div><label>Telefon</label><input value={muhasebeTel} onChange={e => setMuhasebeTel(e.target.value)} /></div>
                <div><label>E-posta</label><input type="email" value={muhasebeEmail} onChange={e => setMuhasebeEmail(e.target.value)} /></div>
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Genel mudur / Sahip</div>
              <div className="grid grid-cols-2 gap-3">
                <div><label>Ad soyad</label><input value={gmAd} onChange={e => setGmAd(e.target.value)} /></div>
                <div><label>Telefon</label><input value={gmTel} onChange={e => setGmTel(e.target.value)} /></div>
              </div>
            </div>
          </div>
        )}

        {bolum === 'adres' && (
          <div className="space-y-5">
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Fatura adresi</div>
              <div className="space-y-3">
                <div><label>Adres</label><textarea value={faturaAdres} onChange={e => setFaturaAdres(e.target.value)} rows={2} /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div><label>Ilce</label><input value={faturaIlce} onChange={e => setFaturaIlce(e.target.value)} /></div>
                  <div><label>Sehir</label><input value={faturaSehir} onChange={e => setFaturaSehir(e.target.value)} /></div>
                  <div><label>Posta kodu</label><input value={faturaPosta} onChange={e => setFaturaPosta(e.target.value)} /></div>
                </div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sevk adresi</div>
                <button type="button" onClick={sevkAdresiniFaturaGibi} className="text-xs text-blue-600 hover:underline">Fatura adresiyle ayni</button>
              </div>
              <div className="space-y-3">
                <div><label>Adres</label><textarea value={sevkAdres} onChange={e => setSevkAdres(e.target.value)} rows={2} /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div><label>Ilce</label><input value={sevkIlce} onChange={e => setSevkIlce(e.target.value)} /></div>
                  <div><label>Sehir</label><input value={sevkSehir} onChange={e => setSevkSehir(e.target.value)} /></div>
                  <div><label>Posta kodu</label><input value={sevkPosta} onChange={e => setSevkPosta(e.target.value)} /></div>
                </div>
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Fabrika / Depo (opsiyonel)</div>
              <textarea value={fabrikaAdres} onChange={e => setFabrikaAdres(e.target.value)} rows={2} />
            </div>
          </div>
        )}

        {bolum === 'ticari' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label>Para birimi</label>
                <select value={paraBirimi} onChange={e => setParaBirimi(e.target.value)}>
                  <option value="USD">USD — Dolar</option>
                  <option value="EUR">EUR — Euro</option>
                </select>
              </div>
              <div><label>Odeme vadesi (gun)</label><input type="number" value={vadeGun} onChange={e => setVadeGun(e.target.value)} /></div>
              <div><label>Kredi limiti</label><input type="number" value={krediLimiti} onChange={e => setKrediLimiti(e.target.value)} /></div>
            </div>
            <div><label>Ambalaj tercihleri / ozel istekler</label><textarea value={tercihNotlari} onChange={e => setTercihNotlari(e.target.value)} rows={3} /></div>
            <div><label>Genel notlar</label><textarea value={notlarGenel} onChange={e => setNotlarGenel(e.target.value)} rows={2} /></div>
          </div>
        )}

        {msg && <div className={`mt-3 text-sm rounded-lg px-4 py-3 border ${msg.startsWith('Hata') ? 'bg-red-50 text-red-600 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>{msg}</div>}

        <div className="flex items-center gap-3 mt-4">
          <button onClick={kaydet} disabled={saving} className="btn btn-primary btn-sm">{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
          <button onClick={durumDegistir} className={`btn btn-sm ${m.aktif ? 'btn-danger' : 'btn-success'}`}>{m.aktif ? 'Pasif yap' : 'Aktif yap'}</button>
        </div>
      </div>
    </div>
  )
}
