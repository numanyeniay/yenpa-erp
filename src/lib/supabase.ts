import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(url, key)

// Otomatik numara üretimi
export async function yeniProjeNo(): Promise<string> {
  const { data } = await supabase.rpc('nextval', { sequence_name: 'proje_no_seq' }).single()
  const no = data || Math.floor(Math.random() * 9000) + 1000
  return `YEN-${new Date().getFullYear()}-${String(no).padStart(4,'0')}`
}

export async function yeniProformaNo(): Promise<string> {
  const { data } = await supabase.rpc('nextval', { sequence_name: 'proforma_no_seq' }).single()
  const no = data || Math.floor(Math.random() * 9000) + 1000
  return `PRF-${new Date().getFullYear()}-${String(no).padStart(4,'0')}`
}

export async function yeniPoNo(): Promise<string> {
  const no = Math.floor(Math.random() * 9000) + 1000
  return `PO-${new Date().getFullYear()}-${String(no).padStart(4,'0')}`
}

export async function yeniSevkNo(): Promise<string> {
  const no = Math.floor(Math.random() * 9000) + 1000
  return `SV-${new Date().getFullYear()}-${String(no).padStart(4,'0')}`
}

// Fiyatlama hesaplama motoru
export interface FiyatGirdisi {
  katmanlar: { malzeme_id: string; mikron: number; yogunluk: number; birim_fiyat: number }[]
  baskili: boolean
  renk_sayisi: number
  laminasyon_sayisi: number
  siparis_kg: number
  boya_fiyat_kg: number       // USD/kg
  tutkal_fiyat_kg: number     // USD/kg
  iscilik_kg: number          // USD/kg
  fire_pct: number            // %
  kar_pct: number             // %
  fason_maliyet?: number      // USD sabit
  makine_hazirlik_kg?: number // başlangıç fire kg (miktar bağımlı)
}

export interface FiyatCiktisi {
  m2: number
  film_maliyet: number
  boya_kullanilan_kg: number
  boya_maliyet: number
  tutkal_kullanilan_kg: number
  tutkal_maliyet: number
  iscilik_maliyet: number
  fason_maliyet: number
  toplam_ham: number
  fire_tutar: number
  toplam_fire_dahil: number
  satis_fiyati: number
  satis_fiyati_kg: number
  satis_fiyati_m2: number
  kar_tutar: number
}

export function fiyatHesapla(g: FiyatGirdisi): FiyatCiktisi {
  // Toplam gramaj (g/m²) — tüm katmanlar
  const toplamGm2 = g.katmanlar.reduce((s, k) => s + (k.mikron * k.yogunluk), 0)

  // Boya ve tutkal katkısı (filmde kalan)
  const boyaKalanGm2 = g.baskili ? 2.2 : 0
  const tutkalGm2 = g.laminasyon_sayisi * 2.0

  // Mamul yoğunluğu (kg/m²)
  const mamulKgM2 = (toplamGm2 / 1000) + (boyaKalanGm2 / 1000) + (tutkalGm2 / 1000)

  // m² hesabı
  const m2 = mamulKgM2 > 0 ? g.siparis_kg / mamulKgM2 : 0

  // Film maliyeti
  const filmMaliyet = g.katmanlar.reduce((s, k) => {
    const kgM2 = (k.mikron * k.yogunluk) / 1000
    return s + (m2 * kgM2 * k.birim_fiyat)
  }, 0)

  // Boya maliyeti (6.6 g/m² kullanılır)
  const boyaKullanilanKg = g.baskili ? m2 * 6.6 / 1000 : 0
  const boyaMaliyet = boyaKullanilanKg * g.boya_fiyat_kg

  // Tutkal maliyeti
  const tutkalKullanilanKg = m2 * (g.laminasyon_sayisi * 2.0) / 1000
  const tutkalMaliyet = tutkalKullanilanKg * g.tutkal_fiyat_kg

  // İşçilik
  const iscilikMaliyet = g.siparis_kg * g.iscilik_kg

  // Fason
  const fasonMaliyet = g.fason_maliyet || 0

  // Makine hazırlık (başlangıç fire)
  const makineHazirlik = g.makine_hazirlik_kg
    ? g.makine_hazirlik_kg * (filmMaliyet / g.siparis_kg)
    : 0

  const toplamHam = filmMaliyet + boyaMaliyet + tutkalMaliyet + iscilikMaliyet + fasonMaliyet + makineHazirlik

  // Fire
  const fireTutar = toplamHam * (g.fire_pct / 100)
  const toplamFireDahil = toplamHam + fireTutar

  // Satış fiyatı
  const satisFiyati = toplamFireDahil / (1 - g.kar_pct / 100)
  const satisFiyatiKg = g.siparis_kg > 0 ? satisFiyati / g.siparis_kg : 0
  const satisFiyatiM2 = m2 > 0 ? satisFiyati / m2 : 0

  return {
    m2: Math.round(m2),
    film_maliyet: filmMaliyet,
    boya_kullanilan_kg: boyaKullanilanKg,
    boya_maliyet: boyaMaliyet,
    tutkal_kullanilan_kg: tutkalKullanilanKg,
    tutkal_maliyet: tutkalMaliyet,
    iscilik_maliyet: iscilikMaliyet,
    fason_maliyet: fasonMaliyet,
    toplam_ham: toplamHam,
    fire_tutar: fireTutar,
    toplam_fire_dahil: toplamFireDahil,
    satis_fiyati: satisFiyati,
    satis_fiyati_kg: satisFiyatiKg,
    satis_fiyati_m2: satisFiyatiM2,
    kar_tutar: satisFiyati - toplamFireDahil,
  }
}
