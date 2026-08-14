-- ============================================================
-- YENPA ERP v2 — Rol bazlı erişim (RBAC / RLS)
-- Şu an: her authenticated kullanıcı her tabloda tam yetkili
-- ("auth_all" policy, using(true)). Bu migration bunu kaldırıp
-- kullanici_tanim.rol alanına göre kısıtlı politikalar kurar.
--
-- ÖNEMLİ: Bu bir VARSAYILAN öneridir, iş akışınıza göre
-- ayarlanmalı. Özellikle "kimin maliyet/kâr marjını görebileceği"
-- ve "satın alma kimin işi" gibi kararlar işletmeye özeldir.
-- Aşağıdaki matrisi uygulamadan önce gözden geçirin.
--
-- Roller: admin, satis, planlama, depo, uretim, muhasebe
-- ============================================================
--
-- *** ÇALIŞTIRMADAN ÖNCE ZORUNLU KONTROL ***
-- Bu politikalar kullanici_tanim.auth_id = auth.uid() eşleşmesine
-- dayanır. Eğer bir kullanıcının auth_id'si boşsa, current_rol()
-- o kullanıcı için NULL döner ve o kullanıcı TÜM yazma
-- işlemlerinden men edilir (uygulama genelinde kilitlenme riski).
-- Önce şunu çalıştırıp herkesin auth_id'sinin dolu olduğunu
-- doğrulayın:
--
--   select ad_soyad, email, rol, auth_id from kullanici_tanim;
--
-- auth_id boş olan satır varsa, o kullanıcı Supabase Auth'ta
-- giriş yapmış olsa bile (auth.users tablosunda mevcutsa) şu
-- şekilde eşleştirin:
--
--   update kullanici_tanim k set auth_id = u.id
--   from auth.users u where u.email = k.email and k.auth_id is null;
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- Yardımcı fonksiyon: giriş yapan kullanıcının rolü
-- ------------------------------------------------------------
create or replace function current_rol() returns text
language sql security definer stable as $$
  select rol from kullanici_tanim where auth_id = auth.uid()
$$;

