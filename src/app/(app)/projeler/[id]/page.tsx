'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { fiyatHesapla } from '@/lib/supabase'

const DURUM_BADGE: Record<string,string> = {
  taslak:'badge-gray', fiyatlama:'badge-blue',
  proforma_gonderildi:'badge-amber', musteri_onayladi:'badge-green',
  tamamlandi:'badge-green', iptal:'badge-red'
}

const DURUM_LABEL: Record<string,string> = {
  taslak:'Taslak', fiyatlama:'Fiyatlama',
  proforma_gonderildi:'Proforma Gonderildi', musteri_onayladi:'Musteri Onayladi',
  tamamlandi:'Tamamlandi', iptal:'Iptal'
}

const ADIM_RENK: Record<string,string> = {
  baski:'bg-blue-100 text-blue-800', laminasyon_1:'bg-teal-100 text-teal-800',
  laminasyon_2:'bg-teal-100 text-teal-800', laminasyon_3:'bg-teal-100 text-teal-800',
  kurleme_1:'bg-amber-100 text-amber-800', kurleme_2:'bg-amber-100 text-amber-800',
  kurleme_3:'bg-amber-100 text-amber-800', dilimleme:'bg-green-100 text-green-800',
  katlama:'bg-purple-100 text-purple-800', yan_kesim:'bg-red-100 text-red-800',
  doypack:'bg-gray-100 text-gray-700', quadro:'bg-gray-100 text-gray-700',
  flat_bottom:'bg-gray-100 text-gray-700', sirt_kaynak:'bg-gray-100 text-gray-700',
  sonic:'bg-pink-100 text-pink-800',
}

const ADIM_LABEL: Record<string,string> = {
  baski:'Baski', laminasyon_1:'Laminasyon 1', laminasyon_2:'Laminasyon 2',
  laminasyon_3:'Laminasyon 3', kurleme_1:'Kurleme 1', kurleme_2:'Kurleme 2',
  kurleme_3:'Kurleme 3', dilimleme:'Dilimleme', katlama:'Katlama',
  yan_kesim:'Yan Kesim', doypack:'Doypack (Fason)', quadro:'Quadro (Fason)',
  flat_bottom:'Flat Bottom (Fason)', sirt_kaynak:'Sirt Kaynak (Fason)', sonic:'Sonic',
}

