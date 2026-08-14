-- ============================================================
-- YENPA AMBALAJ ERP v2 — Sıfırdan Migration
-- Önce eski tabloları temizle, sonra yenilerini oluştur
-- ============================================================

-- Eski tabloları temizle (varsa)
drop table if exists irsaliye cascade;
drop table if exists maliyet_hesabi cascade;
drop table if exists satin_alma_talebi cascade;
drop table if exists durus_kaydi cascade;
drop table if exists uretim_kaydi cascade;
drop table if exists is_emri_katman cascade;
drop table if exists is_emri cascade;
drop table if exists stok_hareket cascade;
drop table if exists stok cascade;
drop table if exists hammadde_giris cascade;
drop table if exists makine cascade;
drop table if exists musteri cascade;
drop table if exists tedarikci cascade;
drop table if exists malzeme cascade;
drop table if exists kullanici cascade;

-- Yeni tablolar
drop table if exists sevkiyat cascade;
drop table if exists uretim_adim cascade;
drop table if exists uretim_plani cascade;
drop table if exists proje_fiyat cascade;
drop table if exists proje_katman cascade;
drop table if exists proje cascade;
drop table if exists depo_hareket cascade;
drop table if exists depo_stok cascade;
drop table if exists satinalma_kalem cascade;
drop table if exists satinalma_siparis cascade;
drop table if exists makine_tanim cascade;
drop table if exists malzeme_tanim cascade;
drop table if exists tedarikci_tanim cascade;
drop table if exists musteri_tanim cascade;
drop table if exists kullanici_tanim cascade;

create extension if not exists "pgcrypto";

-- ============================================================
-- 1. KULLANICI
-- ============================================================
create table kullanici_tanim (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid unique,
  ad_soyad text not null,
  email text unique not null,
  rol text not null check (rol in ('admin','satis','planlama','depo','uretim','muhasebe')),
  aktif boolean default true,
  olusturma timestamptz default now()
);

-- ============================================================
-- 2. MÜŞTERİ
-- ============================================================
create table musteri_tanim (
  id uuid primary key default gen_random_uuid(),
  kod text unique not null,
  ad text not null,
  iletisim_ad text,
  telefon text,
  email text,
  adres text,
  sehir text,
  ulke text default 'Türkiye',
  para_birimi text default 'USD' check (para_birimi in ('USD','EUR')),
  vade_gun integer default 30,
  kredi_limiti numeric(14,2) default 0,
  notlar text,
  aktif boolean default true,
  olusturma timestamptz default now()
);

-- ============================================================
-- 3. TEDARİKÇİ
-- ============================================================
create table tedarikci_tanim (
  id uuid primary key default gen_random_uuid(),
  kod text unique not null,
  ad text not null,
  iletisim_ad text,
  telefon text,
  email text,
  ulke text default 'Türkiye',
  para_birimi text default 'USD',
  odeme_vadesi_gun integer default 30,
  aktif boolean default true,
  olusturma timestamptz default now()
);

-- ============================================================
-- 4. MALZEME (Ham madde tanımları)
-- ============================================================
create table malzeme_tanim (
  id uuid primary key default gen_random_uuid(),
  kod text unique not null,
  ad text not null,
  tur text not null check (tur in (
    'OPP','BOPP','PET','CPP','LDPE','MDPE','HDPE',
    'ALU','MOPP','MPET','MATOPP','KAGIT',
    'SEDEF_OPP','OPAK_OPP','PA','ZIP','SONIC_SERIT',
    'BOYA','TUTKAL','SOLVENT','DIGER'
  )),
  yogunluk numeric(6,3),        -- g/cm³
  min_mikron integer,           -- mikron alt limit
  max_mikron integer,           -- mikron üst limit
  min_stok_kg numeric(12,3),    -- kritik stok eşiği (dashboard uyarısı için)
  birim text default 'kg' check (birim in ('kg','m2','adet','litre')),
  notlar text,
  aktif boolean default true,
  olusturma timestamptz default now()
);

-- ============================================================
-- 5. MALZEMEYİ SATTIĞI FİYAT (tedarikçi × malzeme)
-- ============================================================
create table malzeme_fiyat (
  id uuid primary key default gen_random_uuid(),
  malzeme_id uuid references malzeme_tanim(id),
  tedarikci_id uuid references tedarikci_tanim(id),
  mikron integer,               -- 0 = mikrondan bağımsız (boya, tutkal)
  birim_fiyat numeric(12,4) not null,
  para_birimi text default 'USD',
  gecerlilik_tarihi date default current_date,
  notlar text,
  olusturma timestamptz default now()
);

