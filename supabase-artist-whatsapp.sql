-- Jalankan di Supabase SQL Editor untuk mengaktifkan nomor WhatsApp per artis.
alter table public.songs add column if not exists whatsapp_number text;

-- Isi nomor pemilik lagu yang sudah ada berdasarkan nama artis.
update public.songs
set whatsapp_number = case
  when lower(trim(artist)) = 'ikbal sopan' then '6283148451522'
  when lower(trim(artist)) = 'kikuk neverdie' then '6283805979397'
  else '6283148451522'
end
where whatsapp_number is null or trim(whatsapp_number) = '';

-- Ganti nama artis lama ke nama baru untuk katalog yang sudah tersimpan.
update public.songs
set artist = 'Rizz Neverdie',
    whatsapp_number = '6283805979397'
where lower(trim(artist)) = 'kikuk neverdie';
