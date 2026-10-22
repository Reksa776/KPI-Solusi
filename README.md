# Solusi Sejalan

Website ini memakai Next.js App Router. Setiap menu utama punya alamat halaman sendiri:

- `/` — Beranda
- `/layanan` — Layanan digital marketing
- `/paket` — Paket layanan digital marketing dan aktivasi campaign
- `/cara-kerja` — Alur strategi dan aktivasi digital campaign
- `/partner` — Informasi jaringan buzzer, kreator, dan komunitas digital
- `/brief` — Formulir kebutuhan campaign (lead intake)
- `/studi-kasus` — Studi kasus yang dipublikasikan
- `/portal/client`, `/portal/partner`, dan `/portal/viewer` — Portal sesuai role akun
- `/admin/login` — Login dashboard pengelola paket
- `/admin` — Dashboard pengelolaan paket (perlu login)
- `/admin/pengaturan` — Kelola identitas, SEO, kontak, CTA, analitik, logo, dan favicon (perlu login)
- `/admin/keamanan` — Ubah password dan cabut sesi login lama (perlu login)

## Menjalankan secara lokal

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`. Untuk build produksi, jalankan `npm run build`, lalu `npm run start`.

## Database MySQL, Prisma, dan admin

`prisma/schema.prisma` berisi model untuk seluruh 19 tabel aplikasi. Riwayat migration Prisma dibuat dari schema dasar dan seluruh perubahan SQL `002` sampai `018` di `database/migrations/`. Aplikasi dan script admin mengakses database melalui Prisma Client. `database/schema.sql` dan `database/migrations/` dipertahankan sebagai sumber migration lama; untuk deployment baru gunakan `prisma/migrations/`.

1. Salin `.env.example` menjadi `.env.local`, lalu isi `DATABASE_URL` dan `ADMIN_SESSION_SECRET`. Prisma CLI membaca `.env.local` atau `.env`; format `DATABASE_URL` memakai `mysql://USER:PASSWORD@HOST:3306/DATABASE`.
2. Buat database kosong di MySQL VPS, misalnya dengan menjalankan `CREATE DATABASE solusi_sejalan CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;` di MySQL. `DATABASE_URL` harus menunjuk ke database tersebut.
3. Dari folder project di VPS, jalankan:

   ```bash
   npm ci
   npm run db -- generate
   npm run db -- migrate deploy
   ```

   Perintah terakhir membuat tabel dari baseline dan menerapkan seluruh migration sampai `018_dm_team_members`. Jalankan `npm run db -- migrate status` untuk melihat statusnya.

### Database VPS yang sudah dimigrasikan dengan skrip SQL lama

Jangan jalankan `migrate deploy` pada database lama sebelum Prisma mengenali riwayatnya; migration akan mencoba membuat perubahan yang sudah ada. Buat backup dan pastikan semua migration `database/schema.sql` serta `002`–`018` sudah berhasil dijalankan. Setelah itu, tandai riwayat yang sama sebagai sudah diterapkan tanpa menjalankan ulang DDL:

```bash
for migration in prisma/migrations/*/; do
  name="$(basename "$migration")"
  npm run db -- migrate resolve --applied "$name"
done
```

Lalu cek dengan `npm run db -- migrate status` dan `npm run check:production`. Jika database lama belum sampai migration `018`, jangan tandai semua sebagai applied: backup dulu, terapkan hanya skrip legacy yang masih kurang secara berurutan, kemudian jalankan perintah loop di atas. Database yang tidak lengkap perlu dibandingkan dengan semua kolom di `prisma/schema.prisma` sebelum diadopsi.

Untuk migration baru ke depannya, ubah `prisma/schema.prisma`, buat migration di environment development dengan `npm run db -- migrate dev --name nama_perubahan`, commit folder migration yang dibuat, lalu jalankan `npm run db -- migrate deploy` di VPS. Jangan gunakan `migrate dev` pada database production.

Setelah database siap, buat akun Superadmin pertama dengan `npm run create-user -- --email admin@contoh.id --name "Nama Admin"`. Script meminta password tepat 8 karakter secara tersembunyi dan menyimpan hash scrypt. Jalankan website dengan `npm run dev`, lalu buka `/admin/login`. Superadmin dapat membuat Admin, Kliper, Buzzer, Brand, dan Viewer dari menu **Pengguna**. Admin dipilihkan lingkup DM, DAE, atau keduanya; Viewer hanya dapat melihat ringkasan.

## Lead, notifikasi, dan keamanan

