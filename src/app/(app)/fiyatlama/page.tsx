'use client'
import { useState } from 'react'

const MALZEMELER: Record<string,{yogunluk:number,fiyat:number}> = {
  OPP:{yogunluk:0.91,fiyat:3.27}, PET:{yogunluk:1.38,fiyat:3.00},
  CPP:{yogunluk:0.91,fiyat:2.80}, LDPE:{yogunluk:0.92,fiyat:2.40},
  ALU:{yogunluk:2.70,fiyat:5.50}, MOPP:{yogunluk:0.91,fiyat:3.60},
  MPET:{yogunluk:1.38,fiyat:3.80}, PA:{yogunluk:1.14,fiyat:4.20},
}

interface Katman { mat:string; mikron:number; fiyat:number }

export default function FiyatlamaPage() {
  const [katmanlar, setKatmanlar] = useState<Katman[]>([
    {mat:'PET',mikron:12,fiyat:3.00},
    {mat:'CPP',mikron:30,fiyat:2.80},
  ])
  const [baskili, setBaskili] = useState(true)
  const [lamineli, setLamineli] = useState(true)
  const [sipKg, setSipKg] = useState(500)
  const [enMm, setEnMm] = useState(908)
  const [boyaFiyat, setBoyaFiyat] = useState(6)
  const [tutkalFiyat, setTutkalFiyat] = useState(6.5)
  const [iscilik, setIscilik] = useState(0.5)
  const [kur, setKur] = useState(38.5)
  const [fire, setFire] = useState(3)
  const [kar, setKar] = useState(20)
  const [iskonto, setIskonto] = useState(0)

  function katmanGuncelle(i:number, alan:string, val:string) {
    const yeni = [...katmanlar]
    if(alan==='mat') { yeni[i]={...yeni[i],mat:val,fiyat:MALZEMELER[val]?.fiyat||0} }
    else if(alan==='mikron') { yeni[i]={...yeni[i],mikron:parseInt(val)||0} }
    else if(alan==='fiyat') { yeni[i]={...yeni[i],fiyat:parseFloat(val)||0} }
    setKatmanlar(yeni)
  }

  // Hesaplama — Excel formülü
  const enM = enMm/1000
  const toplamGm2 = katmanlar.reduce((s,k)=>s+(k.mikron*(MALZEMELER[k.mat]?.yogunluk||1)),0)
  const boyaKalanGm2 = baskili ? 2.2 : 0
  const tutkalGm2 = lamineli ? 2.0 : 0
  const mamulGm2 = toplamGm2/1000 + boyaKalanGm2/1000 + tutkalGm2/1000
  const m2 = mamulGm2 > 0 ? sipKg/mamulGm2 : 0
  const metre = m2/enM

  const katHesap = katmanlar.map(k => {
    const d = MALZEMELER[k.mat]?.yogunluk||1
    const kg = m2*k.mikron*d/1000
    return {...k, kg, tutar:kg*k.fiyat, oran:kg/sipKg*100}
  })
  const filmUsd = katHesap.reduce((s,k)=>s+k.tutar,0)
  const boyaKulKg = baskili ? m2*6.6/1000 : 0
  const boyaUsd = boyaKulKg*boyaFiyat
  const tutkalKg = lamineli ? m2*2.0/1000 : 0
  const tutkalUsd = tutkalKg*tutkalFiyat
  const iscilikUsd = sipKg*iscilik
  const toplamUsd = filmUsd+boyaUsd+tutkalUsd+iscilikUsd
  const maliyetFireUsd = toplamUsd*(1+fire/100)
  const satisUsd = maliyetFireUsd/(1-kar/100)
  const satisKg = satisUsd/sipKg
  const netKg = satisKg*(1-iskonto/100)
  const satisMetre = satisUsd/metre
  const satisTl = netKg*kur

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold mb-6">Fiyatlama & Maliyet hesabı</h1>

      <div className="grid grid-cols-3 gap-6">
        {/* Sol — Girişler */}
        <div className="col-span-2 space-y-4">
          {/* Katmanlar */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium">Film katmanları</h2>
              <button className="btn text-xs py-1" onClick={()=>setKatmanlar([...katmanlar,{mat:'OPP',mikron:20,fiyat:3.27}])}>+ Katman ekle</button>
            </div>
            {katmanlar.map((k,i)=>(
              <div key={i} className="grid grid-cols-5 gap-2 mb-2 items-end">
                <div className="col-span-1">
                  {i===0 && <label className="block text-xs text-gray-500 mb-1">Malzeme</label>}
                  <select value={k.mat} onChange={e=>katmanGuncelle(i,'mat',e.target.value)}>
                    {Object.keys(MALZEMELER).map(m=><option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  {i===0 && <label className="block text-xs text-gray-500 mb-1">Mikron (μm)</label>}
                  <input type="number" value={k.mikron} onChange={e=>katmanGuncelle(i,'mikron',e.target.value)} />
                </div>
                <div>
                  {i===0 && <label className="block text-xs text-gray-500 mb-1">Yoğunluk</label>}
                  <input value={(MALZEMELER[k.mat]?.yogunluk||1).toFixed(3)} readOnly className="bg-gray-50 text-gray-400" />
                </div>
                <div>
                  {i===0 && <label className="block text-xs text-gray-500 mb-1">Fiyat ($/kg)</label>}
                  <input type="number" step="0.01" value={k.fiyat} onChange={e=>katmanGuncelle(i,'fiyat',e.target.value)} />
                </div>
                <button onClick={()=>setKatmanlar(katmanlar.filter((_,j)=>j!==i))}
                  className="text-gray-300 hover:text-red-400 text-lg pb-1">×</button>
              </div>
            ))}
            <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={baskili} onChange={e=>setBaskili(e.target.checked)} className="w-auto" />Baskılı
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={lamineli} onChange={e=>setLamineli(e.target.checked)} className="w-auto" />Lamineli
              </label>
            </div>
          </div>

          {/* Miktar & parametreler */}
          <div className="card">
            <h2 className="text-sm font-medium mb-4">Sipariş & parametreler</h2>
            <div className="grid grid-cols-4 gap-3">
              {[
                {label:'Sipariş (kg)',val:sipKg,set:(v:number)=>setSipKg(v),step:1},
                {label:'Bobin eni (mm)',val:enMm,set:(v:number)=>setEnMm(v),step:1},
                {label:'Boya ($/kg)',val:boyaFiyat,set:(v:number)=>setBoyaFiyat(v),step:0.1},
                {label:'Tutkal ($/kg)',val:tutkalFiyat,set:(v:number)=>setTutkalFiyat(v),step:0.1},
                {label:'İşçilik ($/kg)',val:iscilik,set:(v:number)=>setIscilik(v),step:0.1},
                {label:'USD/TL kuru',val:kur,set:(v:number)=>setKur(v),step:0.1},
                {label:'Fire oranı (%)',val:fire,set:(v:number)=>setFire(v),step:0.5},
                {label:'Kâr marjı (%)',val:kar,set:(v:number)=>setKar(v),step:1},
              ].map(p=>(
                <div key={p.label}>
                  <label className="block text-xs text-gray-500 mb-1">{p.label}</label>
                  <input type="number" step={p.step} value={p.val} onChange={e=>p.set(parseFloat(e.target.value)||0)} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sağ — Sonuç */}
        <div className="space-y-4">
          <div className="card bg-gray-50 border-gray-200">
            <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Özet</h2>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">m²</span><span className="font-medium">{Math.round(m2).toLocaleString('tr-TR')}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Metre</span><span className="font-medium">{Math.round(metre).toLocaleString('tr-TR')}</span></div>
            </div>

            <div className="border-t border-gray-200 my-3" />
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Maliyet dökümü</h3>
            <div className="space-y-1 text-sm">
              {katHesap.map((k,i)=>(
                <div key={i} className="flex justify-between">
                  <span className="text-gray-500">{k.mat} {k.mikron}μm</span>
                  <span>${k.tutar.toFixed(3)}</span>
                </div>
              ))}
              {baskili && <div className="flex justify-between"><span className="text-gray-500">Boya ({boyaKulKg.toFixed(2)} kg)</span><span>${boyaUsd.toFixed(3)}</span></div>}
              {lamineli && <div className="flex justify-between"><span className="text-gray-500">Tutkal ({tutkalKg.toFixed(2)} kg)</span><span>${tutkalUsd.toFixed(3)}</span></div>}
              <div className="flex justify-between"><span className="text-gray-500">İşçilik</span><span>${iscilikUsd.toFixed(3)}</span></div>
              <div className="flex justify-between font-medium border-t border-gray-200 pt-1 mt-1">
                <span>Toplam maliyet</span><span>${toplamUsd.toFixed(3)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>+ Fire %{fire}</span><span>${maliyetFireUsd.toFixed(3)}</span>
              </div>
            </div>

            <div className="border-t border-gray-200 my-3" />
            <h3 className="text-xs font-medium text-green-600 uppercase tracking-wide mb-2">Satış fiyatı (%{kar} marj)</h3>
            <div className="space-y-2">
              {[
                {label:'USD/kg',val:'$'+satisKg.toFixed(4)},
                {label:'Net USD/kg',val:'$'+netKg.toFixed(4)},
                {label:'USD/metre',val:'$'+satisMetre.toFixed(4)},
                {label:'TL/kg',val:'₺'+satisTl.toFixed(2)},
                {label:'Toplam (USD)',val:'$'+(netKg*sipKg).toFixed(2)},
              ].map(r=>(
                <div key={r.label} className="flex justify-between bg-white rounded-lg px-3 py-2">
                  <span className="text-xs text-gray-500">{r.label}</span>
                  <span className="text-sm font-semibold text-green-700">{r.val}</span>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <label className="block text-xs text-gray-500 mb-1">İskonto (%)</label>
              <input type="number" value={iskonto} onChange={e=>setIskonto(parseFloat(e.target.value)||0)} step={1} min={0} max={50} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
