begin;

-- Akun boleh dihapus sendiri dari halaman Pengaturan. Baris library ikut
-- terhapus lewat cascade, dan trigger aznime_sync_library_owner membersihkan
-- aznime_library_owners saat baris pengguna hilang.
grant delete on public.aznime_users to service_role;

commit;
