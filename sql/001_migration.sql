-- ============================================================
-- YENPA AMBALAJ ERP — Supabase Migration
-- Supabase SQL Editor'e kopyalayıp çalıştırın
-- ============================================================

-- UUID extension
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. KULLANICI
-- ============================================================
create table if not exists kullanici (
  id uuid primary key default gen_random_uuid(),
  ad_soyad text not null,
  email text unique not null,
  rol text not null check (rol in ('admin','depo','uretim','muhasebe')),
  aktif boolean default true,
  olusturma timestamptz default now()
);

-- ============================================================
-- 2. MALZEME
-- ============================================================
create table if not exists malzeme (
  id uuid primary key default gen_random_uuid(),
  kod text unique not null,
  ad text not null,
  tur text not null,
  yogunluk numeric(5,3) not null default 1.0,
  min_stok_kg numeric(10,2) default 0,
  birim_fiyat_usd numeric(10,4) default 0,
  guncelleme timestamptz default now()
);

-- ============================================================
-- 3. TEDARİKÇİ
-- ============================================================
create table if not exists tedarikci (
  id uuid primary key default gen_random_uuid(),
  ad text not null,
  iletisim text,
  ulke text default 'Türkiye',
  odeme_vadesi_gun integer default 30,
  aktif boolean default true
);

-- ============================================================
-- 4. MÜŞTERİ
-- ============================================================
create table if not exists musteri (
  id uuid primary key default gen_random_uuid(),
  ad text not null,
  iletisim text,
  sehir text,
  kredi_limiti_usd numeric(12,2) default 0,
  vade_gun integer default 30,
  aktif boolean default true
);

-- ============================================================
-- 5. MAKİNE
-- ============================================================
create table if not exists makine (
  id uuid primary key default gen_random_uuid(),
  kod text unique not null,
  ad text not null,
  tur text not null check (tur in ('baski','laminasyon','dilimleme','kesim')),
  hedef_hiz_m_dk integer,
  en_mm integer default 1300,
  aktif boolean default true
);

-- ============================================================
-- 6. HAMMADDE GİRİŞ
-- ============================================================
create table if not exists hammadde_giris (
  id uuid primary key default gen_random_uuid(),
  malzeme_id uuid references malzeme(id),
  tedarikci_id uuid references tedarikci(id),
  kullanici_id uuid references kullanici(id),
  lot_no text not null,
  mikron integer,
  en_mm integer,
  agirlik_kg numeric(10,2) not null,
  m2 numeric(12,2),
  birim_fiyat_usd numeric(10,4),
  irsaliye_no text,
  depo_raf text,
  giris_tarihi timestamptz default now()
);

-- ============================================================
-- 7. STOK
-- ============================================================
create table if not exists stok (
  id uuid primary key default gen_random_uuid(),
  malzeme_id uuid references malzeme(id),
  lot_no text not null,
  mevcut_kg numeric(10,2) default 0,
  mevcut_m2 numeric(12,2) default 0,
  depo_raf text,
  son_hareket timestamptz default now()
);

-- ============================================================
-- 8. STOK HAREKET
-- ============================================================
create table if not exists stok_hareket (
  id uuid primary key default gen_random_uuid(),
  stok_id uuid references stok(id),
  is_emri_id uuid,
  tur text not null check (tur in ('giris','cikis','fire','rezerve')),
  miktar_kg numeric(10,2),
  aciklama text,
  tarih timestamptz default now()
);

-- ============================================================
-- 9. İŞ EMRİ
-- ============================================================
create table if not exists is_emri (
  id uuid primary key default gen_random_uuid(),
  musteri_id uuid references musteri(id),
  kullanici_id uuid references kullanici(id),
  ie_no text unique not null,
  urun_tanimi text,
  baskili boolean default false,
  lamineli boolean default false,
  cikti_turu text check (cikti_turu in ('bobin','doypack','quadro','flatbottom','sirt','yan')),
  en_mm integer,
  boy_mm integer,
  siparis_kg numeric(10,2),
  hedef_metre numeric(12,2),
  termin date,
  durum text default 'taslak' check (durum in ('taslak','onaylandi','uretimde','tamamlandi','iptal')),
  olusturma timestamptz default now()
);

