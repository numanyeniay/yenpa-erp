-- ============================================================
-- YENPA ERP v2 — Bobin bazli uretim ciktisi + hedef/gerceklesen takibi
-- Bu dosya, Supabase MCP uzerinden dogrudan uygulanmis migration'larin
-- kayit altina alinmis halidir (repo icindeki sql/ klasoru guncel
-- semayla senkron kalsin diye).
-- ============================================================

-- ------------------------------------------------------------
-- 1) uretim_cikti_bobin — bobin/rulo bazinda fiziksel izlenebilirlik.
--    Her uretim adiminin (uretim_adim) ciktisi tek bir toplam degil,
--    N adet bobin/rulo olarak kaydedilir. Her bobinin girdisi de
--    (onceki bir uretim ciktisi ya da depodaki bir hammadde lotu)
--    ayri ayri tutulur -> geriye donuk soy agaci sorgulanabilir.
-- ------------------------------------------------------------
create table if not exists uretim_cikti_bobin (
  id uuid primary key default gen_random_uuid(),
  adim_id uuid references uretim_adim(id) on delete cascade,
  bobin_no integer not null,
  uretilen_kg numeric(12,3),
  uretilen_metre numeric(12,2),
  -- Girdi: ya onceki bir uretim ciktisi (soy agaci), ya depodaki bir
  -- hammadde lotu, ya da (listede yoksa) serbest metin lot kodu.
  girdi_bobin_id uuid references uretim_cikti_bobin(id),
  girdi_stok_id uuid references depo_stok(id),
  girdi_lot_no text,
  kalite_verisi jsonb,
  notlar text,
  olusturma timestamptz default now()
);
alter table uretim_cikti_bobin enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'uretim_cikti_bobin' and policyname = 'auth_all') then
    create policy "auth_all" on uretim_cikti_bobin for all to authenticated using (true);
  end if;
end $$;

-- ------------------------------------------------------------
-- 2) depo_hareket: 'satis' rolu rezerve kaydi olusturabiliyordu ama
--    geri okuyamiyordu -> "Bu ise bagla" durumu satis rolu icin hep
--    "bagli degil" gorunuyordu. Select yetkisini genisletiyoruz.
-- ------------------------------------------------------------
drop policy if exists dh_select on depo_hareket;
create policy dh_select on depo_hareket for select to authenticated
  using (current_rol() = any (array['admin','depo','planlama','uretim','satis']));

-- ------------------------------------------------------------
-- 3) uretim_plani.hedef_kg / hedef_metre — planlamacinin her adim icin
--    belirledigi hedef miktar. Uretim tamamlaninca uretim_adim'daki
--    gerceklesen kg/metre ile karsilastirilarak "Is Durum Takibi"
--    ekraninda hedef vs gerceklesen / kayip gosterilir.
-- ------------------------------------------------------------
alter table uretim_plani add column if not exists hedef_kg numeric(12,2);
alter table uretim_plani add column if not exists hedef_metre numeric(12,2);
comment on column uretim_plani.hedef_kg is 'Bu adim icin planlamacinin belirledigi hedef kg (opsiyonel, hedef/gerceklesen takibi icin)';
comment on column uretim_plani.hedef_metre is 'Bu adim icin planlamacinin belirledigi hedef metre (opsiyonel, hedef/gerceklesen takibi icin)';
