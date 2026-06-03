'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const MAKINELER = [
  { kod:'M01', ad:'Baskı', tur:'baski', icon:'🖨️', hedef:130 },
  { kod:'M02', ad:'Laminasyon', tur:'laminasyon', icon:'🔗', hedef:250 },
  { kod:'M03', ad:'Dilimleme / Kesim', tur:'dilimleme', icon:'✂️', hedef:200 },
]

export default function TabletPage() {
  const [secilenMak, setSecilenMak] = useState<number|null>(null)
  const [isler, setIsler] = useState<any[]>([])
  const [makineler, setMakineler] = useState<any[]>([])
  const [modal, setModal] = useState<string|null>(null)
  const [secilenIs, setSecilenIs] = useState<any|null>(null)
  const [formVal, setFormVal] = useState('')
  const [formVal2, setFormVal2] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { loadMakineler() }, [])
  useEffect(() => { if(secilenMak!==null) loadIsler() }, [secilenMak])

  async function loadMakineler() {
    const { data } = await supabase.from('makine').select('*').eq('aktif',true)
    setMakineler(data||[])
  }

  async function loadIsler() {
    const mak = MAKINELER[secilenMak!]
    const { data } = await supabase
      .from('uretim_kaydi')
      .select('*, is_emri(ie_no, urun_tanimi, siparis_kg, hedef_metre, musteri(ad))')
      .eq('adim', mak.tur)
      .in('durum',['bekliyor','calisiyor','durustu'])
      .order('baslangic')
    setIsler(data||[])
  }

  const aktifIs = isler.find(i=>i.durum==='calisiyor')
  const bekleyenler = isler.filter(i=>i.durum==='bekliyor')

  async function islemYap(tip: string) {
    if(!secilenIs) return
    setLoading(true)
    if(tip==='baslat') {
      await supabase.from('uretim_kaydi').update({ durum:'calisiyor', baslangic:new Date().toISOString() }).eq('id', secilenIs.id)
      await supabase.from('is_emri').update({ durum:'uretimde' }).eq('id', secilenIs.is_emri_id)
    } else if(tip==='durdur') {
      await supabase.from('uretim_kaydi').update({ durum:'durustu' }).eq('id', secilenIs.id)
      await supabase.from('durus_kaydi').insert({ uretim_kaydi_id: secilenIs.id, neden: formVal, sure_dk: parseInt(formVal2)||0 })
    } else if(tip==='tamamla') {
      await supabase.from('uretim_kaydi').update({ durum:'tamamlandi', uretilen_metre: parseFloat(formVal)||0, fire_kg: parseFloat(formVal2)||0, bitis:new Date().toISOString() }).eq('id', secilenIs.id)
    } else if(tip==='metre') {
      await supabase.from('uretim_kaydi').update({ uretilen_metre: parseFloat(formVal)||0 }).eq('id', secilenIs.id)
    } else if(tip==='fire') {
      const mevcut = secilenIs.fire_kg||0
      await supabase.from('uretim_kaydi').update({ fire_kg: mevcut + (parseFloat(formVal)||0) }).eq('id', secilenIs.id)
    }
    setModal(null); setFormVal(''); setFormVal2(''); loadIsler(); setLoading(false)
  }

  if (secilenMak === null) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-2xl font-semibold text-gray-900">Yenpa ERP</div>
          <div className="text-gray-500 text-sm mt-1">Hangi makinede çalışıyorsunuz?</div>
        </div>
        <div className="space-y-3">
          {MAKINELER.map((m,i)=>(
            <button key={i} onClick={()=>setSecilenMak(i)}
              className="w-full bg-white border border-gray-200 rounded-2xl p-5 text-left hover:border-blue-400 hover:bg-blue-50 transition-colors">
              <div className="flex items-center gap-4">
                <span className="text-3xl">{m.icon}</span>
                <div>
                  <div className="font-semibold text-gray-900 text-lg">{m.ad}</div>
                  <div className="text-sm text-gray-500">Hedef: {m.hedef} m/dk</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  const mak = MAKINELER[secilenMak]

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Header */}
      <div className="bg-[#1a1a2e] rounded-2xl p-4 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{mak.icon}</span>
          <div>
            <div className="text-white font-semibold">{mak.ad} makinesi</div>
            <div className="text-white/50 text-xs">{new Date().toLocaleString('tr-TR')}</div>
          </div>
        </div>
        <button onClick={()=>setSecilenMak(null)} className="text-white/50 hover:text-white text-sm">↩ Değiştir</button>
      </div>

      {/* Aktif iş */}
      {aktifIs ? (
        <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-4 mb-4">
          <div className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-2">▶ Üretimde</div>
          <div className="text-lg font-semibold text-gray-900">{aktifIs.is_emri?.ie_no}</div>
          <div className="text-sm text-gray-600">{aktifIs.is_emri?.musteri?.ad}</div>
          <div className="text-xs text-gray-500 mt-1">{aktifIs.is_emri?.urun_tanimi}</div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {[
              {l:'Sipariş',v:(aktifIs.is_emri?.siparis_kg||0)+' kg'},
              {l:'Üretilen',v:(aktifIs.uretilen_metre||0)+' m'},
              {l:'Fire',v:(aktifIs.fire_kg||0)+' kg'},
            ].map(s=>(
              <div key={s.l} className="bg-white rounded-xl p-2 text-center">
                <div className="text-base font-semibold">{s.v}</div>
                <div className="text-xs text-gray-400">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-4 text-center text-gray-400">
          {bekleyenler.length > 0 ? (
            <div>
              <div className="text-sm mb-2">Sıradaki iş:</div>
              <div className="font-semibold text-gray-700">{bekleyenler[0].is_emri?.ie_no} · {bekleyenler[0].is_emri?.musteri?.ad}</div>
            </div>
          ) : <div className="text-sm">Bekleyen iş yok</div>}
        </div>
      )}

      {/* Butonlar */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {aktifIs ? ([
          {label:'✅ Tamamlandı', tip:'tamamla', cls:'bg-blue-600 text-white'},
          {label:'⏸ Durdur', tip:'durdur', cls:'bg-red-500 text-white'},
          {label:'📏 Metre gir', tip:'metre', cls:'bg-white border border-gray-200 text-gray-700'},
          {label:'⚠️ Fire gir', tip:'fire', cls:'bg-white border border-gray-200 text-gray-700'},
        ] : bekleyenler.length > 0 ? [
          {label:'▶ Başlat', tip:'baslat', cls:'bg-green-600 text-white col-span-2'},
        ] : []).map((b:any)=>(
          <button key={b.tip}
            onClick={()=>{ setSecilenIs(aktifIs||bekleyenler[0]); setModal(b.tip) }}
            className={`rounded-2xl py-4 text-base font-semibold ${b.cls} ${b.label.includes('Başlat')?'col-span-2':''}`}>
            {b.label}
          </button>
        ))}
      </div>

      {/* İş sırası */}
      {bekleyenler.length > 0 && (
        <div className="card">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Sıradaki işler</div>
          {bekleyenler.map((is,i)=>(
            <div key={is.id} className={`flex items-center gap-3 py-3 border-b border-gray-100 last:border-0 ${i===0?'opacity-100':'opacity-50'}`}>
              <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold flex items-center justify-center">{i+1}</div>
              <div className="flex-1">
                <div className="text-sm font-medium">{is.is_emri?.ie_no}</div>
                <div className="text-xs text-gray-500">{is.is_emri?.musteri?.ad} · {is.is_emri?.siparis_kg} kg</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modallar */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={()=>setModal(null)}>
          <div className="bg-white w-full rounded-t-3xl p-6" onClick={e=>e.stopPropagation()}>
            <div className="text-base font-semibold mb-4">
              {modal==='baslat'&&'İşi başlat'}
              {modal==='tamamla'&&'İşi tamamla'}
              {modal==='durdur'&&'Duruş kaydet'}
              {modal==='metre'&&'Metre güncelle'}
              {modal==='fire'&&'Fire kaydet'}
            </div>
            {modal==='baslat' && <p className="text-sm text-gray-500 mb-4">{secilenIs?.is_emri?.ie_no} · {secilenIs?.is_emri?.musteri?.ad}</p>}
            {modal==='tamamla' && <>
              <div className="mb-3"><label className="block text-xs text-gray-500 mb-1">Toplam üretilen metre</label>
                <input type="number" value={formVal} onChange={e=>setFormVal(e.target.value)} placeholder={secilenIs?.is_emri?.hedef_metre?.toString()} /></div>
              <div className="mb-4"><label className="block text-xs text-gray-500 mb-1">Toplam fire (kg)</label>
                <input type="number" step="0.1" value={formVal2} onChange={e=>setFormVal2(e.target.value)} placeholder="0" /></div>
            </>}
            {modal==='durdur' && <>
              <div className="mb-3"><label className="block text-xs text-gray-500 mb-1">Duruş nedeni</label>
                <select value={formVal} onChange={e=>setFormVal(e.target.value)}>
                  <option value="">Seçiniz...</option>
                  {['Bıçak değişimi','Boya değişimi','Film kopması','Makine arızası','Enerji kesintisi','Planlı bakım','Diğer'].map(n=><option key={n}>{n}</option>)}
                </select></div>
              <div className="mb-4"><label className="block text-xs text-gray-500 mb-1">Tahmini süre (dk)</label>
                <input type="number" value={formVal2} onChange={e=>setFormVal2(e.target.value)} placeholder="15" /></div>
            </>}
            {(modal==='metre'||modal==='fire') && (
              <div className="mb-4"><label className="block text-xs text-gray-500 mb-1">{modal==='metre'?'Üretilen metre':'Fire miktarı (kg)'}</label>
                <input type="number" step={modal==='fire'?'0.1':'1'} value={formVal} onChange={e=>setFormVal(e.target.value)} /></div>
            )}
            <div className="flex gap-3">
              <button onClick={()=>setModal(null)} className="btn flex-1 justify-center">İptal</button>
              <button onClick={()=>islemYap(modal)} disabled={loading}
                className="btn btn-primary flex-1 justify-center">{loading?'...':'Onayla'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
