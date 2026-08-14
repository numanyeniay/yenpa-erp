// ============================================================
// YENPA AMBALAJ - FIYATLAMA MOTORU v2
// Excel referans: YENPA_EN_YENI_MALIYET.xlsx
// ============================================================

// Kazan çapları (mm)
export const KAZAN_CAPLARI = [350,380,400,420,450,480,500,520,550,560,580,600,620,640,660]

// Fotosel hesabı: kazan çevresi = π × cap (cm)
export function fotoselHesapla(cap_mm: number): number {
  return Math.round(Math.PI * (cap_mm / 10) * 10) / 10 // cm cinsinden
}

// En yakın kazan çapını bul
export function enYakinKazanBul(fotosEl_cm: number): number {
  const hedef_mm = (fotosEl_cm / Math.PI) * 10
  return KAZAN_CAPLARI.reduce((prev, curr) =>
    Math.abs(curr - hedef_mm) < Math.abs(prev - hedef_mm) ? curr : prev
  )
}

// Malzeme yoğunlukları (g/cm³)
export const YOGUNLUK: Record<string, number> = {
  PET: 1.41, OPP: 0.92, BOPP: 0.92, CPP: 0.92,
  LDPE: 0.92, MDPE: 0.935, HDPE: 0.95,
  ALU: 2.70, MOPP: 0.92, MPET: 1.41,
  MATOPP: 0.87, SEDEF_OPP: 0.94, OPAK_OPP: 0.94,
  PA: 1.14, KAGIT: 0.80,
}

// ============================================================
// ANA FİYATLAMA MOTORU
// ============================================================

export interface KatmanGirdisi {
  malzeme_adi: string
  malzeme_tur: string
  mikron: number
  yogunluk: number   // g/cm³
  birim_fiyat: number // USD/kg
  baskili: boolean
}

export interface FiyatGirdisi {
  // Ürün yapısı
  katmanlar: KatmanGirdisi[]
  laminasyon_sayisi: number   // kaç kez lamine edildi
  // Sipariş
  siparis_kg: number
  bobin_en_mm: number         // ham bobin eni (kato eni)
  // Ebatlar (kenar fire için)
  kullanilabilir_en_mm: number // dilimleme sonrası net en
  kenar_tirasi_mm: number      // her taraftan tıraş (laminasyonlu işlerde 10mm)
  // Fiyat parametreleri
  boya_fiyat_kg: number       // USD/kg, default 4.50
  tutkal_fiyat_kg: number     // USD/kg, default 4.50
  iscilik_kg: number          // USD/kg, default 0.50
  // Fire
  baslangic_fire_kg: number   // makine ayar firesi (25-100 kg)
  // Kâr
  kar_pct: number             // % satış üzerinden, default 25
  // Fason
  fason_birim_fiyat_kg: number // 0 ise fason yok
}

export interface KatmanDetay {
  malzeme_adi: string
  mikron: number
  kg_m2: number       // 1 m² başına kg
  toplam_kg: number
  birim_fiyat: number
  tutar: number
}

export interface FiyatCiktisi {
  // m² ve metre
  net_m2: number          // kenar traşı sonrası net m²
  ham_m2: number          // traş öncesi toplam m²
  metre: number           // net metre
  // Katman detayları
  katmanlar: KatmanDetay[]
  // Film
  film_kg: number
  film_tutar: number
  // Boya
  boya_kullanilan_kg: number  // 6.6 g/m²
  boya_kalan_kg: number       // 2.2 g/m² (filmde)
  boya_tutar: number
  // Tutkal
  tutkal_kg: number           // 2.0 g/m² × laminasyon sayısı
  tutkal_tutar: number
  // İşçilik
  mamul_kg: number            // film + boya kalan + tutkal
  iscilik_tutar: number
  // Fason
  fason_tutar: number
  // Toplam
  uretim_maliyeti: number     // film+boya+tutkal+işçilik+fason
  // Başlangıç fire
  baslangic_fire_tutar: number
  // Kenar traş fire
  kenar_fire_pct: number
  kenar_fire_tutar: number
  // Toplam maliyet
  toplam_maliyet: number
  maliyet_kg: number
  // Satış
  satis_fiyati_toplam: number
  satis_fiyati_kg: number
  satis_fiyati_m2: number
  satis_fiyati_metre: number
  kar_tutar: number
  kar_pct: number
}

