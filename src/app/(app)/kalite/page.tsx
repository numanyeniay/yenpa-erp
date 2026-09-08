'use client'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { supabase, yeniSikayetNo } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

type Tab = 'ret-fire' | 'sevkiyat-kontrol' | 'sikayet' | 'sertifika'

const TABS: { id: Tab; label: string }[] = [
  { id: 'ret-fire', label: 'Uretim Ret/Fire' },
  { id: 'sevkiyat-kontrol', label: 'Sevkiyat Oncesi Kontrol' },
  { id: 'sikayet', label: 'Musteri Sikayet/Iade' },
  { id: 'sertifika', label: 'Sertifika Arsivi' },
]

const ASAMA_LABEL: Record<string, string> = {
  baski: 'Baski', laminasyon: 'Laminasyon', dilimleme: 'Dilimleme', kesim_fason: 'Kesim/Fason',
  katlama: 'Katlama', paketleme: 'Paketleme', diger: 'Diger',
}
const SEBEP_LABEL: Record<string, string> = {
  baski_kaymasi: 'Baski kaymasi', lamine_ayrilmasi: 'Lamine ayrilmasi', kesim_hatasi: 'Kesim hatasi',
  olcu_hatasi: 'Olcu hatasi', delik_yirtik: 'Delik/yirtik', kirli_lekeli: 'Kirli/lekeli',
  renk_tutmama: 'Renk tutmama', sarim_hatasi: 'Sarim hatasi', makine_ayar: 'Makine ayar hatasi', diger: 'Diger',
}
const KATEGORI_LABEL: Record<string, string> = {
  baski_hatasi: 'Baski hatasi', sizdirma: 'Sizdirma', olcu_hatasi: 'Olcu hatasi',
  gec_teslimat: 'Gec teslimat', eksik_hasarli_urun: 'Eksik/hasarli urun', kalite_diger: 'Diger kalite sorunu', diger: 'Diger',
}
const DURUM_LABEL: Record<string, string> = { acik: 'Acik', inceleniyor: 'Inceleniyor', cozuldu: 'Cozuldu', reddedildi: 'Reddedildi' }
const DURUM_BADGE: Record<string, string> = { acik: 'badge-red', inceleniyor: 'badge-amber', cozuldu: 'badge-green', reddedildi: 'badge-gray' }
const SONUC_LABEL: Record<string, string> = { uygun: 'Uygun', sartli_uygun: 'Sartli uygun', red: 'Red' }
const SONUC_BADGE: Record<string, string> = { uygun: 'badge-green', sartli_uygun: 'badge-amber', red: 'badge-red' }
const BELGE_LABEL: Record<string, string> = {
  migrasyon_testi: 'Migrasyon testi', uygunluk_sertifikasi: 'Uygunluk sertifikasi',
  gida_kontak_beyani: 'Gida kontak beyani', analiz_raporu: 'Analiz raporu', diger: 'Diger',
}

function bugun() { return new Date().toISOString().split('T')[0] }

