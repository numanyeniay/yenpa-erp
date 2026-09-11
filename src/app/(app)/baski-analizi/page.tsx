'use client'
import { useEffect, useRef, useState } from 'react'

// ============================================================
// BASKI ALANI ANALIZI
// Yuklenen bir urun fotografi (veya tasarim goruntusu) uzerinde,
// kullanicinin isaretledigi "baskisiz" (temel film) rengine gore
// piksel bazli bir yaklasik baski alani yuzdesi hesaplar.
//
// NOT: Bu tamamen tarayici icinde (canvas) calisan yaklasik bir
// analizdir — ışık, yansima, parlaklik gibi faktorlerden etkilenir.
// Kesin/hassas olcum icin gercek baski dosyasi (PDF/AI) daha
// guvenilirdir; boyle bir dosya varsa Claude'a sohbette dogrudan
// gonderilip gorsel olarak da degerlendirilebilir.
// ============================================================

const MAX_ANALIZ_GENISLIK = 700 // px — buyuk fotograflari kucultup hizli tutmak icin

interface Secim { x: number; y: number; w: number; h: number }

export default function BaskiAnaliziPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null)
  const [canvasBoyut, setCanvasBoyut] = useState({ w: 0, h: 0 })

  const [mod, setMod] = useState<'yok' | 'alan_sec' | 'renk_sec'>('yok')
  const [secim, setSecim] = useState<Secim | null>(null)
  const [surukluyor, setSurukluyor] = useState(false)
  const [baslangic, setBaslangic] = useState<{ x: number; y: number } | null>(null)

  const [refRenk, setRefRenk] = useState<{ r: number; g: number; b: number } | null>(null)
  const [esik, setEsik] = useState(38)
  const [sonucYuzde, setSonucYuzde] = useState<number | null>(null)
  const [analizEdilenPiksel, setAnalizEdilenPiksel] = useState(0)

  // Dosya yuklenince goruntuyu canvas'a ciz
  function dosyaYukle(dosya: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const olcek = Math.min(1, MAX_ANALIZ_GENISLIK / img.width)
        const w = Math.round(img.width * olcek)
        const h = Math.round(img.height * olcek)
        setCanvasBoyut({ w, h })
        setImgEl(img)
        setSecim(null)
        setRefRenk(null)
        setSonucYuzde(null)
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(dosya)
  }

  // Goruntu veya boyut degisince ana canvas'a ciz
  useEffect(() => {
    if (!imgEl || !canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return
    canvasRef.current.width = canvasBoyut.w
    canvasRef.current.height = canvasBoyut.h
    ctx.drawImage(imgEl, 0, 0, canvasBoyut.w, canvasBoyut.h)
    if (overlayRef.current) {
      overlayRef.current.width = canvasBoyut.w
      overlayRef.current.height = canvasBoyut.h
      const octx = overlayRef.current.getContext('2d')
      octx?.clearRect(0, 0, canvasBoyut.w, canvasBoyut.h)
    }
  }, [imgEl, canvasBoyut])

  function tikla(e: React.MouseEvent<HTMLCanvasElement>) {
    if (mod !== 'renk_sec' || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const x = Math.round(e.clientX - rect.left)
    const y = Math.round(e.clientY - rect.top)
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return
    const px = ctx.getImageData(x, y, 1, 1).data
    setRefRenk({ r: px[0], g: px[1], b: px[2] })
    setMod('yok')
  }

  function mouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (mod !== 'alan_sec' || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setBaslangic({ x, y })
    setSurukluyor(true)
  }
  function mouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!surukluyor || !baslangic || !canvasRef.current || !overlayRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const s: Secim = {
      x: Math.round(Math.min(x, baslangic.x)),
      y: Math.round(Math.min(y, baslangic.y)),
      w: Math.round(Math.abs(x - baslangic.x)),
      h: Math.round(Math.abs(y - baslangic.y)),
    }
    setSecim(s)
    const octx = overlayRef.current.getContext('2d')
    if (!octx) return
    octx.clearRect(0, 0, canvasBoyut.w, canvasBoyut.h)
    octx.strokeStyle = '#2563eb'
    octx.lineWidth = 2
    octx.setLineDash([6, 4])
    octx.strokeRect(s.x, s.y, s.w, s.h)
  }
  function mouseUp() {
    setSurukluyor(false)
    setMod('yok')
  }

  function hesapla() {
    if (!canvasRef.current || !refRenk) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return
    const bolge = secim && secim.w > 4 && secim.h > 4
      ? secim
      : { x: 0, y: 0, w: canvasBoyut.w, h: canvasBoyut.h }
    const data = ctx.getImageData(bolge.x, bolge.y, bolge.w, bolge.h).data
    let basiliSayisi = 0
    const toplamPiksel = bolge.w * bolge.h
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2]
      const fark = Math.sqrt((r - refRenk.r) ** 2 + (g - refRenk.g) ** 2 + (b - refRenk.b) ** 2)
      if (fark > esik) basiliSayisi++
    }
    setAnalizEdilenPiksel(toplamPiksel)
    setSonucYuzde(toplamPiksel > 0 ? (basiliSayisi / toplamPiksel) * 100 : 0)

    // Gorsel geri bildirim: baskili piksel bolgelerini kirmizi tonla isaretle
    if (overlayRef.current) {
      const octx = overlayRef.current.getContext('2d')
      if (octx) {
        octx.clearRect(0, 0, canvasBoyut.w, canvasBoyut.h)
        const overlayData = octx.createImageData(bolge.w, bolge.h)
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2]
          const fark = Math.sqrt((r - refRenk.r) ** 2 + (g - refRenk.g) ** 2 + (b - refRenk.b) ** 2)
          if (fark > esik) {
            overlayData.data[i] = 239; overlayData.data[i + 1] = 68; overlayData.data[i + 2] = 68
            overlayData.data[i + 3] = 120
          }
        }
        octx.putImageData(overlayData, bolge.x, bolge.y)
        if (secim) {
          octx.strokeStyle = '#2563eb'
          octx.lineWidth = 2
          octx.setLineDash([6, 4])
          octx.strokeRect(secim.x, secim.y, secim.w, secim.h)
        }
      }
    }
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">Baski Alani Analizi</h1>
          <p className="text-gray-500 text-xs mt-0.5">
            Bir urun fotografi veya tasarim goruntusu yukle, baskisiz (temel film) rengini isaretle —
            yaklasik baski alani yuzdesini hesaplar. Bu otomatik/yaklasik bir olcumdur; isik, yansima ve
            fotograf kalitesine gore degisebilir. Hassas sonuc icin gercek baski dosyasini (PDF/AI)
            dogrudan Claude'a sohbette gonderip gorsel degerlendirme de isteyebilirsin.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <div className="card card-body space-y-3">
            <input
              type="file"
              accept="image/*"
              onChange={e => e.target.files?.[0] && dosyaYukle(e.target.files[0])}
            />
            {imgEl && (
              <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-gray-100">
                <button
                  className={`btn btn-sm ${mod === 'alan_sec' ? 'btn-primary' : ''}`}
                  onClick={() => setMod(mod === 'alan_sec' ? 'yok' : 'alan_sec')}
                >
                  1) Analiz alanini sec (surukle)
                </button>
                <button
                  className={`btn btn-sm ${mod === 'renk_sec' ? 'btn-primary' : ''}`}
                  onClick={() => setMod(mod === 'renk_sec' ? 'yok' : 'renk_sec')}
                >
                  2) Baskisiz (temel) rengi sec
                </button>
                {secim && (
                  <button className="btn btn-sm" onClick={() => setSecim(null)}>Secimi temizle (tum gorsel)</button>
                )}
              </div>
            )}
            {mod === 'alan_sec' && <div className="text-xs text-blue-600">Gorsel uzerinde, sadece urunun/baski yuzeyinin oldugu bolgeyi surukleyerek sec.</div>}
            {mod === 'renk_sec' && <div className="text-xs text-blue-600">Gorselde baski olmayan, saf/temel film rengine (orn. seffaf/beyaz alan) tikla.</div>}

            <div className="relative inline-block" style={{ maxWidth: '100%' }}>
              <canvas
                ref={canvasRef}
                onClick={tikla}
                onMouseDown={mouseDown}
                onMouseMove={mouseMove}
                onMouseUp={mouseUp}
                className="border border-gray-200 rounded"
                style={{ cursor: mod !== 'yok' ? 'crosshair' : 'default', maxWidth: '100%', display: imgEl ? 'block' : 'none' }}
              />
              <canvas
                ref={overlayRef}
                className="absolute top-0 left-0 pointer-events-none"
                style={{ maxWidth: '100%', display: imgEl ? 'block' : 'none' }}
              />
              {!imgEl && (
                <div className="text-sm text-gray-400 text-center py-16 border border-dashed border-gray-200 rounded" style={{ width: 400 }}>
                  Once bir gorsel yukle
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="card card-body space-y-3">
            <div className="font-medium text-sm">Ayarlar</div>
            <div>
              <label className="text-xs text-gray-400">Baskisiz referans renk</label>
              <div className="flex items-center gap-2 mt-1">
                {refRenk ? (
                  <>
                    <div className="w-6 h-6 rounded border border-gray-300" style={{ background: `rgb(${refRenk.r},${refRenk.g},${refRenk.b})` }} />
                    <span className="text-xs font-mono text-gray-500">rgb({refRenk.r},{refRenk.g},{refRenk.b})</span>
                  </>
                ) : (
                  <span className="text-xs text-gray-400">Henuz secilmedi</span>
                )}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400">Hassasiyet esigi ({esik})</label>
              <input type="range" min={10} max={100} value={esik} onChange={e => setEsik(parseInt(e.target.value))} className="w-full" />
              <div className="text-[10px] text-gray-400">Dusuk = daha hassas (hafif renk farklarini da baski sayar) · Yuksek = daha toleransli</div>
            </div>
            <button className="btn btn-primary w-full" disabled={!imgEl || !refRenk} onClick={hesapla}>
              Hesapla
            </button>
          </div>

          {sonucYuzde !== null && (
            <div className="card card-body bg-green-50 border border-green-100">
              <div className="text-xs text-green-700 mb-1">Tahmini baski alani</div>
              <div className="text-3xl font-semibold text-green-800">%{sonucYuzde.toFixed(1)}</div>
              <div className="text-[10px] text-green-700 mt-2">{analizEdilenPiksel.toLocaleString('tr-TR')} piksel analiz edildi. Kirmizi alanlar "baskili" olarak isaretlenen bolgelerdir — goze uygun gorunmuyorsa esigi ayarlayip tekrar hesapla.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