// Sabitler
const BOYA_KULLANILAN_GM2 = 6.6
const BOYA_KALAN_GM2 = 2.2
const TUTKAL_GM2_LAMINASYON = 2.0

export function hesaplaFiyat(g: FiyatGirdisi): FiyatCiktisi {
  const baskili = g.katmanlar.some(k => k.baskili)

  // 1. Ham m² (kenar traşı öncesi)
  const ham_m2 = g.bobin_en_mm > 0
    ? g.siparis_kg / mamulKgM2(g.katmanlar, baskili, g.laminasyon_sayisi)
    : 0

  // 2. Kenar fire oranı
  const kenar_fire_pct = g.bobin_en_mm > 0
    ? ((g.bobin_en_mm - g.kullanilabilir_en_mm) / g.bobin_en_mm) * 100
    : 0

  // 3. Net m² (müşteriye giden)
  const net_m2 = ham_m2 * (1 - kenar_fire_pct / 100)

  // 4. Metre
  const metre = g.kullanilabilir_en_mm > 0 ? net_m2 / (g.kullanilabilir_en_mm / 1000) : 0

  // 5. Katman maliyetleri (ham m² üzerinden)
  const katmanDetaylar: KatmanDetay[] = g.katmanlar.map(k => {
    const kg_m2 = (k.mikron * k.yogunluk) / 1000
    const toplam_kg = ham_m2 * kg_m2
    const tutar = toplam_kg * k.birim_fiyat
    return { malzeme_adi: k.malzeme_adi, mikron: k.mikron, kg_m2, toplam_kg, birim_fiyat: k.birim_fiyat, tutar }
  })

  const film_kg = katmanDetaylar.reduce((s, k) => s + k.toplam_kg, 0)
  const film_tutar = katmanDetaylar.reduce((s, k) => s + k.tutar, 0)

  // 6. Boya (ham m² üzerinden)
  const boya_kullanilan_kg = baskili ? ham_m2 * BOYA_KULLANILAN_GM2 / 1000 : 0
  const boya_kalan_kg = baskili ? ham_m2 * BOYA_KALAN_GM2 / 1000 : 0
  const boya_tutar = boya_kullanilan_kg * g.boya_fiyat_kg

  // 7. Tutkal (ham m² × laminasyon sayısı × 2 g/m²)
  const tutkal_kg = ham_m2 * g.laminasyon_sayisi * TUTKAL_GM2_LAMINASYON / 1000
  const tutkal_tutar = tutkal_kg * g.tutkal_fiyat_kg

  // 8. Mamul kg ve işçilik
  const mamul_kg = film_kg + boya_kalan_kg + tutkal_kg
  const iscilik_tutar = mamul_kg * g.iscilik_kg

  // 9. Fason
  const fason_tutar = g.fason_birim_fiyat_kg > 0 ? mamul_kg * g.fason_birim_fiyat_kg : 0

  // 10. Üretim maliyeti
  const uretim_maliyeti = film_tutar + boya_tutar + tutkal_tutar + iscilik_tutar + fason_tutar

  // 11. Başlangıç fire maliyeti
  const birim_maliyet_kg = mamul_kg > 0 ? uretim_maliyeti / mamul_kg : 0
  const baslangic_fire_tutar = g.baslangic_fire_kg * birim_maliyet_kg

  // 12. Kenar fire maliyeti
  const kenar_fire_tutar = uretim_maliyeti * (kenar_fire_pct / 100)

  // 13. Toplam maliyet
  const toplam_maliyet = uretim_maliyeti + baslangic_fire_tutar + kenar_fire_tutar

  // 14. Satış fiyatı (kar satış üzerinden)
  const satis_fiyati_toplam = toplam_maliyet / (1 - g.kar_pct / 100)
  const satis_fiyati_kg = g.siparis_kg > 0 ? satis_fiyati_toplam / g.siparis_kg : 0
  const satis_fiyati_m2 = net_m2 > 0 ? satis_fiyati_toplam / net_m2 : 0
  const satis_fiyati_metre = metre > 0 ? satis_fiyati_toplam / metre : 0
  const kar_tutar = satis_fiyati_toplam - toplam_maliyet

  return {
    net_m2: Math.round(net_m2),
    ham_m2: Math.round(ham_m2),
    metre: Math.round(metre),
    katmanlar: katmanDetaylar,
    film_kg, film_tutar,
    boya_kullanilan_kg, boya_kalan_kg, boya_tutar,
    tutkal_kg, tutkal_tutar,
    mamul_kg, iscilik_tutar,
    fason_tutar,
    uretim_maliyeti,
    baslangic_fire_tutar,
    kenar_fire_pct,
    kenar_fire_tutar,
    toplam_maliyet,
    maliyet_kg: g.siparis_kg > 0 ? toplam_maliyet / g.siparis_kg : 0,
    satis_fiyati_toplam,
    satis_fiyati_kg,
    satis_fiyati_m2,
    satis_fiyati_metre,
    kar_tutar,
    kar_pct: g.kar_pct,
  }
}