-- ------------------------------------------------------------
-- Mevcut genel "herkese açık" politikaları kaldır
-- ------------------------------------------------------------
do $$ declare t text; begin
  foreach t in array array[
    'kullanici_tanim','musteri_tanim','tedarikci_tanim',
    'malzeme_tanim','malzeme_fiyat','depo_stok','depo_hareket',
    'satinalma_siparis','satinalma_kalem','makine_tanim','fason_fiyat',
    'proje','proje_katman','proje_fiyat','proforma',
    'uretim_plani','uretim_adim','sevkiyat'
  ] loop
    execute format('drop policy if exists "auth_all" on %I', t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- KULLANICI_TANIM — herkes okuyabilir (isim göstermek için),
-- sadece admin yazabilir
-- ------------------------------------------------------------
create policy "kt_select" on kullanici_tanim for select to authenticated using (true);
create policy "kt_write"  on kullanici_tanim for all    to authenticated using (current_rol() = 'admin') with check (current_rol() = 'admin');

-- ------------------------------------------------------------
-- MÜŞTERİ / TEDARİKÇİ — satış+admin+muhasebe+depo yazabilir, herkes okur
-- ------------------------------------------------------------
create policy "mus_select" on musteri_tanim for select to authenticated using (true);
create policy "mus_write"  on musteri_tanim for all    to authenticated using (current_rol() in ('admin','satis','muhasebe')) with check (current_rol() in ('admin','satis','muhasebe'));

create policy "ted_select" on tedarikci_tanim for select to authenticated using (true);
create policy "ted_write"  on tedarikci_tanim for all    to authenticated using (current_rol() in ('admin','depo','muhasebe')) with check (current_rol() in ('admin','depo','muhasebe'));

-- ------------------------------------------------------------
-- MALZEME TANIM / FİYAT — planlama+admin+muhasebe yazabilir
-- (malzeme fiyatları maliyet hesaplamasına giriyor, hassas),
-- herkes okuyabilir (fiyatlama motoru için gerekli)
-- ------------------------------------------------------------
create policy "mt_select" on malzeme_tanim for select to authenticated using (true);
create policy "mt_write"  on malzeme_tanim for all    to authenticated using (current_rol() in ('admin','planlama','muhasebe')) with check (current_rol() in ('admin','planlama','muhasebe'));

create policy "mf_select" on malzeme_fiyat for select to authenticated using (true);
create policy "mf_write"  on malzeme_fiyat for all    to authenticated using (current_rol() in ('admin','planlama','muhasebe')) with check (current_rol() in ('admin','planlama','muhasebe'));

create policy "ff_select" on fason_fiyat for select to authenticated using (true);
create policy "ff_write"  on fason_fiyat for all    to authenticated using (current_rol() in ('admin','planlama','muhasebe')) with check (current_rol() in ('admin','planlama','muhasebe'));

-- ------------------------------------------------------------
-- DEPO STOK / HAREKET — depo+admin tam yetki, planlama+uretim okur
-- (üretim planlaması ve operatörler stok görmeli ama değiştirmemeli)
-- ------------------------------------------------------------
create policy "ds_select" on depo_stok for select to authenticated using (current_rol() in ('admin','depo','planlama','uretim','satis'));
create policy "ds_write"  on depo_stok for all    to authenticated using (current_rol() in ('admin','depo')) with check (current_rol() in ('admin','depo'));

create policy "dh_select" on depo_hareket for select to authenticated using (current_rol() in ('admin','depo','planlama','uretim'));
create policy "dh_write"  on depo_hareket for all    to authenticated using (current_rol() in ('admin','depo','uretim')) with check (current_rol() in ('admin','depo','uretim'));

-- ------------------------------------------------------------
-- SATIN ALMA — depo+admin+muhasebe yazar, planlama okur
-- ------------------------------------------------------------
create policy "sas_select" on satinalma_siparis for select to authenticated using (current_rol() in ('admin','depo','muhasebe','planlama'));
create policy "sas_write"  on satinalma_siparis for all    to authenticated using (current_rol() in ('admin','depo','muhasebe')) with check (current_rol() in ('admin','depo','muhasebe'));

create policy "sak_select" on satinalma_kalem for select to authenticated using (current_rol() in ('admin','depo','muhasebe','planlama'));
create policy "sak_write"  on satinalma_kalem for all    to authenticated using (current_rol() in ('admin','depo','muhasebe')) with check (current_rol() in ('admin','depo','muhasebe'));

-- ------------------------------------------------------------
-- MAKİNE TANIM — planlama+admin yazar, herkes okur
-- ------------------------------------------------------------
create policy "mak_select" on makine_tanim for select to authenticated using (true);
create policy "mak_write"  on makine_tanim for all    to authenticated using (current_rol() in ('admin','planlama')) with check (current_rol() in ('admin','planlama'));

-- ------------------------------------------------------------
-- PROJE / PROJE_KATMAN — satış+admin+planlama yazar,
-- depo+üretim+muhasebe sadece okur (üretim için ürün özellikleri
-- görülmeli ama maliyet/fiyat proje_fiyat'ta ayrı, oradan kısıtlı)
-- ------------------------------------------------------------
create policy "prj_select" on proje for select to authenticated using (true);
create policy "prj_write"  on proje for all    to authenticated using (current_rol() in ('admin','satis','planlama')) with check (current_rol() in ('admin','satis','planlama'));

create policy "pk_select" on proje_katman for select to authenticated using (true);
create policy "pk_write"  on proje_katman for all    to authenticated using (current_rol() in ('admin','satis','planlama')) with check (current_rol() in ('admin','satis','planlama'));

-- ------------------------------------------------------------
-- PROJE_FİYAT — HASSAS: maliyet + kâr marjı. Sadece
-- satış+admin+muhasebe görebilir/değiştirebilir. Depo/üretim/
-- planlama bu tabloya hiç erişemez.
-- ------------------------------------------------------------
create policy "pf_all" on proje_fiyat for all to authenticated
  using (current_rol() in ('admin','satis','muhasebe'))
  with check (current_rol() in ('admin','satis','muhasebe'));

-- ------------------------------------------------------------
-- PROFORMA — satış fiyatı müşteriye gidecek belge, maliyet yok.
-- satış+admin yazar, muhasebe+planlama okur.
-- ------------------------------------------------------------
create policy "prf_select" on proforma for select to authenticated using (current_rol() in ('admin','satis','muhasebe','planlama'));
create policy "prf_write"  on proforma for all    to authenticated using (current_rol() in ('admin','satis')) with check (current_rol() in ('admin','satis'));

-- ------------------------------------------------------------
-- ÜRETİM PLANI / ADIM — planlama+üretim+admin yazar,
-- depo+satış okur (satış müşteriye durum bilgisi verebilmeli)
-- ------------------------------------------------------------
create policy "up_select" on uretim_plani for select to authenticated using (true);
create policy "up_write"  on uretim_plani for all    to authenticated using (current_rol() in ('admin','planlama','uretim')) with check (current_rol() in ('admin','planlama','uretim'));

create policy "ua_select" on uretim_adim for select to authenticated using (true);
create policy "ua_write"  on uretim_adim for all    to authenticated using (current_rol() in ('admin','planlama','uretim')) with check (current_rol() in ('admin','planlama','uretim'));

-- ------------------------------------------------------------
-- SEVKİYAT — depo+admin+satış yazar, herkes okur
-- ------------------------------------------------------------
create policy "sv_select" on sevkiyat for select to authenticated using (true);
create policy "sv_write"  on sevkiyat for all    to authenticated using (current_rol() in ('admin','depo','satis')) with check (current_rol() in ('admin','depo','satis'));
