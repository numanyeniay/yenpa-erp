export type Rol = 'admin'|'satis'|'planlama'|'depo'|'uretim'|'muhasebe'

export type CiktiTuru =
  'bobin'|'doypack'|'quadro'|'flat_bottom'|
  'sirt_kaynak'|'yan_kesim'|'katlama_torba'|'diger'

export type AdimTur =
  'baski'|'laminasyon_1'|'laminasyon_2'|'laminasyon_3'|
  'kurleme_1'|'kurleme_2'|'kurleme_3'|
  'dilimleme'|'katlama'|'yan_kesim'|
  'doypack'|'quadro'|'flat_bottom'|'sirt_kaynak'|
  'sonic'|'diger'

export type ProjeDurum =
  'taslak'|'fiyatlama'|'proforma_gonderildi'|
  'musteri_onayladi'|'uretimde'|'tamamlandi'|'iptal'

export type MalzemeTur =
  'OPP'|'BOPP'|'PET'|'CPP'|'LDPE'|'MDPE'|'HDPE'|
  'ALU'|'MOPP'|'MPET'|'MATOPP'|'KAGIT'|
  'SEDEF_OPP'|'OPAK_OPP'|'PA'|'ZIP'|'SONIC_SERIT'|
  'BOYA'|'TUTKAL'|'SOLVENT'|'DIGER'

export interface Kullanici {
  id: string
  auth_id?: string
  ad_soyad: string
  email: string
  rol: Rol
  aktif: boolean
}

export interface Musteri {
  id: string
  kod: string
  ad: string
  iletisim_ad?: string
  telefon?: string
  email?: string
  para_birimi: 'USD'|'EUR'
  vade_gun: number
  aktif: boolean
}

export interface MalzemeTanim {
  id: string
  kod: string
  ad: string
  tur: MalzemeTur
  yogunluk?: number
  min_mikron?: number
  max_mikron?: number
  min_stok_kg?: number
  aktif: boolean
}

export interface MalzemeFiyat {
  id: string
  malzeme_id: string
  tedarikci_id: string
  mikron: number
  birim_fiyat: number
  para_birimi: string
  gecerlilik_tarihi: string
  malzeme?: MalzemeTanim
}

export interface DepoStok {
  id: string
  malzeme_id: string
  lot_no: string
  mikron?: number
  en_mm?: number
  agirlik_kg: number
  m2?: number
  birim_fiyat?: number
  depo_raf?: string
  son_hareket: string
  malzeme?: MalzemeTanim
}

export interface Makine {
  id: string
  kod: string
  ad: string
  tur: string
  marka?: string
  max_en_mm?: number
  hedef_hiz_m_dk?: number
  fason: boolean
  fason_firma?: string
  aktif: boolean
}

export interface ProjeKatman {
  id?: string
  proje_id?: string
  sira: number
  malzeme_id: string
  mikron: number
  baskili: boolean
  laminasyon_onceki: boolean
  notlar?: string
  malzeme?: MalzemeTanim
}

export interface Proje {
  id: string
  proje_no: string
  musteri_id: string
  kullanici_id?: string
  ad: string
  aciklama?: string
  cikti_turu: CiktiTuru
  en_mm?: number
  boy_mm?: number
  kurek_mm?: number
  kapak_mm?: number
  bobin_en_mm?: number
  bobin_cap_mm?: number
  bobin_metre?: number
  baskili: boolean
  baskili_yuz?: 'ust'|'alt'
  renk_sayisi?: number
  kato_eni_mm?: number
  yan_yana_baski?: number
  zip_var: boolean
  sonic_var: boolean
  mexika_deligi: boolean
  kargo_bandi: boolean
  kenar_tirasi_mm?: number
  durum: ProjeDurum
  notlar?: string
  olusturma: string
  musteri?: Musteri
  katmanlar?: ProjeKatman[]
  fiyatlar?: ProjeFiyat[]
}

