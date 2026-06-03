import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Tip tanımları
export type Rol = 'admin' | 'depo' | 'uretim' | 'muhasebe'

export interface Malzeme {
  id: string; kod: string; ad: string; tur: string
  yogunluk: number; min_stok_kg: number; birim_fiyat_usd: number
}
export interface Stok {
  id: string; malzeme_id: string; lot_no: string
  mevcut_kg: number; mevcut_m2: number; depo_raf: string
  son_hareket: string; malzeme?: Malzeme
}
export interface IsEmri {
  id: string; ie_no: string; urun_tanimi: string
  baskili: boolean; lamineli: boolean; cikti_turu: string
  siparis_kg: number; hedef_metre: number; termin: string
  durum: string; musteri?: { ad: string }
}
export interface UretimKaydi {
  id: string; is_emri_id: string; makine_id: string
  adim: string; durum: string; uretilen_metre: number
  hiz_m_dk: number; fire_kg: number; durus_dk: number
  baslangic: string; bitis: string
}