- Set `APP_URL` ke alamat HTTPS publik, `CRON_SECRET` ke secret acak minimal 32 karakter, serta `ADMIN_SESSION_SECRET` ke secret acak minimal 32 karakter.
- Untuk email lead, set `LEAD_NOTIFY_EMAIL`, `RESEND_API_KEY`, dan `RESEND_FROM_EMAIL`. Untuk WhatsApp, set `WHATSAPP_CLOUD_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_RECIPIENT_NUMBER`, `WHATSAPP_TEMPLATE_NAME`, dan `WHATSAPP_TEMPLATE_LANGUAGE`. Token hanya ada di environment server, tidak disimpan di browser atau database.
- Buat dan ajukan template pesan WhatsApp di WhatsApp Manager. Template pesan lead perlu tiga placeholder body: nama kontak, nama brand, dan email. Worker mengirim template yang sudah disetujui lewat WhatsApp Cloud API.
- `vercel.json` menjalankan antrean setiap lima menit. Di hosting lain, panggil `GET /api/cron/process-notifications` setiap lima menit dengan header `Authorization: Bearer <CRON_SECRET>`. Antrean menyimpan retry otomatis dan menghentikan job setelah enam kegagalan.
- Lead di dashboard punya PIC, tanggal follow-up, catatan internal, riwayat perubahan, dan indikator follow-up terlambat. Admin dapat mengganti password dari menu **Keamanan akun**; perubahan password mencabut sesi lama.
- Campaign bertipe KOL Clipping hanya bisa dibuka setelah sumber, aturan, izin pemakaian materi, rate, dan batas budget ditentukan. Kliper atau Buzzer dengan profil partner aktif dapat menggunakan portal partner untuk melihat tugas; klip dapat dikirim untuk review dan views dimasukkan secara manual oleh Admin lingkup DM. Estimasi reward mengikuti rate per 1.000 views, minimum views, dan batas budget campaign.

## SEO, analitik, dan privasi

- Sitemap, robots.txt, dan gambar Open Graph dibuat otomatis. Pastikan `APP_URL` sama dengan domain publik.
- Masukkan GA4 Measurement ID dan Meta Pixel ID di `/admin/pengaturan`. Tracking tombol hanya berjalan setelah pengunjung menyetujui kategori terkait pada banner privasi. Pilihan privasi disimpan di perangkat pengunjung.
- ID analitik disimpan di pengaturan aplikasi; API key/provider secret notifikasi disimpan sebagai environment variable server.

## Backup dan pemulihan

- Pasang utilitas `mysqldump`, `mysql`, dan `tar` pada host backup, lalu jalankan `npm run backup`. Script menyimpan dump SQL dan arsip logo/favicon di `backups/`, membatasi retensi ke 30 backup terakhir, dan folder backup diabaikan Git.
- Pulihkan database dari backup tertentu dengan `npm run restore-backup -- --sql backups/<folder>/<database>.sql --confirm`. Untuk memulihkan logo/favicon juga, tambahkan `--branding backups/<folder>/branding.tar.gz`. Restore mengganti isi database tujuan; cek `DATABASE_URL` dengan teliti dan lakukan pemulihan saat maintenance.
- Simpan satu salinan backup di lokasi terpisah dari server aplikasi dan uji proses pemulihan secara berkala.

## Pemeriksaan pra-rilis

- Jalankan `npm run check:production -- --strict` untuk memeriksa konfigurasi production, koneksi MySQL, tabel migration, folder branding, dan kanal notifikasi. Gunakan `--http` setelah situs dapat diakses untuk mengecek beranda, paket, robots.txt, dan sitemap.
- Sebelum membuka website untuk publik, cek manual di ponsel dan desktop: menu mobile, pengiriman brief dan email/WhatsApp notifikasi, tiap role login/portal, ubah password dan invalidasi sesi, CRUD paket/campaign/partner, persetujuan banner analitik, serta hasil restore backup di staging.

Role akses platform adalah Superadmin, Admin, Kliper, Buzzer, Brand, dan Viewer. Superadmin dibuat melalui script bootstrap; role lainnya dikelola dari dashboard. Akun lama dimigrasikan otomatis oleh migration 006.

Solusi Sejalan diposisikan sebagai agency digital marketing yang berfokus pada strategi campaign, distribusi konten, buzzer/kreator, dan community marketing. Contoh paket menggunakan harga awal yang bisa diubah di dashboard. Harga dan cakupannya perlu disesuaikan dengan penawaran resmi Solusi Sejalan sebelum website dipublikasikan. Tombol konsultasi mengarah ke formulir brief campaign.

Ikon logo dan favicon PNG yang diunggah dari pengaturan dashboard tersimpan di `data/branding/`. Simpan folder tersebut saat memindahkan atau mencadangkan instalasi lokal.