// Mamul kg/m² hesabı
function mamulKgM2(katmanlar: KatmanGirdisi[], baskili: boolean, laminasyon: number): number {
  const film = katmanlar.reduce((s, k) => s + (k.mikron * k.yogunluk) / 1000, 0)
  const boya = baskili ? BOYA_KALAN_GM2 / 1000 : 0
  const tutkal = laminasyon * TUTKAL_GM2_LAMINASYON / 1000
  return film + boya + tutkal
}

// ============================================================
// FASON FİYAT HESABI
// ============================================================

export interface FasonFiyatKademe {
  tur: string
  min_gram: number
  max_gram: number | null
  birim_fiyat_kg: number
}

export function fasonFiyatBul(
  tur: string,
  adet_gram: number,
  fiyatlar: FasonFiyatKademe[]
): number {
  const kademe = fiyatlar.find(f =>
    f.tur === tur &&
    adet_gram >= f.min_gram &&
    (f.max_gram === null || adet_gram < f.max_gram)
  )
  return kademe?.birim_fiyat_kg || 0
}

// ============================================================
// ADET AĞIRLIĞI HESABI
// ============================================================

export function adetAgirligiHesapla(params: {
  cikti_turu: string
  en_mm: number
  boy_mm: number
  kurek_mm: number
  mamul_kg_m2: number  // toplam mamul yoğunluğu kg/m²
  zip_var: boolean
  zip_gram_metre?: number  // default 5.5 g/m
}): number {
  const en_cm = params.en_mm / 10
  const boy_cm = params.boy_mm / 10
  const kurek_cm = (params.kurek_mm || 0) / 10
  const zip_gm = params.zip_gram_metre ?? 5.5

  let alan_cm2 = 0
  const ct = params.cikti_turu

  if (ct === 'doypack') {
    // Kato eni = boy*2 + körük, ürün eni = en + körük
    // Alan = (boy*2 + körük) × (en + körük)
    alan_cm2 = (boy_cm * 2 + kurek_cm) * (en_cm + kurek_cm)
  } else if (ct === 'quadro') {
    // (en×2 + körük×2) × boy
    alan_cm2 = ((en_cm * 2) + (kurek_cm * 2)) * boy_cm
  } else if (ct === 'flat_bottom') {
    alan_cm2 = (boy_cm * 2 + kurek_cm) * (en_cm + kurek_cm)
  } else {
    // Sırt kaynak, yan kesim
    alan_cm2 = en_cm * boy_cm * 2
  }

  const alan_m2 = alan_cm2 / 10000
  let agirlik_g = alan_m2 * params.mamul_kg_m2 * 1000

  // Zip ağırlığı ekle
  if (params.zip_var) {
    const zip_uzunluk_m = params.en_mm / 1000
    agirlik_g += zip_uzunluk_m * zip_gm
  }

  return agirlik_g  // gram cinsinden
}
