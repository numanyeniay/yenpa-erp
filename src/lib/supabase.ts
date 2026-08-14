import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

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
  const { data } = await supabase.rpc('nextval', { sequence_name: 'po_no_seq' }).single()
  const no = data || Math.floor(Math.random() * 9000) + 1000
  return `PO-${new Date().getFullYear()}-${String(no).padStart(4,'0')}`
}

export async function yeniSevkNo(): Promise<string> {
  const { data } = await supabase.rpc('nextval', { sequence_name: 'sevk_no_seq' }).single()
  const no = data || Math.floor(Math.random() * 9000) + 1000
  return `SV-${new Date().getFullYear()}-${String(no).padStart(4,'0')}`
}

export async function yeniPlanNo(): Promise<string> {
  const { data } = await supabase.rpc('nextval', { sequence_name: 'plan_no_seq' }).single()
  const no = data || Math.floor(Math.random() * 9000) + 1000
  return `PLN-${new Date().getFullYear()}-${String(no).padStart(4,'0')}`
}

// NOT: Eski/kullanılmayan fiyatHesapla() fonksiyonu buradan kaldırıldı
// (2026-08-14). lib/fiyatlama.ts'deki hesaplaFiyat() tek fiyatlama
// motoru olarak kullanılıyor — iki paralel motor kafa karışıklığı ve
// tutarsız fiyat riski yaratıyordu, hiçbir sayfa eskisini import etmiyordu.