-- ============================================================
-- 10. İŞ EMRİ KATMAN
-- ============================================================
create table if not exists is_emri_katman (
  id uuid primary key default gen_random_uuid(),
  is_emri_id uuid references is_emri(id) on delete cascade,
  malzeme_id uuid references malzeme(id),
  sira integer not null,
  katman text check (katman in ('dis','ic','film3','film4','film5')),
  mikron integer,
  kg_ihtiyac numeric(10,3),
  kg_fire numeric(10,3)
);

-- ============================================================
-- 11. ÜRETİM KAYDI
-- ============================================================
create table if not exists uretim_kaydi (
  id uuid primary key default gen_random_uuid(),
  is_emri_id uuid references is_emri(id),
  makine_id uuid references makine(id),
  kullanici_id uuid references kullanici(id),
  adim text not null check (adim in ('baski','laminasyon','kurleme','dilimleme','kesim')),
  durum text default 'bekliyor' check (durum in ('bekliyor','calisiyor','durustu','tamamlandi')),
  uretilen_metre numeric(12,2) default 0,
  hiz_m_dk numeric(8,2),
  fire_kg numeric(10,3) default 0,
  boya_kullanilan_kg numeric(10,3),
  tutkal_kullanilan_kg numeric(10,3),
  durus_dk integer default 0,
  baslangic timestamptz,
  bitis timestamptz
);

-- ============================================================
-- 12. DURUŞ KAYDI
-- ============================================================
create table if not exists durus_kaydi (
  id uuid primary key default gen_random_uuid(),
  uretim_kaydi_id uuid references uretim_kaydi(id),
  kullanici_id uuid references kullanici(id),
  neden text,
  sure_dk integer,
  aciklama text,
  tarih timestamptz default now()
);

-- ============================================================
-- 13. SATIN ALMA TALEBİ
-- ============================================================
create table if not exists satin_alma_talebi (
  id uuid primary key default gen_random_uuid(),
  malzeme_id uuid references malzeme(id),
  tedarikci_id uuid references tedarikci(id),
  is_emri_id uuid references is_emri(id),
  kullanici_id uuid references kullanici(id),
  po_no text unique,
  miktar_kg numeric(10,2),
  birim_fiyat_usd numeric(10,4),
  durum text default 'taslak' check (durum in ('taslak','onaylandi','gonderildi','teslim_alindi')),
  ihtiyac_tarihi date,
  olusturma timestamptz default now()
);

-- ============================================================
-- 14. MALİYET HESABI
-- ============================================================
create table if not exists maliyet_hesabi (
  id uuid primary key default gen_random_uuid(),
  is_emri_id uuid references is_emri(id),
  film_maliyet_usd numeric(12,4),
  boya_maliyet_usd numeric(12,4),
  tutkal_maliyet_usd numeric(12,4),
  iscilik_maliyet_usd numeric(12,4),
  toplam_maliyet_usd numeric(12,4),
  fire_orani_pct numeric(5,2) default 3,
  kar_marji_pct numeric(5,2) default 20,
  satis_fiyati_usd_kg numeric(10,4),
  hesaplama_tarihi timestamptz default now()
);

-- ============================================================
-- 15. SEVKİYAT / İRSALİYE
-- ============================================================
create table if not exists irsaliye (
  id uuid primary key default gen_random_uuid(),
  is_emri_id uuid references is_emri(id),
  musteri_id uuid references musteri(id),
  irs_no text unique not null,
  koli_sayisi integer,
  toplam_kg numeric(10,2),
  arac_plaka text,
  nakliyeci text,
  teslimat_adresi text,
  durum text default 'hazirlaniyor' check (durum in ('hazirlaniyor','yolda','teslim_edildi','iade')),
  sevk_tarihi date,
  teslim_tarihi date,
  olusturma timestamptz default now()
);

-- ============================================================
-- SEED DATA — Başlangıç verileri
-- ============================================================

-- Kullanıcılar
insert into kullanici (ad_soyad, email, rol) values
  ('Admin Kullanıcı',   'admin@yenpaambalaj.com',   'admin'),
  ('Depo Sorumlusu',    'depo@yenpaambalaj.com',    'depo'),
  ('Üretim Şefi',       'uretim@yenpaambalaj.com',  'uretim'),
  ('Muhasebe',          'muhasebe@yenpaambalaj.com','muhasebe')
on conflict do nothing;