export interface ProjeFiyat {
  id?: string
  proje_id: string
  miktar_kg: number
  film_maliyet?: number
  boya_maliyet?: number
  tutkal_maliyet?: number
  makine_hazirlik_maliyet?: number
  fason_maliyet?: number
  fire_orani_pct: number
  baslangic_fire_kg?: number
  iscilik_maliyet?: number
  toplam_maliyet?: number
  kar_marji_pct: number
  satis_fiyati_kg?: number
  satis_fiyati_m2?: number
  para_birimi: string
}

export interface UretimPlani {
  id: string
  plan_no: string
  proje_id: string
  makine_id: string
  adim_sira: number
  adim_tur: AdimTur
  planlanan_tarih?: string
  planlanan_baslangic?: string
  planlanan_sure_dk?: number
  hammadde_hazir: boolean
  durum: string
  proje?: Proje
  makine?: Makine
}

export interface UretimAdim {
  id: string
  plan_id: string
  proje_id: string
  makine_id: string
  operator_id?: string
  baslangic?: string
  bitis?: string
  sure_dk?: number
  uretilen_metre?: number
  uretilen_kg?: number
  hiz_m_dk?: number
  hammadde_kg?: number
  boya_kg?: number
  tutkal_kg?: number
  baslangic_fire_kg?: number
  uretim_fire_kg?: number
  kenar_fire_kg?: number
  durus_dk: number
  durus_neden?: string
  qr_kod?: string
}

// Rota hesaplama yardımcısı
export function projeRotasiHesapla(proje: Partial<Proje>, katmanlar: ProjeKatman[]): AdimTur[] {
  const adimlar: AdimTur[] = []
  const laminasyonSayisi = katmanlar.filter(k => k.laminasyon_onceki).length

  // Baskı var mı?
  if (proje.baskili) adimlar.push('baski')

  // Kaç laminasyon?
  if (laminasyonSayisi >= 1) { adimlar.push('laminasyon_1'); adimlar.push('kurleme_1') }
  if (laminasyonSayisi >= 2) { adimlar.push('laminasyon_2'); adimlar.push('kurleme_2') }
  if (laminasyonSayisi >= 3) { adimlar.push('laminasyon_3'); adimlar.push('kurleme_3') }

  // Dilimleme her zaman var (bobin çıktısı için)
  adimlar.push('dilimleme')

  // Çıktı tipine göre ek adımlar
  const cikti = proje.cikti_turu
  if (cikti === 'katlama_torba') { adimlar.push('katlama'); if (proje.sonic_var) adimlar.push('sonic') }
  if (cikti === 'yan_kesim') adimlar.push('yan_kesim')
  if (cikti === 'doypack') adimlar.push('doypack')
  if (cikti === 'quadro') adimlar.push('quadro')
  if (cikti === 'flat_bottom') adimlar.push('flat_bottom')
  if (cikti === 'sirt_kaynak') adimlar.push('sirt_kaynak')

  return adimlar
}

// Sırt kaynak bindirme payı: standart olarak her taraftan 1 cm (toplam 2 cm / 20mm)
export const SIRT_KAYNAK_BINDIRME_MM = 10 // her taraftan; kato eninde 2x eklenir

// Ebat hesaplama
export function katoEniHesapla(proje: Partial<Proje>): number {
  const enMm = proje.en_mm || 0
  const kurekMm = proje.kurek_mm || 0
  const kapakMm = proje.kapak_mm || 0
  const boyMm = proje.boy_mm || 0
  const cikti = proje.cikti_turu

  if (cikti === 'bobin') return proje.bobin_en_mm || enMm
  if (cikti === 'sirt_kaynak') return (enMm * 2) + (SIRT_KAYNAK_BINDIRME_MM * 2)  // en×2 + bindirme (her taraftan 1cm)
  if (cikti === 'doypack' || cikti === 'flat_bottom') return boyMm * 2 + kurekMm  // boy×2 + körük
  if (cikti === 'quadro') return (enMm * 2) + (kurekMm * 2)  // en×2 + körük×2
  if (cikti === 'yan_kesim' || cikti === 'katlama_torba') return (enMm + kurekMm) * (proje.yan_yana_baski || 1)
  return enMm
}
