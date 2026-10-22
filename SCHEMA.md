# Schema Website Solusi Sejalan

Dokumen ini adalah rancangan awal struktur website dan data untuk Solusi Sejalan. Fokusnya adalah menampilkan paket layanan dan menjadi jalur masuk campaign antara client, buzzer, dan komunitas.

## 1. Tujuan website

- Membantu calon client memahami layanan dan memilih paket.
- Mengumpulkan brief dan permintaan konsultasi/campaign dari client.
- Mengelola campaign dan menghubungkan kebutuhan client dengan buzzer atau komunitas yang sesuai.
- Menyediakan jalur pendaftaran untuk buzzer dan komunitas.
- Memberi admin satu tempat untuk memeriksa leads, paket, talent, campaign, dan laporan.

## 2. Sitemap

### Halaman publik

1. **Beranda** — ringkasan value proposition, layanan unggulan, cara kerja, CTA konsultasi.
2. **Paket** — daftar paket, rincian deliverables, harga atau label “mulai dari”, CTA pilih paket.
3. **Detail paket** — ruang lingkup, jumlah talent/komunitas bila relevan, durasi, deliverables, syarat, FAQ.
4. **Layanan** — penjelasan aktivasi buzzer, komunitas, dan campaign sesuai layanan yang benar-benar ditawarkan.
5. **Cara kerja** — brief → rekomendasi → persetujuan → aktivasi → laporan.
6. **Studi kasus / portofolio** — campaign yang sudah disetujui untuk dipublikasikan.
7. **Tentang** — profil dan pendekatan Solusi Sejalan.
8. **Daftar sebagai buzzer/komunitas** — formulir minat dan informasi kanal/audiens.
9. **Kontak / konsultasi** — formulir singkat dan kanal komunikasi resmi.
10. **Kebijakan privasi** dan **syarat layanan**.

### Area client (tahap lanjutan)

- Dashboard status campaign.
- Detail brief dan timeline.
- Persetujuan rencana, materi, dan deliverables.
- Akses laporan dan dokumen campaign.

### Area admin (tahap lanjutan)

- Kelola paket dan leads.
- Tinjau profil buzzer/komunitas.
- Susun campaign, penugasan, status, dan laporan.

## 3. Peran pengguna

| Peran | Kebutuhan utama |
|---|---|
| Pengunjung | Melihat layanan/paket dan meminta konsultasi |
| Client | Mengirim brief, menyetujui rencana, memantau campaign, melihat laporan |
| Buzzer | Mendaftar, melengkapi profil/kanal, menerima tawaran penugasan |
| Komunitas | Mendaftar, menjelaskan demografi dan kapasitas komunitas, menerima tawaran campaign |
| Admin/Account Manager | Mengkurasi paket dan talent, mengelola client serta seluruh campaign |

Untuk MVP, pengunjung dan client dapat dilayani lewat formulir tanpa akun. Akun client/talent bisa ditambahkan setelah proses operasionalnya jelas.

## 4. Alur utama

### Client memesan layanan

`Paket → Konsultasi / Minta Penawaran → Form brief → Admin meninjau → Rekomendasi paket dan talent → Persetujuan → Campaign → Laporan`

Brief minimal: nama dan kontak, perusahaan/brand, tujuan, produk, target audiens, wilayah, kanal, jadwal, kisaran anggaran, kebutuhan khusus, serta persetujuan kebijakan privasi.

### Buzzer atau komunitas bergabung

`Daftar sebagai partner → Isi profil dan kanal → Admin meninjau/verifikasi → Status aktif → Dipertimbangkan untuk campaign yang cocok`

Pendaftaran bukan janji bahwa pendaftar langsung mendapat penugasan. Minta persetujuan sebelum menyimpan data atau menghubungi pendaftar untuk campaign.

### Admin menjalankan campaign

`Terima brief → Buat campaign → Pilih paket → Cocokkan dan undang talent → Catat persetujuan → Jalankan → Kumpulkan bukti/deliverables → Buat laporan`

## 5. Model data awal

Relasi ringkas:

```text
User ──< ClientProfile
User ──< TalentProfile ──< SocialChannel
Package ──< PackageDeliverable
ClientProfile ──< Lead ──0..1 Campaign >── Package
Campaign ──< CampaignAssignment >── TalentProfile
Campaign ──< CampaignReport
CampaignAssignment ──< Deliverable
```

### Tabel inti

#### `users`

- `id` (UUID, PK)
- `email` (unik, nullable untuk lead tanpa akun)
- `phone` (nullable)
- `full_name`
- `role` (`admin`, `account_manager`, `client`, `talent`)
- `status` (`active`, `pending`, `suspended`)
- `created_at`, `updated_at`

#### `client_profiles`

- `id` (UUID, PK)
- `user_id` (FK → users, nullable sampai akun dibuat)
- `company_name`
- `brand_name`
- `industry` (nullable)
- `website` (nullable)
- `created_at`, `updated_at`

#### `talent_profiles`

Satu profil untuk buzzer atau komunitas.

- `id` (UUID, PK)
- `user_id` (FK → users, nullable saat pendaftaran awal)
- `talent_type` (`buzzer`, `community`)
- `display_name`
- `contact_name`
- `contact_email`, `contact_phone`
- `description` (nullable)
- `city`, `province` (nullable)
- `audience_summary` (nullable; hindari data pribadi anggota audiens)
- `capacity` (nullable)
- `verification_status` (`pending`, `verified`, `rejected`)
- `status` (`active`, `inactive`)
- `created_at`, `updated_at`