-- ============================================================
-- 6. DEPO STOK
-- ============================================================
create table depo_stok (
  id uuid primary key default gen_random_uuid(),
  malzeme_id uuid references malzeme_tanim(id),
  tedarikci_id uuid references tedarikci_tanim(id),
  lot_no text not null,
  mikron integer,
  en_mm integer,
  agirlik_kg numeric(12,3) default 0,
  m2 numeric(14,2) default 0,
  birim_fiyat numeric(12,4),
  para_birimi text default 'USD',
  depo_raf text,
  irsaliye_no text,
  giris_tarihi timestamptz default now(),
  son_hareket timestamptz default now()
);

-- ============================================================
-- 7. DEPO HAREKET
-- ============================================================
create table depo_hareket (
  id uuid primary key default gen_random_uuid(),
  stok_id uuid references depo_stok(id),
  proje_id uuid,                -- proje bağlantısı (sonradan FK eklenecek)
  tur text not null check (tur in ('giris','cikis','fire','rezerve','serbest')),
  miktar_kg numeric(12,3),
  aciklama text,
  kullanici_id uuid references kullanici_tanim(id),
  tarih timestamptz default now()
);

-- ============================================================
-- 8. SATIN ALMA SİPARİŞİ
-- ============================================================
create table satinalma_siparis (
  id uuid primary key default gen_random_uuid(),
  po_no text unique not null,
  tedarikci_id uuid references tedarikci_tanim(id),
  durum text default 'taslak' check (durum in ('taslak','onaylandi','gonderildi','kismi_teslim','teslim_alindi','iptal')),
  para_birimi text default 'USD',
  toplam_tutar numeric(14,2),
  ihtiyac_tarihi date,
  notlar text,
  kullanici_id uuid references kullanici_tanim(id),
  olusturma timestamptz default now()
);

create table satinalma_kalem (
  id uuid primary key default gen_random_uuid(),
  siparis_id uuid references satinalma_siparis(id) on delete cascade,
  malzeme_id uuid references malzeme_tanim(id),
  proje_id uuid,
  mikron integer,
  en_mm integer,
  miktar_kg numeric(12,3),
  birim_fiyat numeric(12,4),
  para_birimi text default 'USD',
  teslim_edilen_kg numeric(12,3) default 0,
  durum text default 'bekliyor' check (durum in ('bekliyor','kismi','tamamlandi'))
);

-- ============================================================
-- 9. MAKİNE TANIM
-- ============================================================
create table makine_tanim (
  id uuid primary key default gen_random_uuid(),
  kod text unique not null,
  ad text not null,
  tur text not null check (tur in (
    'baski','laminasyon','dilimleme','katlama',
    'yan_kesim','doypack','quadro','flat_bottom',
    'sirt_kaynak','sonic','diger'
  )),
  marka text,
  max_en_mm integer,
  hedef_hiz_m_dk numeric(8,2),
  fason boolean default false,   -- dışarıya gönderilen fason iş
  fason_firma text,
  aktif boolean default true,
  notlar text
);

-- ============================================================
-- 9b. FASON FİYAT (doypack/quadro/flat_bottom/sırt kaynak için
--     kademeli fason kesim fiyatları — uygulama kodu bu tabloyu
--     zaten sorguluyordu ama tablo hiç tanımlanmamıştı)
-- ============================================================
create table fason_fiyat (
  id uuid primary key default gen_random_uuid(),
  tur text not null check (tur in ('doypack','quadro','flat_bottom','sirt_kaynak')),
  min_gram numeric(10,2) not null,
  max_gram numeric(10,2),          -- null = ust sinir yok
  birim_fiyat_kg numeric(12,4) not null,
  para_birimi text default 'USD',
  aktif boolean default true,
  notlar text,
  olusturma timestamptz default now()
);

