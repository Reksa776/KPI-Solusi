-- Baseline: core account and package tables.
CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(160) NOT NULL,
  email VARCHAR(191) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('superadmin','admin','kliper','buzzer','brand','viewer') NOT NULL DEFAULT 'brand',
  admin_scope ENUM('dm','dae','both') NOT NULL DEFAULT 'both',
  status ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY users_email_unique (email),
  KEY users_role_status (role, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS packages (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(140) NOT NULL,
  tagline VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  price BIGINT UNSIGNED NOT NULL DEFAULT 0,
  features JSON NOT NULL,
  highlighted BOOLEAN NOT NULL DEFAULT FALSE,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY packages_slug_unique (slug),
  KEY packages_public_order (is_published, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO packages (name, slug, tagline, description, price, features, highlighted, is_published, sort_order)
SELECT 'Buzzer Starter', 'buzzer-starter', 'Amplifikasi konten', 'Paket awal untuk mendistribusikan campaign digital melalui buzzer terkurasi dan konten yang relevan.', 1500000,
       JSON_ARRAY('5 buzzer terkurasi', '1 konten per buzzer', 'Koordinasi jadwal publikasi', 'Rekap tautan konten'), FALSE, TRUE, 1
WHERE NOT EXISTS (SELECT 1 FROM packages WHERE slug = 'buzzer-starter');

INSERT INTO packages (name, slug, tagline, description, price, features, highlighted, is_published, sort_order)
SELECT 'Community Connect', 'community-connect', 'Community marketing', 'Aktivasi digital bersama komunitas yang punya minat dan kedekatan dengan audiens brand-mu.', 3500000,
       JSON_ARRAY('Pemetaan komunitas relevan', '1 aktivasi komunitas', 'Koordinasi partner dan brand', 'Dokumentasi dan rangkuman'), TRUE, TRUE, 2
WHERE NOT EXISTS (SELECT 1 FROM packages WHERE slug = 'community-connect');

INSERT INTO packages (name, slug, tagline, description, price, features, highlighted, is_published, sort_order)
SELECT 'Sejalan Campaign', 'sejalan-campaign', 'Digital campaign terpadu', 'Campaign digital yang menggabungkan distribusi melalui buzzer dan aktivasi komunitas dalam satu strategi.', 7500000,
       JSON_ARRAY('Kombinasi buzzer dan komunitas', 'Rencana aktivasi sesuai brief', 'Koordinasi campaign end-to-end', 'Laporan performa campaign'), FALSE, TRUE, 3
WHERE NOT EXISTS (SELECT 1 FROM packages WHERE slug = 'sejalan-campaign');