export default function KaliteKontrolPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('ret-fire')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  const [projeler, setProjeler] = useState<any[]>([])
  const [musteriler, setMusteriler] = useState<any[]>([])
  const [malzemeler, setMalzemeler] = useState<any[]>([])
  const [retFireler, setRetFireler] = useState<any[]>([])
  const [kontroller, setKontroller] = useState<any[]>([])
  const [sikayetler, setSikayetler] = useState<any[]>([])
  const [sertifikalar, setSertifikalar] = useState<any[]>([])

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: p }, { data: m }, { data: mz }, { data: rf }, { data: sk }, { data: sy }, { data: st }] = await Promise.all([
      supabase.from('proje').select('id, proje_no, ad, musteri_id').order('olusturma', { ascending: false }),
      supabase.from('musteri_tanim').select('id, kod, ad').eq('aktif', true).order('ad'),
      supabase.from('malzeme_tanim').select('id, kod, ad').eq('aktif', true).order('ad'),
      supabase.from('kalite_ret_fire').select('*, proje:proje(proje_no,ad), kullanici:kullanici_tanim(ad_soyad)').order('tarih', { ascending: false }).limit(200),
      supabase.from('kalite_sevkiyat_kontrol').select('*, proje:proje(proje_no,ad), kontrol_eden:kullanici_tanim(ad_soyad)').order('kontrol_tarihi', { ascending: false }).limit(200),
      supabase.from('kalite_sikayet').select('*, musteri:musteri_tanim(ad), proje:proje(proje_no,ad), bildiren:kullanici_tanim(ad_soyad)').order('olusturma', { ascending: false }).limit(200),
      supabase.from('kalite_sertifika').select('*, proje:proje(proje_no,ad), musteri:musteri_tanim(ad), malzeme:malzeme_tanim(ad)').order('olusturma', { ascending: false }).limit(200),
    ])
    setProjeler(p || []); setMusteriler(m || []); setMalzemeler(mz || [])
    setRetFireler(rf || []); setKontroller(sk || []); setSikayetler(sy || []); setSertifikalar(st || [])
    setLoading(false)
  }

  function flashMsg(m: string) { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Yukleniyor...</div>

  return (
    <div className="p-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Kalite Kontrol</h1>
          <p className="text-gray-500 text-xs mt-0.5">Uretim ret/fire, sevkiyat oncesi kontrol, musteri sikayet/iade ve sertifika arsivi</p>
        </div>
      </div>

      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors
              ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {msg && <div className={`mb-4 text-sm rounded-lg px-4 py-3 border ${msg.startsWith('Hata') ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>{msg}</div>}

      {tab === 'ret-fire' && (
        <RetFireTab projeler={projeler} kayitlar={retFireler} userId={user?.id} onSaved={() => { load(); flashMsg('Kayit eklendi.') }} onError={(e) => flashMsg('Hata: ' + e)} />
      )}
      {tab === 'sevkiyat-kontrol' && (
        <SevkiyatKontrolTab projeler={projeler} kayitlar={kontroller} userId={user?.id} onSaved={() => { load(); flashMsg('Kontrol kaydedildi.') }} onError={(e) => flashMsg('Hata: ' + e)} />
      )}
      {tab === 'sikayet' && (
        <SikayetTab musteriler={musteriler} projeler={projeler} kayitlar={sikayetler} userId={user?.id} onSaved={(m) => { load(); flashMsg(m) }} onError={(e) => flashMsg('Hata: ' + e)} />
      )}
      {tab === 'sertifika' && (
        <SertifikaTab isAdmin={user?.rol === 'admin'} projeler={projeler} musteriler={musteriler} malzemeler={malzemeler} kayitlar={sertifikalar} userId={user?.id} onSaved={() => { load(); flashMsg('Belge eklendi.') }} onError={(e) => flashMsg('Hata: ' + e)} />
      )}
    </div>
  )
}

// ───────────────────────── Tab 1: Uretim Ret/Fire ─────────────────────────

function RetFireTab({ projeler, kayitlar, userId, onSaved, onError }: any) {
  const [form, setForm] = useState<any>({ proje_id: '', asama: 'baski', sebep: 'baski_kaymasi', miktar_kg: '', aciklama: '', tarih: bugun() })
  const [saving, setSaving] = useState(false)

  const buAyToplam = useMemo(() => {
    const simdi = new Date()
    return kayitlar
      .filter((k: any) => { const t = new Date(k.tarih); return t.getFullYear() === simdi.getFullYear() && t.getMonth() === simdi.getMonth() })
      .reduce((s: number, k: any) => s + Number(k.miktar_kg || 0), 0)
  }, [kayitlar])

  async function kaydet() {
    if (!form.miktar_kg || Number(form.miktar_kg) <= 0) { onError('Miktar (kg) girmelisin.'); return }
    setSaving(true)
    const { error } = await supabase.from('kalite_ret_fire').insert({
      proje_id: form.proje_id || null,
      asama: form.asama,
      sebep: form.sebep,
      miktar_kg: parseFloat(form.miktar_kg),
      aciklama: form.aciklama || null,
      kullanici_id: userId || null,
      tarih: form.tarih ? new Date(form.tarih).toISOString() : new Date().toISOString(),
    })
    setSaving(false)
    if (error) { onError(error.message); return }
    setForm({ proje_id: '', asama: 'baski', sebep: 'baski_kaymasi', miktar_kg: '', aciklama: '', tarih: bugun() })
    onSaved()
  }

  async function sil(id: string) {
    await supabase.from('kalite_ret_fire').delete().eq('id', id)
    onSaved()
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card"><div className="stat-lbl">Bu ay toplam fire</div><div className="stat-val">{buAyToplam.toFixed(1)} kg</div></div>
        <div className="stat-card"><div className="stat-lbl">Toplam kayit</div><div className="stat-val">{kayitlar.length}</div></div>
        <div className="stat-card"><div className="stat-lbl">En sik sebep</div><div className="stat-val text-base mt-2">
          {(() => {
            if (kayitlar.length === 0) return '—'
            const say: Record<string, number> = {}
            kayitlar.forEach((k: any) => { say[k.sebep] = (say[k.sebep] || 0) + 1 })
            const top = Object.entries(say).sort((a, b) => b[1] - a[1])[0]
            return top ? SEBEP_LABEL[top[0]] || top[0] : '—'
          })()}
        </div></div>
      </div>

      <div className="card card-body">
        <div className="font-medium text-sm mb-3">Yeni ret/fire kaydi</div>
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label>Proje (opsiyonel)</label>
            <select value={form.proje_id} onChange={e => setForm({ ...form, proje_id: e.target.value })}>
              <option value="">— Genel / proje disi —</option>
              {projeler.map((p: any) => <option key={p.id} value={p.id}>{p.proje_no} — {p.ad}</option>)}
            </select>
          </div>
          <div>
            <label>Asama</label>
            <select value={form.asama} onChange={e => setForm({ ...form, asama: e.target.value })}>
              {Object.entries(ASAMA_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label>Sebep</label>
            <select value={form.sebep} onChange={e => setForm({ ...form, sebep: e.target.value })}>
              {Object.entries(SEBEP_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label>Miktar (kg)</label>
            <input type="number" step="0.1" value={form.miktar_kg} onChange={e => setForm({ ...form, miktar_kg: e.target.value })} />
          </div>
          <div>
            <label>Tarih</label>
            <input type="date" value={form.tarih} onChange={e => setForm({ ...form, tarih: e.target.value })} />
          </div>
          <div className="col-span-3">
            <label>Aciklama (opsiyonel)</label>
            <input value={form.aciklama} onChange={e => setForm({ ...form, aciklama: e.target.value })} placeholder="orn. 3. renkte kayma, is emri X" />
          </div>
        </div>
        <button onClick={kaydet} disabled={saving} className="btn btn-primary btn-sm mt-3">{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="table-base">
          <thead><tr><th>Tarih</th><th>Proje</th><th>Asama</th><th>Sebep</th><th>Miktar</th><th>Aciklama</th><th>Kaydeden</th><th></th></tr></thead>
          <tbody>
            {kayitlar.map((k: any) => (
              <tr key={k.id}>
                <td className="text-gray-500 text-xs">{new Date(k.tarih).toLocaleDateString('tr-TR')}</td>
                <td>{k.proje ? <>{k.proje.ad} <span className="text-gray-400 font-mono text-xs">({k.proje.proje_no})</span></> : <span className="text-gray-400">—</span>}</td>
                <td className="text-gray-500">{ASAMA_LABEL[k.asama] || k.asama}</td>
                <td className="text-gray-500">{SEBEP_LABEL[k.sebep] || k.sebep}</td>
                <td className="font-medium">{Number(k.miktar_kg).toFixed(1)} kg</td>
                <td className="text-gray-500 text-xs">{k.aciklama || '—'}</td>
                <td className="text-gray-400 text-xs">{k.kullanici?.ad_soyad || '—'}</td>
                <td><button onClick={() => sil(k.id)} className="btn btn-sm btn-danger">×</button></td>
              </tr>
            ))}
            {kayitlar.length === 0 && <tr><td colSpan={8} className="text-center text-gray-400 py-8">Henuz ret/fire kaydi yok</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ───────────────────── Tab 2: Sevkiyat Oncesi Kontrol ─────────────────────

function SevkiyatKontrolTab({ projeler, kayitlar, userId, onSaved, onError }: any) {
  const [form, setForm] = useState<any>({
    proje_id: '', gorsel_uygun: true, olcu_uygun: true, sizdirmazlik_uygun: true, agirlik_uygun: true,
    genel_sonuc: 'uygun', notlar: '',
  })
  const [saving, setSaving] = useState(false)

  async function kaydet() {
    if (!form.proje_id) { onError('Proje secmelisin.'); return }
    setSaving(true)
    const { error } = await supabase.from('kalite_sevkiyat_kontrol').insert({
      proje_id: form.proje_id,
      gorsel_uygun: form.gorsel_uygun, olcu_uygun: form.olcu_uygun,
      sizdirmazlik_uygun: form.sizdirmazlik_uygun, agirlik_uygun: form.agirlik_uygun,
      genel_sonuc: form.genel_sonuc, notlar: form.notlar || null,
      kontrol_eden_id: userId || null,
    })
    setSaving(false)
    if (error) { onError(error.message); return }
    setForm({ proje_id: '', gorsel_uygun: true, olcu_uygun: true, sizdirmazlik_uygun: true, agirlik_uygun: true, genel_sonuc: 'uygun', notlar: '' })
    onSaved()
  }

  const checkRow = (key: string, label: string) => (
    <label className="flex items-center gap-2 !mb-0 text-sm font-normal text-gray-700">
      <input type="checkbox" className="!w-auto" checked={form[key]} onChange={e => setForm({ ...form, [key]: e.target.checked })} />
      {label}
    </label>
  )

  return (
    <div className="space-y-5">
      <div className="card card-body">
        <div className="font-medium text-sm mb-3">Yeni sevkiyat oncesi kontrol</div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label>Proje</label>
            <select value={form.proje_id} onChange={e => setForm({ ...form, proje_id: e.target.value })}>
              <option value="">— Proje sec —</option>
              {projeler.map((p: any) => <option key={p.id} value={p.id}>{p.proje_no} — {p.ad}</option>)}
            </select>
          </div>
          <div>
            <label>Genel sonuc</label>
            <select value={form.genel_sonuc} onChange={e => setForm({ ...form, genel_sonuc: e.target.value })}>
              {Object.entries(SONUC_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3 mb-4">
          {checkRow('gorsel_uygun', 'Gorsel uygun')}
          {checkRow('olcu_uygun', 'Olcu uygun')}
          {checkRow('sizdirmazlik_uygun', 'Sizdirmazlik uygun')}
          {checkRow('agirlik_uygun', 'Agirlik uygun')}
        </div>
        <div className="mb-3">
          <label>Notlar</label>
          <input value={form.notlar} onChange={e => setForm({ ...form, notlar: e.target.value })} placeholder="orn. sag kenarda hafif kirisiklik, musteri toleransi icinde" />
        </div>
        <button onClick={kaydet} disabled={saving} className="btn btn-primary btn-sm">{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="table-base">
          <thead><tr><th>Tarih</th><th>Proje</th><th>Gorsel</th><th>Olcu</th><th>Sizdirmazlik</th><th>Agirlik</th><th>Sonuc</th><th>Notlar</th><th>Kontrol eden</th></tr></thead>
          <tbody>
            {kayitlar.map((k: any) => (
              <tr key={k.id}>
                <td className="text-gray-500 text-xs">{new Date(k.kontrol_tarihi).toLocaleDateString('tr-TR')}</td>
                <td>{k.proje?.ad} <span className="text-gray-400 font-mono text-xs">({k.proje?.proje_no})</span></td>
                <td>{k.gorsel_uygun ? '✓' : '✗'}</td>
                <td>{k.olcu_uygun ? '✓' : '✗'}</td>
                <td>{k.sizdirmazlik_uygun ? '✓' : '✗'}</td>
                <td>{k.agirlik_uygun ? '✓' : '✗'}</td>
                <td><span className={`badge ${SONUC_BADGE[k.genel_sonuc]}`}>{SONUC_LABEL[k.genel_sonuc]}</span></td>
                <td className="text-gray-500 text-xs">{k.notlar || '—'}</td>
                <td className="text-gray-400 text-xs">{k.kontrol_eden?.ad_soyad || '—'}</td>
              </tr>
            ))}
            {kayitlar.length === 0 && <tr><td colSpan={9} className="text-center text-gray-400 py-8">Henuz kontrol kaydi yok</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ───────────────────── Tab 3: Musteri Sikayet/Iade ─────────────────────

function SikayetTab({ musteriler, projeler, kayitlar, userId, onSaved, onError }: any) {
  const [form, setForm] = useState<any>({ musteri_id: '', proje_id: '', kategori: 'baski_hatasi', aciklama: '', iade_miktar_kg: '', bildirilme_tarihi: bugun() })
  const [saving, setSaving] = useState(false)
  const [acikId, setAcikId] = useState<string | null>(null)

  const acikSayisi = kayitlar.filter((k: any) => k.durum === 'acik' || k.durum === 'inceleniyor').length

  async function kaydet() {
    if (!form.musteri_id || !form.aciklama) { onError('Musteri ve aciklama zorunlu.'); return }
    setSaving(true)
    const sikayet_no = await yeniSikayetNo()
    const { error } = await supabase.from('kalite_sikayet').insert({
      sikayet_no, musteri_id: form.musteri_id, proje_id: form.proje_id || null,
      kategori: form.kategori, aciklama: form.aciklama,
      iade_miktar_kg: form.iade_miktar_kg ? parseFloat(form.iade_miktar_kg) : null,
      bildirilme_tarihi: form.bildirilme_tarihi || bugun(),
      bildiren_id: userId || null, durum: 'acik',
    })
    setSaving(false)
    if (error) { onError(error.message); return }
    setForm({ musteri_id: '', proje_id: '', kategori: 'baski_hatasi', aciklama: '', iade_miktar_kg: '', bildirilme_tarihi: bugun() })
    onSaved(`${sikayet_no} kaydedildi.`)
  }

  async function durumGuncelle(id: string, patch: any) {
    await supabase.from('kalite_sikayet').update(patch).eq('id', id)
    onSaved('Guncellendi.')
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card"><div className="stat-lbl">Acik / inceleniyor</div><div className="stat-val">{acikSayisi}</div></div>
        <div className="stat-card"><div className="stat-lbl">Toplam kayit</div><div className="stat-val">{kayitlar.length}</div></div>
        <div className="stat-card"><div className="stat-lbl">Cozulme orani</div><div className="stat-val">
          {kayitlar.length ? Math.round(100 * kayitlar.filter((k: any) => k.durum === 'cozuldu').length / kayitlar.length) : 0}%
        </div></div>
      </div>

      <div className="card card-body">
        <div className="font-medium text-sm mb-3">Yeni sikayet/iade kaydi</div>
        <div className="grid grid-cols-4 gap-3 mb-3">
          <div>
            <label>Musteri</label>
            <select value={form.musteri_id} onChange={e => setForm({ ...form, musteri_id: e.target.value })}>
              <option value="">— Musteri sec —</option>
              {musteriler.map((m: any) => <option key={m.id} value={m.id}>{m.ad}</option>)}
            </select>
          </div>
          <div>
            <label>Proje (opsiyonel)</label>
            <select value={form.proje_id} onChange={e => setForm({ ...form, proje_id: e.target.value })}>
              <option value="">— Proje yok —</option>
              {projeler.map((p: any) => <option key={p.id} value={p.id}>{p.proje_no} — {p.ad}</option>)}
            </select>
          </div>
          <div>
            <label>Kategori</label>
            <select value={form.kategori} onChange={e => setForm({ ...form, kategori: e.target.value })}>
              {Object.entries(KATEGORI_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label>Iade miktari (kg, opsiyonel)</label>
            <input type="number" step="0.1" value={form.iade_miktar_kg} onChange={e => setForm({ ...form, iade_miktar_kg: e.target.value })} />
          </div>
        </div>
        <div className="mb-3">
          <label>Aciklama</label>
          <input value={form.aciklama} onChange={e => setForm({ ...form, aciklama: e.target.value })} placeholder="musteri ne bildirdi?" />
        </div>
        <button onClick={kaydet} disabled={saving} className="btn btn-primary btn-sm">{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="table-base">
          <thead><tr><th>No</th><th>Musteri</th><th>Kategori</th><th>Aciklama</th><th>Durum</th><th>Tarih</th><th></th></tr></thead>
          <tbody>
            {kayitlar.map((k: any) => (
              <Fragment key={k.id}>
                <tr className="cursor-pointer" onClick={() => setAcikId(acikId === k.id ? null : k.id)}>
                  <td className="font-mono text-xs">{k.sikayet_no}</td>
                  <td>{k.musteri?.ad}</td>
                  <td className="text-gray-500">{KATEGORI_LABEL[k.kategori] || k.kategori}</td>
                  <td className="text-gray-500 text-xs max-w-xs truncate">{k.aciklama}</td>
                  <td><span className={`badge ${DURUM_BADGE[k.durum]}`}>{DURUM_LABEL[k.durum]}</span></td>
                  <td className="text-gray-400 text-xs">{new Date(k.bildirilme_tarihi).toLocaleDateString('tr-TR')}</td>
                  <td className="text-gray-400 text-xs">{acikId === k.id ? '▲' : '▼'}</td>
                </tr>
                {acikId === k.id && (
                  <tr>
                    <td colSpan={7} className="bg-gray-50 !py-4" onClick={e => e.stopPropagation()}>
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div>
                          <label>Durum</label>
                          <select value={k.durum} onChange={e => durumGuncelle(k.id, { durum: e.target.value, cozulme_tarihi: e.target.value === 'cozuldu' ? bugun() : k.cozulme_tarihi })}>
                            {Object.entries(DURUM_LABEL).map(([kk, v]) => <option key={kk} value={kk}>{v}</option>)}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label>Cozum notu</label>
                          <input defaultValue={k.cozum_notu || ''} onBlur={e => durumGuncelle(k.id, { cozum_notu: e.target.value })} />
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">Bildiren: {k.bildiren?.ad_soyad || '—'} {k.proje ? `· Proje: ${k.proje.ad} (${k.proje.proje_no})` : ''} {k.iade_miktar_kg ? `· Iade: ${k.iade_miktar_kg} kg` : ''}</div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {kayitlar.length === 0 && <tr><td colSpan={7} className="text-center text-gray-400 py-8">Henuz sikayet kaydi yok</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ───────────────────── Tab 4: Sertifika / Test Raporu Arsivi ─────────────────────

function SertifikaTab({ isAdmin, projeler, musteriler, malzemeler, kayitlar, userId, onSaved, onError }: any) {
  const [form, setForm] = useState<any>({
    baglanti: 'musteri', musteri_id: '', proje_id: '', malzeme_id: '',
    belge_turu: 'uygunluk_sertifikasi', belge_adi: '', dosya_url: '', gecerlilik_baslangic: '', gecerlilik_bitis: '', notlar: '',
  })
  const [saving, setSaving] = useState(false)

  async function kaydet() {
    if (!form.belge_adi) { onError('Belge adi zorunlu.'); return }
    setSaving(true)
    const { error } = await supabase.from('kalite_sertifika').insert({
      musteri_id: form.baglanti === 'musteri' ? (form.musteri_id || null) : null,
      proje_id: form.baglanti === 'proje' ? (form.proje_id || null) : null,
      malzeme_id: form.baglanti === 'malzeme' ? (form.malzeme_id || null) : null,
      belge_turu: form.belge_turu, belge_adi: form.belge_adi, dosya_url: form.dosya_url || null,
      gecerlilik_baslangic: form.gecerlilik_baslangic || null, gecerlilik_bitis: form.gecerlilik_bitis || null,
      notlar: form.notlar || null, ekleyen_id: userId || null,
    })
    setSaving(false)
    if (error) { onError(error.message); return }
    setForm({ baglanti: 'musteri', musteri_id: '', proje_id: '', malzeme_id: '', belge_turu: 'uygunluk_sertifikasi', belge_adi: '', dosya_url: '', gecerlilik_baslangic: '', gecerlilik_bitis: '', notlar: '' })
    onSaved()
  }

  async function sil(id: string) {
    await supabase.from('kalite_sertifika').delete().eq('id', id)
    onSaved()
  }

  function bagliEtiket(k: any) {
    if (k.proje) return `Proje: ${k.proje.ad} (${k.proje.proje_no})`
    if (k.musteri) return `Musteri: ${k.musteri.ad}`
    if (k.malzeme) return `Malzeme: ${k.malzeme.ad}`
    return '—'
  }

  const bugunTarih = bugun()

  return (
    <div className="space-y-5">
      {!isAdmin && (
        <div className="bg-amber-50 text-amber-800 text-xs rounded-lg px-4 py-3 border border-amber-200">
          Yeni belge ekleme ve silme sadece admin rolunde. Sen sadece goruntuleyebilirsin.
        </div>
      )}

      {isAdmin && (
        <div className="card card-body">
          <div className="font-medium text-sm mb-3">Yeni sertifika/test raporu</div>
          <div className="grid grid-cols-4 gap-3 mb-3">
            <div>
              <label>Bagli oldugu</label>
              <select value={form.baglanti} onChange={e => setForm({ ...form, baglanti: e.target.value })}>
                <option value="musteri">Musteri</option>
                <option value="proje">Proje</option>
                <option value="malzeme">Malzeme</option>
              </select>
            </div>
            {form.baglanti === 'musteri' && (
              <div><label>Musteri</label>
                <select value={form.musteri_id} onChange={e => setForm({ ...form, musteri_id: e.target.value })}>
                  <option value="">— Sec —</option>
                  {musteriler.map((m: any) => <option key={m.id} value={m.id}>{m.ad}</option>)}
                </select>
              </div>
            )}
            {form.baglanti === 'proje' && (
              <div><label>Proje</label>
                <select value={form.proje_id} onChange={e => setForm({ ...form, proje_id: e.target.value })}>
                  <option value="">— Sec —</option>
                  {projeler.map((p: any) => <option key={p.id} value={p.id}>{p.proje_no} — {p.ad}</option>)}
                </select>
              </div>
            )}
            {form.baglanti === 'malzeme' && (
              <div><label>Malzeme</label>
                <select value={form.malzeme_id} onChange={e => setForm({ ...form, malzeme_id: e.target.value })}>
                  <option value="">— Sec —</option>
                  {malzemeler.map((m: any) => <option key={m.id} value={m.id}>{m.ad}</option>)}
                </select>
              </div>
            )}
            <div>
              <label>Belge turu</label>
              <select value={form.belge_turu} onChange={e => setForm({ ...form, belge_turu: e.target.value })}>
                {Object.entries(BELGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label>Belge adi</label>
              <input value={form.belge_adi} onChange={e => setForm({ ...form, belge_adi: e.target.value })} placeholder="orn. Migrasyon testi raporu - PET/CPP 2026" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div><label>Dosya linki (opsiyonel)</label><input value={form.dosya_url} onChange={e => setForm({ ...form, dosya_url: e.target.value })} placeholder="OneDrive/Drive paylasim linki" /></div>
            <div><label>Gecerlilik baslangic</label><input type="date" value={form.gecerlilik_baslangic} onChange={e => setForm({ ...form, gecerlilik_baslangic: e.target.value })} /></div>
            <div><label>Gecerlilik bitis</label><input type="date" value={form.gecerlilik_bitis} onChange={e => setForm({ ...form, gecerlilik_bitis: e.target.value })} /></div>
          </div>
          <div className="mb-3"><label>Notlar</label><input value={form.notlar} onChange={e => setForm({ ...form, notlar: e.target.value })} /></div>
          <button onClick={kaydet} disabled={saving} className="btn btn-primary btn-sm">{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <table className="table-base">
          <thead><tr><th>Belge</th><th>Tur</th><th>Bagli</th><th>Gecerlilik bitis</th><th>Dosya</th>{isAdmin && <th></th>}</tr></thead>
          <tbody>
            {kayitlar.map((k: any) => {
              const suresiGecmis = k.gecerlilik_bitis && k.gecerlilik_bitis < bugunTarih
              return (
                <tr key={k.id}>
                  <td className="font-medium">{k.belge_adi}</td>
                  <td className="text-gray-500">{BELGE_LABEL[k.belge_turu] || k.belge_turu}</td>
                  <td className="text-gray-500 text-xs">{bagliEtiket(k)}</td>
                  <td>{k.gecerlilik_bitis ? <span className={suresiGecmis ? 'text-red-600 font-medium' : 'text-gray-500'}>{new Date(k.gecerlilik_bitis).toLocaleDateString('tr-TR')}{suresiGecmis ? ' (suresi gecmis)' : ''}</span> : <span className="text-gray-400">—</span>}</td>
                  <td>{k.dosya_url ? <a href={k.dosya_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs">Ac →</a> : <span className="text-gray-400">—</span>}</td>
                  {isAdmin && <td><button onClick={() => sil(k.id)} className="btn btn-sm btn-danger">×</button></td>}
                </tr>
              )
            })}
            {kayitlar.length === 0 && <tr><td colSpan={isAdmin ? 6 : 5} className="text-center text-gray-400 py-8">Henuz belge yok</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