export default function ProjeDetayPage() {
  const { id } = useParams()
  const router = useRouter()
  const [proje, setProje] = useState<any>(null)
  const [katmanlar, setKatmanlar] = useState<any[]>([])
  const [teklifler, setTeklifler] = useState<any[]>([])
  const [malzemeFiyatlari, setMalzemeFiyatlari] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [fiyatModal, setFiyatModal] = useState(false)
  const [durumGuncelleniyor, setDurumGuncelleniyor] = useState(false)

  // Fiyatlama formu
  const [fiyatForm, setFiyatForm] = useState({
    boya_fiyat: '6.00',
    tutkal_fiyat: '6.50',
    iscilik: '0.50',
    fire_pct: '3',
    kar_pct: '20',
    fason_maliyet: '0',
  })
  const [hesaplananFiyatlar, setHesaplananFiyatlar] = useState<any[]>([])
  const [fiyatKaydediliyor, setFiyatKaydediliyor] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { load() }, [id])

  async function load() {
    const [{ data: p }, { data: k }, { data: t }, { data: mf }] = await Promise.all([
      supabase.from('proje').select('*, musteri:musteri_tanim(ad,para_birimi)').eq('id', id).single(),
      supabase.from('proje_katman').select('*, malzeme:malzeme_tanim(ad,tur,yogunluk)').eq('proje_id', id).order('sira'),
      supabase.from('proje_fiyat').select('*').eq('proje_id', id).order('olusturma', {ascending:false}),
      supabase.from('malzeme_fiyat').select('*, malzeme:malzeme_tanim(id,ad)').order('gecerlilik_tarihi', {ascending:false}),
    ])
    setProje(p); setKatmanlar(k||[]); setTeklifler(t||[]); setMalzemeFiyatlari(mf||[])
    setLoading(false)
  }

  function sonFiyatBul(malzeme_id: string) {
    return malzemeFiyatlari.find(f => f.malzeme_id === malzeme_id)?.birim_fiyat || 0
  }

  function hesaplaFiyatlar() {
    const laminasyonSayisi = katmanlar.filter(k => k.laminasyon_onceki).length
    const baskili = katmanlar.some(k => k.baskili)

    const katmanGirdileri = katmanlar.map(k => ({
      malzeme_id: k.malzeme_id,
      mikron: k.mikron,
      yogunluk: k.malzeme?.yogunluk || 0.91,
      birim_fiyat: sonFiyatBul(k.malzeme_id),
    }))

    const sonuclar = [500, 1000, 3000].map(miktar => {
      const sonuc = fiyatHesapla({
        katmanlar: katmanGirdileri,
        baskili,
        renk_sayisi: proje?.renk_sayisi || 1,
        laminasyon_sayisi: laminasyonSayisi,
        siparis_kg: miktar,
        boya_fiyat_kg: parseFloat(fiyatForm.boya_fiyat),
        tutkal_fiyat_kg: parseFloat(fiyatForm.tutkal_fiyat),
        iscilik_kg: parseFloat(fiyatForm.iscilik),
        fire_pct: parseFloat(fiyatForm.fire_pct),
        kar_pct: parseFloat(fiyatForm.kar_pct),
        fason_maliyet: parseFloat(fiyatForm.fason_maliyet) || 0,
        makine_hazirlik_kg: miktar <= 500 ? 15 : miktar <= 1000 ? 10 : 5,
      })
      return { miktar, ...sonuc }
    })
    setHesaplananFiyatlar(sonuclar)
  }

  async function fiyatKaydet() {
    if (hesaplananFiyatlar.length === 0) { setMsg('Once hesapla butonuna basin.'); return }
    setFiyatKaydediliyor(true)
    for (const f of hesaplananFiyatlar) {
      await supabase.from('proje_fiyat').insert({
        proje_id: id,
        miktar_kg: f.miktar,
        film_maliyet: f.film_maliyet,
        boya_maliyet: f.boya_maliyet,
        tutkal_maliyet: f.tutkal_maliyet,
        iscilik_maliyet: f.iscilik_maliyet,
        fason_maliyet: f.fason_maliyet,
        fire_orani_pct: parseFloat(fiyatForm.fire_pct),
        toplam_maliyet: f.satis_fiyati,
        kar_marji_pct: parseFloat(fiyatForm.kar_pct),
        satis_fiyati_kg: f.satis_fiyati_kg,
        satis_fiyati_m2: f.satis_fiyati_m2,
        para_birimi: proje?.musteri?.para_birimi || 'USD',
        gecerlilik_tarihi: new Date().toISOString().split('T')[0],
      })
    }
    await supabase.from('proje').update({ durum: 'fiyatlama' }).eq('id', id)
    setFiyatModal(false); setHesaplananFiyatlar([]); load()
    setFiyatKaydediliyor(false)
  }

  async function durumGuncelle(yeniDurum: string) {
    setDurumGuncelleniyor(true)
    await supabase.from('proje').update({ durum: yeniDurum }).eq('id', id)
    load(); setDurumGuncelleniyor(false)
  }

  async function sipariseDonus() {
    if (!confirm('Bu teklifi onaylanmis siparis olarak islemek istediginizden emin misiniz? Uretim planlamaya gececek.')) return
    await supabase.from('proje').update({ durum: 'musteri_onayladi' }).eq('id', id)

    // Uretim plani olustur
    const rota = proje?.rota_adimlar || []
    const { data: makineler } = await supabase.from('makine_tanim').select('*').eq('aktif', true)
    if (makineler) {
      let sira = 1
      for (const adim of rota) {
        const makine = makineler.find((m: any) => {
          if (adim === 'baski') return m.tur === 'baski'
          if (adim.startsWith('laminasyon')) return m.tur === 'laminasyon'
          if (adim === 'dilimleme') return m.tur === 'dilimleme'
          if (adim === 'doypack') return m.tur === 'doypack'
          return false
        })
        await supabase.from('uretim_plani').insert({
          plan_no: `PLN-${Date.now()}-${sira}`,
          proje_id: id,
          makine_id: makine?.id || null,
          adim_sira: sira,
          adim_tur: adim,
          durum: 'bekliyor',
        })
        sira++
      }
    }
    load()
    alert('Siparis uretim planlamaya alindi!')
  }

  // Adet fiyati hesapla
  function adetFiyatiHesapla(fiyat: any): number | null {
    if (!proje) return null
    const cikti = proje.cikti_turu
    if (cikti === 'bobin') return null

    const en = proje.en_mm / 10  // cm
    const boy = proje.boy_mm / 10  // cm
    const kurek = (proje.kurek_mm || 0) / 10  // cm

    let alanCm2 = 0
    if (cikti === 'doypack') alanCm2 = (en * boy * 2) + (en * kurek / 2)
    else if (cikti === 'quadro') alanCm2 = (en * boy * 2) + (kurek * boy * 2)
    else if (cikti === 'sirt_kaynak' || cikti === 'yan_kesim') alanCm2 = en * boy * 2
    else alanCm2 = en * boy * 2

    const toplamGm2 = katmanlar.reduce((s, k) => s + (k.mikron * (k.malzeme?.yogunluk || 0.91)), 0) / 1000
    const adetAgirlikKg = (alanCm2 / 10000) * toplamGm2
    if (adetAgirlikKg <= 0) return null
    return fiyat.satis_fiyati_kg * adetAgirlikKg
  }

  if (loading) return <div className="p-8 text-gray-400">Yukleniyor...</div>
  if (!proje) return <div className="p-8 text-red-500">Proje bulunamadi</div>

  const sonTeklif = teklifler[0]

  return (
    <div className="p-6 max-w-5xl">
      {/* Baslik */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/projeler" className="text-gray-400 hover:text-gray-600 text-sm">← Projeler</Link>
            <span className="text-gray-300">/</span>
            <span className="font-mono text-sm text-blue-600">{proje.proje_no}</span>
          </div>
          <h1 className="page-title mt-1">{proje.ad}</h1>
          <p className="text-gray-500 text-xs mt-0.5">{proje.musteri?.ad} · {proje.cikti_turu}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`badge ${DURUM_BADGE[proje.durum]||'badge-gray'}`}>{DURUM_LABEL[proje.durum]||proje.durum}</span>
          <button onClick={() => setFiyatModal(true)} className="btn btn-primary">Fiyat hesapla</button>
          {proje.durum === 'fiyatlama' && (
            <button onClick={() => durumGuncelle('proforma_gonderildi')} disabled={durumGuncelleniyor} className="btn btn-warning">
              Proforma gonderildi
            </button>
          )}
          {proje.durum === 'proforma_gonderildi' && (
            <button onClick={sipariseDonus} className="btn btn-success">
              ✓ Musteri onayladi — Siparişe donustur
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 space-y-4">

          {/* Urun yapisi */}
          <div className="card">
            <div className="card-header"><span className="font-medium text-sm">Urun yapisi</span></div>
            <div className="card-body">
              <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                <div className="space-y-1.5">
                  {proje.en_mm && <div className="flex justify-between"><span className="text-gray-500">En</span><span>{proje.en_mm} mm</span></div>}
                  {proje.boy_mm && <div className="flex justify-between"><span className="text-gray-500">Boy</span><span>{proje.boy_mm} mm</span></div>}
                  {proje.kurek_mm && <div className="flex justify-between"><span className="text-gray-500">Kurek</span><span>{proje.kurek_mm} mm</span></div>}
                  {proje.kapak_mm && <div className="flex justify-between"><span className="text-gray-500">Kapak</span><span>{proje.kapak_mm} mm</span></div>}
                </div>
                <div className="space-y-1.5">
                  {proje.bobin_en_mm && <div className="flex justify-between"><span className="text-gray-500">Bobin eni</span><span>{proje.bobin_en_mm} mm</span></div>}
                  {proje.bobin_cap_mm && <div className="flex justify-between"><span className="text-gray-500">Bobin capi</span><span>{proje.bobin_cap_mm} mm</span></div>}
                  {proje.kato_eni_mm && <div className="flex justify-between"><span className="text-gray-500">Kato eni</span><span className="font-medium text-blue-600">{proje.kato_eni_mm} mm</span></div>}
                  {proje.renk_sayisi && <div className="flex justify-between"><span className="text-gray-500">Renk sayisi</span><span>{proje.renk_sayisi} renk</span></div>}
                </div>
              </div>

              {/* Ozel islemler */}
              <div className="flex gap-2 flex-wrap mb-4">
                {proje.baskili && <span className="badge badge-blue">{proje.baskili_yuz === 'alt' ? 'Alt baski' : 'Ust baski'}</span>}
                {proje.zip_var && <span className="badge badge-purple">Zip</span>}
                {proje.sonic_var && <span className="badge badge-purple">Sonic</span>}
                {proje.mexika_deligi && <span className="badge badge-gray">Meksika deligi</span>}
                {proje.kargo_bandi && <span className="badge badge-gray">Kargo bandi</span>}
              </div>

              {/* Film katmanlari */}
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500">Film katmanlari</div>
                {katmanlar.map((k, i) => (
                  <div key={k.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center flex-shrink-0">{k.sira}</div>
                    <div className="flex-1">
                      <span className="font-medium text-sm">{k.malzeme?.ad}</span>
                      <span className="text-gray-400 text-xs ml-2">{k.mikron} μm</span>
                    </div>
                    <div className="flex gap-1.5">
                      {k.baskili && <span className="badge badge-blue text-xs">Baskili</span>}
                      {k.laminasyon_onceki && <span className="badge badge-teal text-xs" style={{background:'#ccfbf1',color:'#0f766e'}}>Lamine</span>}
                    </div>
                    <div className="text-xs text-gray-400 text-right min-w-[60px]">
                      ${sonFiyatBul(k.malzeme_id).toFixed(4)}/kg
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Fiyat teklifleri */}
          <div className="card">
            <div className="card-header">
              <span className="font-medium text-sm">Fiyat teklifleri</span>
              <span className="text-xs text-gray-400">{teklifler.length} kayit</span>
            </div>
            {teklifler.length === 0 ? (
              <div className="card-body text-center text-gray-400 text-sm py-8">
                Henuz fiyat hesaplanmamis.<br/>
                <button onClick={()=>setFiyatModal(true)} className="btn btn-primary mt-3">Fiyat hesapla</button>
              </div>
            ) : (
              <div className="overflow-hidden">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Miktar</th><th>Satis fiyati (kg)</th>
                      {proje.cikti_turu !== 'bobin' && <th>Adet fiyati</th>}
                      <th>m² fiyati</th><th>Kar marji</th><th>Tarih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teklifler.slice(0,9).map((f, i) => {
                      const adet = adetFiyatiHesapla(f)
                      return (
                        <tr key={f.id} className={i===0?'bg-green-50':''}>
                          <td className="font-medium">{f.miktar_kg?.toLocaleString('tr-TR')} kg</td>
                          <td className="font-semibold text-green-700">${parseFloat(f.satis_fiyati_kg||0).toFixed(4)}</td>
                          {proje.cikti_turu !== 'bobin' && (
                            <td className="font-semibold text-blue-700">{adet ? '$'+adet.toFixed(4) : '—'}</td>
                          )}
                          <td className="text-gray-600">${parseFloat(f.satis_fiyati_m2||0).toFixed(4)}</td>
                          <td>%{f.kar_marji_pct}</td>
                          <td className="text-gray-400 text-xs">{new Date(f.olusturma).toLocaleDateString('tr-TR')}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Sag panel */}
        <div className="space-y-4">
          {/* Durum akisi */}
          <div className="card">
            <div className="card-header"><span className="font-medium text-sm">Durum</span></div>
            <div className="card-body space-y-2">
              {[
                {d:'taslak', l:'Taslak'},
                {d:'fiyatlama', l:'Fiyat hesaplandi'},
                {d:'proforma_gonderildi', l:'Proforma gonderildi'},
                {d:'musteri_onayladi', l:'Musteri onayladi'},
                {d:'tamamlandi', l:'Tamamlandi'},
              ].map((s,i) => {
                const durumlar = ['taslak','fiyatlama','proforma_gonderildi','musteri_onayladi','tamamlandi']
                const mevcutIdx = durumlar.indexOf(proje.durum)
                const hedefIdx = durumlar.indexOf(s.d)
                const gecti = mevcutIdx > hedefIdx
                const aktif = mevcutIdx === hedefIdx
                return (
                  <div key={s.d} className={`flex items-center gap-3 p-2.5 rounded-lg ${aktif?'bg-blue-50 border border-blue-200':'bg-gray-50'}`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs
                      ${gecti?'bg-green-500 text-white':aktif?'bg-blue-600 text-white':'bg-gray-200 text-gray-400'}`}>
                      {gecti?'✓':i+1}
                    </div>
                    <span className={`text-xs ${aktif?'font-medium text-blue-800':gecti?'text-green-700':'text-gray-400'}`}>{s.l}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Notlar */}
          {proje.notlar && (
            <div className="card">
              <div className="card-header"><span className="font-medium text-sm">Notlar</span></div>
              <div className="card-body text-sm text-gray-700">{proje.notlar}</div>
            </div>
          )}
        </div>
      </div>

      {/* Fiyat hesaplama modali */}
      {fiyatModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="font-semibold text-gray-900 text-lg">Fiyat hesapla</div>
              <div className="text-sm text-gray-500 mt-0.5">{proje.ad} — 500 / 1.000 / 3.000 kg</div>
            </div>
            <div className="p-6">
              {/* Parametreler */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  {l:'Boya fiyati ($/kg)', k:'boya_fiyat', s:'0.01'},
                  {l:'Tutkal fiyati ($/kg)', k:'tutkal_fiyat', s:'0.01'},
                  {l:'Iscilik ($/kg)', k:'iscilik', s:'0.01'},
                  {l:'Fire orani (%)', k:'fire_pct', s:'0.5'},
                  {l:'Kar marji (%)', k:'kar_pct', s:'1'},
                  {l:'Fason maliyet ($)', k:'fason_maliyet', s:'1'},
                ].map(p => (
                  <div key={p.k}>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">{p.l}</label>
                    <input type="number" step={p.s} value={(fiyatForm as any)[p.k]}
                      onChange={e=>setFiyatForm(prev=>({...prev,[p.k]:e.target.value}))} />
                  </div>
                ))}
              </div>

              {/* Katman fiyat ozeti */}
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <div className="text-xs font-medium text-gray-500 mb-2">Guncel malzeme fiyatlari</div>
                {katmanlar.map(k => (
                  <div key={k.id} className="flex justify-between text-sm py-1">
                    <span className="text-gray-600">{k.malzeme?.ad} ({k.mikron}μm)</span>
                    <span className={`font-medium ${sonFiyatBul(k.malzeme_id)>0?'text-gray-900':'text-red-500'}`}>
                      {sonFiyatBul(k.malzeme_id)>0 ? '$'+sonFiyatBul(k.malzeme_id).toFixed(4)+'/kg' : 'FIYAT YOK!'}
                    </span>
                  </div>
                ))}
              </div>

              <button onClick={hesaplaFiyatlar} className="btn btn-primary w-full justify-center mb-4">
                Hesapla
              </button>

              {/* Sonuclar */}
              {hesaplananFiyatlar.length > 0 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Miktar</th>
                        <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">m²</th>
                        <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Maliyet/kg</th>
                        <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Satis/kg</th>
                        {proje.cikti_turu !== 'bobin' && <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Adet</th>}
                        <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Toplam</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hesaplananFiyatlar.map(f => {
                        const adet = adetFiyatiHesapla(f)
                        return (
                          <tr key={f.miktar} className="border-t border-gray-100">
                            <td className="px-4 py-3 font-medium">{f.miktar.toLocaleString('tr-TR')} kg</td>
                            <td className="px-4 py-3 text-gray-600">{f.m2.toLocaleString('tr-TR')}</td>
                            <td className="px-4 py-3 text-gray-600">${(f.toplam_fire_dahil/f.miktar).toFixed(4)}</td>
                            <td className="px-4 py-3 font-semibold text-green-700">${f.satis_fiyati_kg.toFixed(4)}</td>
                            {proje.cikti_turu !== 'bobin' && (
                              <td className="px-4 py-3 text-blue-700 font-medium">{adet?'$'+adet.toFixed(4):'—'}</td>
                            )}
                            <td className="px-4 py-3 font-semibold">${f.satis_fiyati.toFixed(2)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {msg && <p className="text-red-600 text-sm mb-3">{msg}</p>}
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button onClick={()=>{setFiyatModal(false);setHesaplananFiyatlar([]);setMsg('')}} className="btn flex-1 justify-center">Iptal</button>
              {hesaplananFiyatlar.length > 0 && (
                <button onClick={fiyatKaydet} disabled={fiyatKaydediliyor} className="btn btn-primary flex-1 justify-center">
                  {fiyatKaydediliyor ? 'Kaydediliyor...' : 'Fiyatlari kaydet'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
