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

## Database MySQL dan admin

1. Salin `.env.example` menjadi `.env.local`, lalu isi `DATABASE_URL` dan `ADMIN_SESSION_SECRET`.
2. Jalankan `database/schema.sql` pada server MySQL. Script membuat database `solusi_sejalan`, tabel `users` dan `packages`, serta tiga paket awal bila belum ada.
3. Jalankan `database/migrations/002_marketing_workflow.sql` setelah schema dasar. Migration ini menambahkan lead, campaign, partner, deliverable, dan studi kasus.
4. Jalankan `database/migrations/003_application_settings.sql`. Migration ini menyimpan identitas website, SEO, kontak, dan tombol utama yang dikelola melalui `/admin/pengaturan`. Backup database dan uji migration di staging sebelum menjalankannya pada database produksi.
5. Jalankan `database/migrations/004_operations_security.sql`. Migration ini menambah PIC/jadwal/catatan lead, riwayat aktivitas, antrean notifikasi, dan versi sesi akun untuk pembatasan login serta pencabutan sesi. Jalankan setiap migration satu kali dan uji di staging sebelum production.
6. Jalankan `database/migrations/005_kol_clipping.sql` satu kali untuk mengaktifkan campaign KOL Clipping, kiriman klip, review, dan pencatatan reward.
7. Jalankan `database/migrations/006_multi_role_access.sql` satu kali. Migration ini mengubah role lama menjadi role baru dan menambahkan lingkup kerja Admin. Buat backup dan uji di staging sebelum production.
8. Jalankan `database/migrations/007_dashboard_performance.sql` satu kali untuk menambah penanggung jawab DM, views video, omset TikTok/Shopee, dan waktu konversi DAE.
9. Jalankan `database/migrations/008_team_kpi_workspaces.sql` satu kali untuk mengaktifkan target KPI bulanan dan workspace input aktivitas DM/DAE.
10. Jalankan `database/migrations/009_agency_clients.sql` satu kali untuk membuat database relasi client dengan klasifikasi client.
11. Jalankan `database/migrations/010_dae_team_client_fields.sql` satu kali untuk menambahkan nama orang DAE, nama client, dan jenis client opsional pada input Data Tim DAE.
12. Jalankan `database/migrations/011_dae_team_client_link.sql` satu kali agar Data Tim DAE dapat memilih client langsung dari database Client.
13. Jalankan `database/migrations/012_dae_team_clients_array.sql` satu kali agar satu orang DAE dapat menyimpan beberapa client terpilih sebagai array ID.
14. Jalankan `database/migrations/013_dae_strategy_details.sql` satu kali untuk menyimpan beberapa strategi per DAE beserta client yang dituju.
15. Jalankan `database/migrations/014_dae_visit_details.sql` satu kali untuk menyimpan daftar client yang akan dikunjungi tiap DAE.
16. Jalankan `database/migrations/015_dae_weekly_periods.sql` satu kali untuk memberi periode mingguan pada catatan aktivitas DAE lama. Data Tim DAE berfungsi sebagai daftar tetap orang dan client yang dipegang; periode mingguan dipakai pada strategi, kunjungan, dan laporan.
17. Jalankan `database/migrations/016_dae_weekly_reports.sql` satu kali untuk menyimpan laporan mingguan Data Per DAE.
18. Jalankan `database/migrations/017_dae_visit_counts.sql` satu kali untuk menyimpan jumlah kunjungan per client pada setiap minggu.
19. Jalankan `database/migrations/018_dm_team_members.sql` satu kali untuk mengelola daftar nama tim DM dan menghubungkannya dengan catatan performa DM.
9. Buat akun Superadmin pertama dengan `npm run create-user -- --email admin@contoh.id --name "Nama Admin"`. Script meminta password tepat 8 karakter secara tersembunyi dan menyimpan hash scrypt ke MySQL.
10. Jalankan website dengan `npm run dev`, lalu buka `/admin/login`. Superadmin dapat membuat Admin, Kliper, Buzzer, Brand, dan Viewer dari menu **Pengguna**. Admin dipilihkan lingkup DM, DAE, atau keduanya; Viewer hanya dapat melihat ringkasan. Analytics menghitung angka deliverable dan klip yang dicatat manual, bukan sinkronisasi API sosial.

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
