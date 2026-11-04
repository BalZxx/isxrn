-- Pengaturan logo toko (terpisah dari tabel store_settings yang sudah ada).
create table if not exists public.store_branding_settings (
  id text primary key check (id = 'main'),
  logo_url text,
  updated_at timestamptz not null default now()
);

alter table public.store_branding_settings enable row level security;

grant select on public.store_branding_settings to anon, authenticated;
grant insert, update on public.store_branding_settings to authenticated;

drop policy if exists "Public can read store branding settings" on public.store_branding_settings;
create policy "Public can read store branding settings"
on public.store_branding_settings for select
to anon, authenticated
using (true);

drop policy if exists "Authenticated can insert store branding settings" on public.store_branding_settings;
create policy "Authenticated can insert store branding settings"
on public.store_branding_settings for insert
to authenticated
with check (id = 'main');

drop policy if exists "Authenticated can update store branding settings" on public.store_branding_settings;
create policy "Authenticated can update store branding settings"
on public.store_branding_settings for update
to authenticated
using (id = 'main')
with check (id = 'main');

-- Bucket covers dipakai untuk menyimpan file logo. Pastikan bucket ini public.
update storage.buckets set public = true where id = 'covers';

drop policy if exists "Public can read store branding files" on storage.objects;
create policy "Public can read store branding files"
on storage.objects for select
to public
using (bucket_id = 'covers');

drop policy if exists "Authenticated can upload store branding files" on storage.objects;
create policy "Authenticated can upload store branding files"
on storage.objects for insert
to authenticated
with check (bucket_id = 'covers');