-- ============================================================
-- 10. PROJE (Her müşteri işi bir proje)
-- ============================================================
create table proje (
  id uuid primary key default gen_random_uuid(),
  proje_no text unique not null,  -- YEN-2026-0001
  musteri_id uuid references musteri_tanim(id),
  kullanici_id uuid references kullanici_tanim(id),  -- satışçı
  ad text not null,               -- müşteri ürün adı (Silka Okul Seti)
  aciklama text,
  -- Ürün özellikleri
  cikti_turu text not null check (cikti_turu in (
    'bobin','doypack','quadro','flat_bottom',
    'sirt_kaynak','yan_kesim','katlama_torba','diger'
  )),
  -- Ebat bilgileri
  en_mm numeric(8,2),             -- torba eni
  boy_mm numeric(8,2),            -- torba boyu
  kurek_mm numeric(8,2),          -- körük (her iki taraf toplamı)
  kapak_mm numeric(8,2),          -- kapak payı
  -- Bobin bilgileri (bobin çıktısı için)
  bobin_en_mm numeric(8,2),       -- istenen bobin eni
  bobin_cap_mm numeric(8,2),      -- istenen bobin çapı
  bobin_metre numeric(8,2),       -- istenen bobin metre
  -- Baskı bilgileri
  baskili boolean default false,
  baskili_yuz text check (baskili_yuz in ('ust','alt')),  -- üst/alt baskı
  renk_sayisi integer,
  kato_eni_mm numeric(8,2),       -- baskı kato eni (ham bobin eni)
  yan_yana_baski integer default 1, -- yan yana kaç baskı
  -- Özel işlemler
  zip_var boolean default false,
  sonic_var boolean default false,
  mexika_deligi boolean default false,
  kargo_bandi boolean default false,
  kenar_tirasi_mm numeric(6,2),   -- her taraftan kenar tıraşı
  -- Durum
  durum text default 'taslak' check (durum in (
    'taslak','fiyatlama','proforma_gonderildi',
    'musteri_onayladi','uretimde','tamamlandi','iptal'
  )),
  -- Tasarım
  tasarim_dosya_url text,
  notlar text,
  olusturma timestamptz default now(),
  guncelleme timestamptz default now()
);

-- ============================================================
-- 11. PROJE KATMAN (Film yapısı — dinamik)
-- ============================================================
create table proje_katman (
  id uuid primary key default gen_random_uuid(),
  proje_id uuid references proje(id) on delete cascade,
  sira integer not null,          -- 1=dış, 2=orta, 3=iç...
  malzeme_id uuid references malzeme_tanim(id),
  mikron integer not null,
  baskili boolean default false,  -- bu katmana baskı var mı
  laminasyon_onceki boolean default false, -- önceki katmanla lamine mi
  notlar text
);

-- ============================================================
-- 12. PROJE FİYATLAMA
-- ============================================================
create table proje_fiyat (
  id uuid primary key default gen_random_uuid(),
  proje_id uuid references proje(id) on delete cascade,
  miktar_kg numeric(12,2) not null,  -- 500, 1000, 3000 kg
  -- Malzeme maliyetleri
  film_maliyet numeric(12,4),
  boya_maliyet numeric(12,4),
  tutkal_maliyet numeric(12,4),
  -- Makine maliyetleri
  makine_hazirlik_maliyet numeric(12,4),
  fason_maliyet numeric(12,4),
  -- Fire maliyetleri
  fire_orani_pct numeric(6,2) default 3,
  baslangic_fire_kg numeric(10,3),
  -- İşçilik
  iscilik_maliyet numeric(12,4),
  -- Özet
  toplam_maliyet numeric(12,4),
  kar_marji_pct numeric(6,2) default 20,
  satis_fiyati_kg numeric(12,4),    -- USD/kg
  satis_fiyati_m2 numeric(12,4),    -- USD/m²
  para_birimi text default 'USD',
  gecerlilik_tarihi date,
  olusturma timestamptz default now()
);

-- ============================================================
-- 13. PROFORMA
-- ============================================================
create table proforma (
  id uuid primary key default gen_random_uuid(),
  proje_id uuid references proje(id),
  proforma_no text unique not null,
  musteri_id uuid references musteri_tanim(id),
  secilen_miktar_kg numeric(12,2),
  satis_fiyati_kg numeric(12,4),
  para_birimi text default 'USD',
  toplam_tutar numeric(14,2),
  gecerlilik_tarihi date,
  durum text default 'gonderildi' check (durum in (
    'gonderildi','onaylandi','reddedildi','revizyon'
  )),
  musteri_notu text,
  pdf_url text,
  olusturma timestamptz default now()
);