#### `social_channels`

- `id` (UUID, PK)
- `talent_profile_id` (FK → talent_profiles)
- `platform` (misalnya Instagram, TikTok, YouTube, X, lainnya)
- `handle_or_name`
- `profile_url` (nullable)
- `follower_count` (nullable; angka perkiraan saat diperbarui)
- `engagement_rate` (nullable)
- `audience_notes` (nullable)
- `last_metrics_updated_at` (nullable)

#### `packages`

- `id` (UUID, PK)
- `name`
- `slug` (unik)
- `summary`
- `description` (nullable)
- `price_type` (`fixed`, `starting_at`, `custom_quote`)
- `price_amount` (nullable; rupiah, integer)
- `currency` (default `IDR`)
- `is_published` (boolean)
- `sort_order` (integer)
- `created_at`, `updated_at`

#### `package_deliverables`

- `id` (UUID, PK)
- `package_id` (FK → packages)
- `title`
- `description` (nullable)
- `quantity` (nullable)
- `unit` (nullable, misalnya post/video/komunitas)
- `sort_order`

#### `leads`

Permintaan konsultasi/penawaran, termasuk yang belum menjadi client.

- `id` (UUID, PK)
- `client_profile_id` (FK → client_profiles, nullable)
- `package_id` (FK → packages, nullable)
- `contact_name`, `email`, `phone`
- `company_name`, `brand_name` (nullable)
- `campaign_objective` (nullable)
- `target_audience` (nullable)
- `requested_channels` (JSON/array, nullable)
- `budget_min`, `budget_max` (nullable; rupiah)
- `start_date`, `end_date` (nullable)
- `brief` (teks, nullable)
- `privacy_consent_at`
- `status` (`new`, `contacted`, `qualified`, `proposal_sent`, `converted`, `closed`)
- `created_at`, `updated_at`

#### `campaigns`

- `id` (UUID, PK)
- `client_profile_id` (FK → client_profiles)
- `lead_id` (FK → leads, nullable)
- `package_id` (FK → packages, nullable)
- `name`
- `objective`, `target_audience` (nullable)
- `budget_amount` (nullable; rupiah)
- `starts_at`, `ends_at` (nullable)
- `status` (`draft`, `planning`, `awaiting_approval`, `scheduled`, `active`, `completed`, `cancelled`)
- `created_by` (FK → users)
- `created_at`, `updated_at`

#### `campaign_assignments`

- `id` (UUID, PK)
- `campaign_id` (FK → campaigns)
- `talent_profile_id` (FK → talent_profiles)
- `scope` (brief penugasan)
- `fee_amount` (nullable; rupiah)
- `status` (`invited`, `accepted`, `declined`, `in_progress`, `submitted`, `approved`, `cancelled`)
- `invited_at`, `responded_at` (nullable)
- `created_at`, `updated_at`

Tambahkan unique constraint pada pasangan (`campaign_id`, `talent_profile_id`) agar talent tidak ditugaskan dua kali ke campaign yang sama.

#### `deliverables`

- `id` (UUID, PK)
- `campaign_assignment_id` (FK → campaign_assignments)
- `title`
- `description` (nullable)
- `url` (nullable; tautan konten/bukti)
- `due_at` (nullable)
- `submitted_at` (nullable)
- `status` (`pending`, `submitted`, `revision_requested`, `approved`)
- `review_notes` (nullable)
- `created_at`, `updated_at`

#### `campaign_reports`

- `id` (UUID, PK)
- `campaign_id` (FK → campaigns)
- `title`
- `summary` (nullable)
- `metrics` (JSON; misalnya reach, views, engagement, klik, dengan definisi dan sumber)
- `file_url` (nullable)
- `published_at` (nullable)
- `created_by` (FK → users)
- `created_at`, `updated_at`

### Entitas tambahan untuk tahap berikutnya

- `consent_records` — catatan persetujuan, versi kebijakan, waktu, dan subjek persetujuan.
- `audit_logs` — jejak perubahan status campaign, penugasan, dan persetujuan.
- `attachments` — brief, materi, atau dokumen dengan akses terbatas.
- `invoices` dan `payments` — hanya jika transaksi dikelola langsung di website.

## 6. Aturan bisnis awal

- Harga, deliverables, dan cakupan setiap paket harus bisa dikonfigurasi admin; isi paket belum ditentukan dalam rancangan ini.
- Tombol utama paket mengarah ke formulir brief dengan paket tersebut sudah terpilih.
- Talent hanya terlihat di area admin; data kontak dan metrik rinci tidak ditampilkan ke publik tanpa persetujuan.
- Campaign assignment dibuat setelah kecocokan dan biaya disetujui pihak terkait.
- Perubahan status penting menyimpan waktu dan pengguna yang melakukan perubahan.
- Laporan harus membedakan angka aktual, estimasi, dan metrik yang dilaporkan platform.
- Jangan menyimpan kata sandi media sosial talent/client.

## 7. Rekomendasi MVP

Mulai dari website publik, paket yang dikelola admin, formulir konsultasi/brief, formulir pendaftaran buzzer/komunitas, dan notifikasi ke tim melalui email atau WhatsApp resmi. Dashboard dan akun multi-peran menjadi fase berikutnya setelah alur operasional disepakati.

Konten yang perlu dilengkapi sebelum publikasi: logo dan identitas visual, daftar paket beserta harga/cakupan, kanal kontak, kebijakan privasi, syarat pembatalan/revisi, contoh campaign yang boleh ditampilkan, dan wilayah layanan.
