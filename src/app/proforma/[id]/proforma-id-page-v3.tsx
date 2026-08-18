'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { LOGO_BASE64 } from '@/lib/logo'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'

const DURUM_LABEL: Record<string, string> = {
  gonderildi: 'Gonderildi', onaylandi: 'Onaylandi', reddedildi: 'Reddedildi', revizyon: 'Revizyon istendi',
}

const IC_ONAY_LABEL: Record<string, string> = {
  yok: 'Onay istenmedi', istendi: 'Onay bekleniyor', onaylandi: 'Yonetici onayladi', reddedildi: 'Yonetici reddetti',
}
const IC_ONAY_BADGE: Record<string, string> = {
  yok: 'badge-gray', istendi: 'badge-amber', onaylandi: 'badge-green', reddedildi: 'badge-red',
}

export default function ProformaPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [proforma, setProforma] = useState<any>(null)
  const [proje, setProje] = useState<any>(null)
  const [musteri, setMusteri] = useState<any>(null)
  const [katmanlar, setKatmanlar] = useState<any[]>([])
  const [kullanicilar, setKullanicilar] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [id])

  async function load() {
    const { data: pf } = await supabase.from('proforma').select('*').eq('id', id).single()
    if (!pf) { setLoading(false); return }
    const [{ data: p }, { data: m }, { data: k }, { data: kul }] = await Promise.all([
      supabase.from('proje').select('*').eq('id', pf.proje_id).single(),
      supabase.from('musteri_tanim').select('*').eq('id', pf.musteri_id).single(),
      supabase.from('proje_katman').select('*, malzeme:malzeme_tanim(ad)').eq('proje_id', pf.proje_id).order('sira'),
      supabase.from('kullanici_tanim').select('id, ad_soyad'),
    ])
    setProforma(pf); setProje(p); setMusteri(m); setKatmanlar(k || [])
    setKullanicilar(Object.fromEntries((kul || []).map((u: any) => [u.id, u.ad_soyad])))
    setLoading(false)
  }

  async function durumGuncelle(durum: string) {
    setSaving(true)
    await supabase.from('proforma').update({ durum }).eq('id', id)
    setSaving(false)
    load()
  }

  async function onayIste() {
    if (!user) return
    setSaving(true)
    await supabase.from('proforma').update({
      ic_onay_durumu: 'istendi', onay_isteyen_id: user.id, onaylayan_id: null, onay_tarihi: null, onay_notu: null,
    }).eq('id', id)
    setSaving(false)
    load()
  }

  async function onayVer(karar: 'onaylandi' | 'reddedildi') {
    if (!user) return
    setSaving(true)
    await supabase.from('proforma').update({
      ic_onay_durumu: karar, onaylayan_id: user.id, onay_tarihi: new Date().toISOString(),
    }).eq('id', id)
    setSaving(false)
    load()
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Yukleniyor...</div>
  if (!proforma) return <div className="p-8 text-red-500 text-sm">Proforma bulunamadi</div>

  return (
    <div className="min-h-screen bg-gray-100 py-8 print:bg-white print:py-0">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      {/* Ekran-only kontrol cubugu */}
      <div className="no-print max-w-3xl mx-auto mb-4 flex items-center justify-between px-2">
        <Link href={`/projeler/${proforma.proje_id}`} className="text-sm text-blue-600 hover:underline">← Projeye don</Link>
        <div className="flex gap-2 items-center">
          <span className="text-xs text-gray-400 mr-2">Durum:</span>
          {['gonderildi', 'onaylandi', 'reddedildi', 'revizyon'].map(d => (
            <button key={d} onClick={() => durumGuncelle(d)} disabled={saving}
              className={`btn btn-sm ${proforma.durum === d ? 'btn-primary' : ''}`}>{DURUM_LABEL[d]}</button>
          ))}
          <button onClick={() => window.print()} className="btn btn-sm btn-success ml-3">Yazdir / PDF kaydet</button>
        </div>
      </div>

      {/* Yonetici onayi (ic onay akisi — musteri durumundan bagimsiz) */}
      <div className="no-print max-w-3xl mx-auto mb-4 px-2">
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Yonetici onayi:</span>
            <span className={`badge ${IC_ONAY_BADGE[proforma.ic_onay_durumu || 'yok']}`}>
              {IC_ONAY_LABEL[proforma.ic_onay_durumu || 'yok']}
            </span>
            {proforma.onay_isteyen_id && (
              <span className="text-xs text-gray-400">· isteyen: {kullanicilar[proforma.onay_isteyen_id] || '—'}</span>
            )}
            {proforma.onaylayan_id && (
              <span className="text-xs text-gray-400">· {proforma.ic_onay_durumu === 'reddedildi' ? 'reddeden' : 'onaylayan'}: {kullanicilar[proforma.onaylayan_id] || '—'}</span>
            )}
          </div>
          <div className="flex gap-2">
            {user && (user.rol === 'satis' || user.rol === 'admin') && (proforma.ic_onay_durumu || 'yok') !== 'istendi' && (
              <button onClick={onayIste} disabled={saving} className="btn btn-sm btn-warning">Yoneticiden onay iste</button>
            )}
            {user && user.rol === 'admin' && proforma.ic_onay_durumu === 'istendi' && (
              <>
                <button onClick={() => onayVer('onaylandi')} disabled={saving} className="btn btn-sm btn-success">Onayla</button>
                <button onClick={() => onayVer('reddedildi')} disabled={saving} className="btn btn-sm btn-danger">Reddet</button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Yazdirilacak belge */}
      <div className="max-w-3xl mx-auto bg-white shadow-lg print:shadow-none rounded-xl print:rounded-none p-10 text-sm text-gray-800">
        <div className="flex items-start justify-between border-b border-gray-200 pb-6 mb-6">
          <img src={LOGO_BASE64} alt="Yenpa Ambalaj" className="h-14 object-contain" />
          <div className="text-right">
            <div className="text-xl font-bold text-gray-900">PROFORMA FATURA</div>
            <div className="font-mono text-gray-500 mt-1">{proforma.proforma_no}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase mb-2">Musteri</div>
            <div className="font-semibold text-gray-900">{musteri?.ad}</div>
            {musteri?.iletisim_ad && <div className="text-gray-500">{musteri.iletisim_ad}</div>}
            {musteri?.adres && <div className="text-gray-500">{musteri.adres}</div>}
            {musteri?.sehir && <div className="text-gray-500">{musteri.sehir}, {musteri?.ulke}</div>}
            {musteri?.email && <div className="text-gray-500">{musteri.email}</div>}
          </div>
          <div className="text-right">
            <div className="grid grid-cols-2 gap-1 text-gray-600">
              <span className="text-gray-400">Tarih:</span><span>{new Date(proforma.olusturma).toLocaleDateString('tr-TR')}</span>
              <span className="text-gray-400">Gecerlilik:</span><span>{proforma.gecerlilik_tarihi ? new Date(proforma.gecerlilik_tarihi).toLocaleDateString('tr-TR') : '—'}</span>
              <span className="text-gray-400">Vade:</span><span>{musteri?.vade_gun || 30} gun</span>
              <span className="text-gray-400">Para birimi:</span><span>{proforma.para_birimi}</span>
            </div>
          </div>
        </div>

        <table className="w-full text-sm mb-8 border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-800">
              <th className="text-left py-2">Urun</th>
              <th className="text-left py-2">Ozellikler</th>
              <th className="text-right py-2">Miktar</th>
              <th className="text-right py-2">Birim fiyat</th>
              <th className="text-right py-2">Toplam</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="py-3 font-medium">{proje?.ad}</td>
              <td className="py-3 text-gray-500 text-xs">
                {proje?.cikti_turu}
                {proje?.en_mm && ` · ${proje.en_mm}×${proje.boy_mm}mm`}
                {proje?.baskili && ` · ${proje.renk_sayisi || ''} renk baski`}
                <br />
                {katmanlar.map(k => k.malzeme?.ad).join(' + ')}
              </td>
              <td className="py-3 text-right">
                {Number(proforma.secilen_miktar_kg).toLocaleString('tr-TR')} KG
                {proforma.tolerans_pct > 0 && ` (±%${proforma.tolerans_pct})`}
                {proforma.secilen_metre && (
                  <div className="text-xs text-gray-400 font-normal">≈ {Number(proforma.secilen_metre).toLocaleString('tr-TR')} metre</div>
                )}
              </td>
              <td className="py-3 text-right">${Number(proforma.satis_fiyati_kg).toFixed(4)}</td>
              <td className="py-3 text-right font-semibold">${Number(proforma.toplam_tutar).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div className="flex justify-end mb-8">
          <div className="w-64">
            <div className="flex justify-between py-2 border-t-2 border-gray-800 font-bold text-base">
              <span>TOPLAM</span>
              <span>${Number(proforma.toplam_tutar).toFixed(2)} {proforma.para_birimi}</span>
            </div>
          </div>
        </div>

        {proforma.musteri_notu && (
          <div className="bg-gray-50 rounded-lg p-4 text-gray-600 text-xs mb-6">{proforma.musteri_notu}</div>
        )}

        <div className="text-xs text-gray-400 border-t border-gray-100 pt-4">
          Bu proforma fatura {proforma.gecerlilik_tarihi ? new Date(proforma.gecerlilik_tarihi).toLocaleDateString('tr-TR') : ''} tarihine kadar gecerlidir.
          Fiyatlar {proforma.para_birimi} cinsindendir ve KDV haric belirtilmistir.
        </div>
      </div>
    </div>
  )
}