-- ============================================================
-- 14. ÜRETİM PLANI (Planlamacının oluşturduğu plan)
-- ============================================================
create table uretim_plani (
  id uuid primary key default gen_random_uuid(),
  plan_no text unique not null,
  proje_id uuid references proje(id),
  makine_id uuid references makine_tanim(id),
  adim_sira integer not null,     -- kaçıncı üretim adımı
  adim_tur text not null check (adim_tur in (
    'baski','laminasyon_1','laminasyon_2','laminasyon_3',
    'kurleme_1','kurleme_2','kurleme_3',
    'dilimleme','katlama','yan_kesim',
    'doypack','quadro','flat_bottom','sirt_kaynak',
    'sonic','diger'
  )),
  -- Planlanan
  planlanan_tarih date,
  planlanan_baslangic time,
  planlanan_sure_dk integer,
  -- Hammadde
  hammadde_kontrol boolean default false,
  hammadde_hazir boolean default false,
  -- Durum
  durum text default 'bekliyor' check (durum in (
    'bekliyor','hazir','calisiyor','durustu','tamamlandi','iptal'
  )),
  notlar text,
  olusturma timestamptz default now()
);

-- ============================================================
-- 15. ÜRETİM ADIM KAYDI (Operatörün tablet'ten girdiği)
-- ============================================================
create table uretim_adim (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references uretim_plani(id),
  proje_id uuid references proje(id),
  makine_id uuid references makine_tanim(id),
  operator_id uuid references kullanici_tanim(id),
  -- Gerçekleşen
  baslangic timestamptz,
  bitis timestamptz,
  sure_dk integer,
  -- Üretim metrikleri
  uretilen_metre numeric(12,2),
  uretilen_kg numeric(12,2),
  hiz_m_dk numeric(8,2),
  -- Hammadde tüketimi
  hammadde_kg numeric(12,3),
  boya_kg numeric(10,3),
  tutkal_kg numeric(10,3),
  solvent_kg numeric(10,3),
  -- Fire
  baslangic_fire_kg numeric(10,3),  -- ayar firesi
  uretim_fire_kg numeric(10,3),     -- üretim firesi
  kenar_fire_kg numeric(10,3),      -- kenar tıraş firesi
  -- Duruş
  durus_dk integer default 0,
  durus_neden text,
  -- Kürleme (laminasyon sonrası)
  kurleme_baslangic timestamptz,
  kurleme_bitis timestamptz,
  -- QR/Barkod
  qr_kod text,
  notlar text,
  olusturma timestamptz default now()
);

-- ============================================================
-- 16. SEVKİYAT
-- ============================================================
create table sevkiyat (
  id uuid primary key default gen_random_uuid(),
  sevk_no text unique not null,
  proje_id uuid references proje(id),
  musteri_id uuid references musteri_tanim(id),
  koli_sayisi integer,
  toplam_kg numeric(12,2),
  toplam_m2 numeric(14,2),
  arac_plaka text,
  nakliyeci text,
  teslimat_adresi text,
  durum text default 'hazirlaniyor' check (durum in (
    'hazirlaniyor','yuklendi','yolda','teslim_edildi','iade'
  )),
  sevk_tarihi date,
  tahmini_teslim date,
  gercek_teslim date,
  musteri_imza boolean default false,
  notlar text,
  kullanici_id uuid references kullanici_tanim(id),
  olusturma timestamptz default now()
);

-- ============================================================
-- FOREIGN KEY — Proje → Depo Hareket
-- ============================================================
alter table depo_hareket
  add constraint fk_dh_proje foreign key (proje_id) references proje(id);

alter table satinalma_kalem
  add constraint fk_sk_proje foreign key (proje_id) references proje(id);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Kullanıcılar (auth_id'ler Supabase Auth'tan gelecek)
insert into kullanici_tanim (ad_soyad, email, rol) values
  ('Admin',           'admin@yenpaambalaj.com',    'admin'),
  ('Satış Temsilcisi','satis@yenpaambalaj.com',    'satis'),
  ('Planlama',        'planlama@yenpaambalaj.com', 'planlama'),
  ('Depo Sorumlusu',  'depo@yenpaambalaj.com',     'depo'),
  ('Üretim Şefi',     'uretim@yenpaambalaj.com',   'uretim'),
  ('Muhasebe',        'muhasebe@yenpaambalaj.com', 'muhasebe')
on conflict do nothing;

-- Makineler
insert into makine_tanim (kod, ad, tur, marka, max_en_mm, hedef_hiz_m_dk, fason) values
  ('M01','Baskı Makinesi','baski','TCE',1300,130,false),
  ('M02','Laminasyon Makinesi','laminasyon','TCE',1300,250,false),
  ('M03','Dilimleme 1','dilimleme',null,1300,200,false),
  ('M04','Dilimleme 2','dilimleme',null,1300,200,false),
  ('M05','Katlama Makinesi','katlama',null,1300,80,false),
  ('M06','Yan Kesim Makinesi','yan_kesim',null,1300,60,false),
  ('F01','Fason Doypack','doypack',null,null,null,true),
  ('F02','Fason Quadro','quadro',null,null,null,true),
  ('F03','Fason Flat Bottom','flat_bottom',null,null,null,true),
  ('F04','Fason Sırt Kaynak','sirt_kaynak',null,null,null,true)
on conflict do nothing;

-- Malzeme tanımları
insert into malzeme_tanim (kod, ad, tur, yogunluk) values
  ('OPP',      'OPP — Biaxially Oriented PP',     'OPP',   0.910),
  ('BOPP',     'BOPP — Biaxially Oriented PP',     'BOPP',  0.910),
  ('PET',      'PET — Polyethylene Terephthalate', 'PET',   1.380),
  ('CPP',      'CPP — Cast Polypropylene',         'CPP',   0.910),
  ('LDPE',     'LDPE — Low Density PE',            'LDPE',  0.920),
  ('MDPE',     'MDPE — Medium Density PE',         'MDPE',  0.935),
  ('ALU',      'Alüminyum Folyo',                  'ALU',   2.700),
  ('MOPP',     'Metalize OPP',                     'MOPP',  0.910),
  ('MPET',     'Metalize PET',                     'MPET',  1.380),
  ('MATOPP',   'Mat OPP',                          'MATOPP',0.910),
  ('SEDEF_OPP','Sedef OPP',                        'SEDEF_OPP',0.910),
  ('OPAK_OPP', 'Opak OPP',                         'OPAK_OPP',0.910),
  ('PA',       'Poliamid / Nylon',                 'PA',    1.140),
  ('KAGIT',    'Kağıt',                            'KAGIT', 0.800),
  ('BOYA',     'Boya / Mürekkep',                  'BOYA',  1.000),
  ('TUTKAL',   'Tutkal + Katalizör',               'TUTKAL',1.000),
  ('SOLVENT',  'Solvent / Thinner',                'SOLVENT',0.870),
  ('ZIP',      'Zip / Fermuar',                    'ZIP',   1.000)
on conflict do nothing;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table kullanici_tanim    enable row level security;
alter table musteri_tanim      enable row level security;
alter table tedarikci_tanim    enable row level security;
alter table malzeme_tanim      enable row level security;
alter table malzeme_fiyat      enable row level security;
alter table depo_stok          enable row level security;
alter table depo_hareket       enable row level security;
alter table satinalma_siparis  enable row level security;
alter table satinalma_kalem    enable row level security;
alter table makine_tanim       enable row level security;
alter table fason_fiyat        enable row level security;
alter table proje              enable row level security;
alter table proje_katman       enable row level security;
alter table proje_fiyat        enable row level security;
alter table proforma           enable row level security;
alter table uretim_plani       enable row level security;
alter table uretim_adim        enable row level security;
alter table sevkiyat           enable row level security;

-- Authenticated users tümüne erişebilir
do $$ declare t text; begin
  foreach t in array array[
    'kullanici_tanim','musteri_tanim','tedarikci_tanim',
    'malzeme_tanim','malzeme_fiyat','depo_stok','depo_hareket',
    'satinalma_siparis','satinalma_kalem','makine_tanim','fason_fiyat',
    'proje','proje_katman','proje_fiyat','proforma',
    'uretim_plani','uretim_adim','sevkiyat'
  ] loop
    execute format('create policy "auth_all" on %I for all to authenticated using (true)', t);
  end loop;
end $$;

-- ============================================================
-- SEQUENCE — Otomatik numara üretimi
-- ============================================================
create sequence if not exists proje_no_seq start 1;
create sequence if not exists proforma_no_seq start 1;
create sequence if not exists po_no_seq start 1;
create sequence if not exists sevk_no_seq start 1;
create sequence if not exists plan_no_seq start 1;

-- Uygulama kodu (lib/supabase.ts) numara üretmek icin
-- supabase.rpc('nextval', { sequence_name: '...' }) cagiriyor;
-- bu fonksiyon olmadan cagri sessizce basarisiz olur.
create or replace function nextval(sequence_name text) returns bigint
language sql security definer as $$
  select nextval(sequence_name::regclass)
$$;
