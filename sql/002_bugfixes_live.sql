-- ============================================================
-- YENPA ERP v2 — Canlı veritabanı için bug-fix migration
-- Bu dosya VERİ SİLMEZ, sadece kolon adlarını ve bozuk enum
-- değerlerini düzeltir. Supabase SQL Editor'de tek seferde
-- çalıştırılabilir, idempotent (tekrar çalıştırılsa da güvenli).
-- ============================================================

-- ------------------------------------------------------------
-- 1) proje.yan_yana_baskı (Türkçe noktasız ı, U+0131)
--    -> proje.yan_yana_baski (ASCII i)
--    Uygulama kodu (types/index.ts, projeler/yeni) ASCII adı
--    kullanıyor; kolon adı DB'de farklıysa insert/select bu
--    alanı hiç kaydetmez/okuyamaz.
-- ------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'proje' and column_name = 'yan_yana_baskı'
  ) and not exists (
    select 1 from information_schema.columns
    where table_name = 'proje' and column_name = 'yan_yana_baski'
  ) then
    alter table proje rename column "yan_yana_baskı" to yan_yana_baski;
  end if;
end $$;

-- ------------------------------------------------------------
-- 2) uretim_adim.operatör_id (Türkçe ö, U+00F6)
--    -> uretim_adim.operator_id (ASCII o)
--    Bu alanın TypeScript tarafında hiç karşılığı yoktu, bu
--    yüzden operatör bilgisi hiç kullanılamıyordu.
-- ------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'uretim_adim' and column_name = 'operatör_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_name = 'uretim_adim' and column_name = 'operator_id'
  ) then
    alter table uretim_adim rename column "operatör_id" to operator_id;
  end if;
end $$;

-- ------------------------------------------------------------
-- 3) proje.durum check constraint'inde 'uretimdе' değerinin
--    sonundaki harf Kiril "е" (U+0435), Latin "e" değil.
--    Önce olası bozuk veriyi düzelt, sonra constraint'i
--    doğru (Latin) değerle yeniden oluştur.
-- ------------------------------------------------------------
update proje set durum = 'uretimde' where durum = 'uretimdе'; -- sağdaki Kiril е

alter table proje drop constraint if exists proje_durum_check;
alter table proje add constraint proje_durum_check check (durum in (
  'taslak','fiyatlama','proforma_gonderildi',
  'musteri_onayladi','uretimde','tamamlandi','iptal'
));

-- Not: uygulama kodunda (types/index.ts, projeler/page.tsx,
-- dashboard/page.tsx) aynı Kiril karakter düzeltildi — bu
-- migration ile birlikte deploy edilmeli.

-- ------------------------------------------------------------
-- 4) malzeme_tanim.min_stok_kg — dashboard.tsx bu kolonu zaten
--    sorguluyordu (malzeme_tanim(ad,min_stok_kg)) ama kolon hiç
--    yoktu; bu yüzden "kritik stok" sayacı sessizce hep 0
--    gösteriyordu. Kolonu ekliyoruz.
-- ------------------------------------------------------------
alter table malzeme_tanim add column if not exists min_stok_kg numeric(12,3);

-- ------------------------------------------------------------
-- 5) EN ÖNEMLİSİ: uygulama kodu proje_no/proforma_no/po_no/
--    sevk_no/plan_no üretmek için supabase.rpc('nextval', {...})
--    çağırıyor, ama böyle bir Postgres fonksiyonu HİÇ
--    tanımlanmamış. proje_no_seq / proforma_no_seq gibi
--    sequence'lar tabloda duruyor ama hiçbiri gerçekte
--    kullanılmıyor — kod sessizce Math.random() ile 1000-9999
--    arası rastgele bir numara üretip ona düşüyor. Bu, "unique"
--    kısıtlı proje_no/po_no/sevk_no alanlarında çakışma
--    (duplicate key hatası) riski demek — aynı yıl içinde ~100+
--    kayıtla çakışma ihtimali ciddileşir.
--    Eksik olan RPC fonksiyonunu ekliyoruz; artık gerçek
--    sequence kullanılacak.
-- ------------------------------------------------------------
create or replace function nextval(sequence_name text) returns bigint
language sql security definer as $$
  select nextval(sequence_name::regclass)
$$;

-- ------------------------------------------------------------
-- 6) fason_fiyat tablosu hiç yoktu ama projeler/[id] sayfasi
--    supabase.from('fason_fiyat')... diye sorguluyordu. Bu,
--    doypack/quadro/flat_bottom/sirt_kaynak urunlerinde fason
--    fiyatinin hep "bulunamadi" gorunmesinin sebebi olabilir.
-- ------------------------------------------------------------
create table if not exists fason_fiyat (
  id uuid primary key default gen_random_uuid(),
  tur text not null check (tur in ('doypack','quadro','flat_bottom','sirt_kaynak')),
  min_gram numeric(10,2) not null,
  max_gram numeric(10,2),
  birim_fiyat_kg numeric(12,4) not null,
  para_birimi text default 'USD',
  aktif boolean default true,
  notlar text,
  olusturma timestamptz default now()
);
alter table fason_fiyat enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'fason_fiyat' and policyname = 'auth_all') then
    create policy "auth_all" on fason_fiyat for all to authenticated using (true);
  end if;
end $$;
