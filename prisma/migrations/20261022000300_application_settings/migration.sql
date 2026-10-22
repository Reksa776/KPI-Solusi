-- Ported from database/migrations/003_application_settings.sql.
CREATE TABLE IF NOT EXISTS application_settings (
  setting_key VARCHAR(80) NOT NULL,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO application_settings (setting_key, setting_value) VALUES
  ('site_name', 'Solusi Sejalan'),
  ('site_tagline', 'Digital marketing yang sejalan dengan tujuan brand.'),
  ('seo_title', 'Solusi Sejalan — Digital Marketing yang Sejalan'),
  ('seo_description', 'Solusi Sejalan adalah agency digital marketing yang membantu brand merancang campaign bersama buzzer, kreator, dan komunitas yang relevan.'),
  ('footer_note', 'Digital marketing yang sejalan dengan tujuan brand.'),
  ('instagram_url', 'https://www.instagram.com/solusisejalanagency/'),
  ('contact_email', ''),
  ('whatsapp_number', ''),
  ('google_analytics_id', ''),
  ('meta_pixel_id', ''),
  ('cta_label', 'Kirim brief'),
  ('cta_url', '/brief');
