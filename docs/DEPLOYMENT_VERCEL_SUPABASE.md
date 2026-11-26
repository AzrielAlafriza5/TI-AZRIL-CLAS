# Panduan Deployment IT AZRIL CLAS: GitHub → Vercel → Supabase

Dokumentasi ini menjelaskan cara menghubungkan **IT AZRIL CLAS** ke **Supabase (PostgreSQL, Auth, Storage)** dan melakukan deployment ke **Vercel** melalui **GitHub**.

---

## 1. Persiapan Database & Auth di Supabase

1. Buat project baru di [Supabase Dashboard](https://supabase.com/dashboard).
2. Buka menu **SQL Editor** → **New Query**.
3. Salin seluruh isi file `supabase/migrations/0001_initial_schema.sql` dan jalankan (**Run**).
   - Skrip ini membuat 22 tabel relasional (`profiles`, `students`, `study_programs`, `classes`, `assignments`, `assignment_targets`, `submissions`, `materials`, `material_targets`, `material_progress`, `attendance`, `point_transactions`, `student_status_history`, `login_streaks`, `login_history`, `exp_transactions`, `achievements`, `student_achievements`, `notifications`, `excel_import_history`, `system_settings`, `audit_logs`).
   - Mengaktifkan Row Level Security (RLS) pada seluruh tabel dan indeks unik anti-duplikasi.
   - Membuat bucket Storage `it-azril-clas-files`.
4. Ambil kredensial dari **Project Settings → API**:
   - `Project URL` → untuk `VITE_SUPABASE_URL` dan `SUPABASE_URL`
   - `anon public` key → untuk `VITE_SUPABASE_ANON_KEY`
   - `service_role` secret key → **HANYA** untuk `SUPABASE_SERVICE_ROLE_KEY` (server-side, jangan pernah memakai prefix `VITE_`).

---

## 2. Konfigurasi Akun Administrator Tunggal

1. **IT AZRIL CLAS** hanya mengizinkan satu akun administrator utama.
2. Atur environment variable server-side:
   - `ADMIN_EMAIL` (contoh: `admin@itazrilclas.ac.id`)
   - `ADMIN_PASSWORD` (password kuat administrator utama)
3. Jika variabel belum diisi pada run pertama, sistem menyediakan formulir klaim akun admin sekali pakai yang otomatis terkunci permanen setelah admin pertama dibuat.

---

## 3. Push ke GitHub

```bash
git init
git add .
git commit -m "Initial release: IT AZRIL CLAS"
git branch -M main
git remote add origin https://github.com/USERNAME/it-azril-clas.git
git push -u origin main
```

Pastikan `.env` dan folder `data/` serta `uploads/` berada di `.gitignore`.

---

## 4. Deployment ke Vercel

1. Buka [Vercel Dashboard](https://vercel.com/new) dan impor repository GitHub `it-azril-clas`.
2. Framework Preset: **Vite** (Build Command: `npm run build`, Output Directory: `dist`).
3. File `vercel.json` sudah disertakan untuk menangani SPA routing agar refresh halaman pada route mana pun tidak menghasilkan 404.
4. Tambahkan Environment Variables di Vercel (**Settings → Environment Variables**):
   - `VITE_SUPABASE_URL` = URL project Supabase
   - `VITE_SUPABASE_ANON_KEY` = Anon public key Supabase
   - `SUPABASE_URL` = URL project Supabase
   - `SUPABASE_SERVICE_ROLE_KEY` = Service role key Supabase (rahasia server)
   - `ADMIN_EMAIL` = Email admin utama
   - `ADMIN_PASSWORD` = Password admin utama
   - `SESSION_SECRET` = String acak panjang (min. 32 karakter)
5. Klik **Deploy**.

---

## 5. Verifikasi Pasca-Deployment

- Buka URL aplikasi Vercel dan pastikan judul halaman `IT AZRIL CLAS — Learn. Grow. Compete.`.
- Login sebagai Admin utama, buat Program Studi & Kelas, lalu buat akun Mahasiswa.
- Uji login mahasiswa menggunakan NIM sebagai username dan password awal.
- Uji refresh browser di berbagai menu untuk memastikan routing SPA dan persistensi database berjalan normal.
