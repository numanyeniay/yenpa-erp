-- Musteri tablosuna eksik sutunlar ekle
alter table musteri_tanim add column if not exists vergi_no text;
alter table musteri_tanim add column if not exists vergi_dairesi text;
alter table musteri_tanim add column if not exists sektor text;
alter table musteri_tanim add column if not exists yetkili_ad text;
alter table musteri_tanim add column if not exists yetkili_tel text;
alter table musteri_tanim add column if not exists yetkili_email text;

-- Kullanici tablosuna auth_id ekle ve guncelle
update kullanici_tanim k
set auth_id = a.id
from auth.users a
where a.email = k.email
and k.auth_id is null;