-- Makineler
insert into makine (kod, ad, tur, hedef_hiz_m_dk, en_mm) values
  ('M01','Baskı Makinesi — TCE Flexo 8 Renk','baski',130,1300),
  ('M02','Laminasyon Makinesi — TCE Solventsiz','laminasyon',250,1300),
  ('M03','Dilimleme / Kesim Hattı','dilimleme',200,1300)
on conflict do nothing;

-- Malzemeler (Referans tablosundan)
insert into malzeme (kod, ad, tur, yogunluk, min_stok_kg, birim_fiyat_usd) values
  ('OPP',      'OPP — Biaxially Oriented Polypropylene',   'film', 0.910, 500,  3.27),
  ('BOPP',     'BOPP — Biaxially Oriented Polypropylene',  'film', 0.910, 300,  3.27),
  ('PET',      'PET — Polyethylene Terephthalate',         'film', 1.380, 400,  3.00),
  ('CPP',      'CPP — Cast Polypropylene',                 'film', 0.910, 300,  2.80),
  ('LDPE',     'LDPE — Low Density Polyethylene',          'film', 0.920, 300,  2.40),
  ('ALU',      'Alüminyum Folyo',                          'film', 2.700, 200,  5.50),
  ('MOPP',     'Metalize OPP',                             'film', 0.910, 250,  3.60),
  ('MPET',     'Metalize PET',                             'film', 1.380, 200,  3.80),
  ('OPAK_OPP', 'Opak OPP',                                 'film', 0.910, 200,  3.45),
  ('PA',       'Poliamid / Nylon',                         'film', 1.140, 150,  4.20),
  ('BOYA',     'Boya / Mürekkep',                          'kimyasal', 1.0, 100, 6.00),
  ('TUTKAL',   'Tutkal + Katalizör (Solventsiz)',          'kimyasal', 1.0, 100, 6.50)
on conflict do nothing;

-- Tedarikçiler
insert into tedarikci (ad, ulke, odeme_vadesi_gun) values
  ('Polinas A.Ş.',      'Türkiye', 30),
  ('Treofan Turkey',    'Türkiye', 45),
  ('Bemis Türkiye',     'Türkiye', 30),
  ('Boya Tedarikçi Ltd.','Türkiye',30),
  ('Solventsiz Kim. A.Ş.','Türkiye',30)
on conflict do nothing;

-- Müşteriler
insert into musteri (ad, sehir, kredi_limiti_usd, vade_gun) values
  ('Ülker Gıda A.Ş.',   'İstanbul', 50000, 30),
  ('Pınar Süt A.Ş.',    'İzmir',    80000, 45),
  ('Selpak Kağıt',      'İstanbul', 20000, 30),
  ('Algida Dondurma',   'Ankara',   40000, 60)
on conflict do nothing;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
alter table kullanici         enable row level security;
alter table malzeme           enable row level security;
alter table tedarikci         enable row level security;
alter table musteri           enable row level security;
alter table makine            enable row level security;
alter table hammadde_giris    enable row level security;
alter table stok              enable row level security;
alter table stok_hareket      enable row level security;
alter table is_emri           enable row level security;
alter table is_emri_katman    enable row level security;
alter table uretim_kaydi      enable row level security;
alter table durus_kaydi       enable row level security;
alter table satin_alma_talebi enable row level security;
alter table maliyet_hesabi    enable row level security;
alter table irsaliye          enable row level security;

-- Authenticated users tüm tablolara erişebilir
create policy "auth_all" on kullanici         for all to authenticated using (true);
create policy "auth_all" on malzeme           for all to authenticated using (true);
create policy "auth_all" on tedarikci         for all to authenticated using (true);
create policy "auth_all" on musteri           for all to authenticated using (true);
create policy "auth_all" on makine            for all to authenticated using (true);
create policy "auth_all" on hammadde_giris    for all to authenticated using (true);
create policy "auth_all" on stok              for all to authenticated using (true);
create policy "auth_all" on stok_hareket      for all to authenticated using (true);
create policy "auth_all" on is_emri           for all to authenticated using (true);
create policy "auth_all" on is_emri_katman    for all to authenticated using (true);
create policy "auth_all" on uretim_kaydi      for all to authenticated using (true);
create policy "auth_all" on durus_kaydi       for all to authenticated using (true);
create policy "auth_all" on satin_alma_talebi for all to authenticated using (true);
create policy "auth_all" on maliyet_hesabi    for all to authenticated using (true);
create policy "auth_all" on irsaliye          for all to authenticated using (true);
