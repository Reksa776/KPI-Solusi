USE solusi_sejalan;

ALTER TABLE campaigns
  ADD COLUMN campaign_type ENUM('standard','kol_clipping') NOT NULL DEFAULT 'standard',
  ADD COLUMN clipping_source_url VARCHAR(500) NULL,
  ADD COLUMN clipping_rules TEXT NULL,
  ADD COLUMN clipping_rights_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN clipping_rate_per_1000 BIGINT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN clipping_budget_cap BIGINT UNSIGNED NULL,
  ADD COLUMN clipping_min_views INT UNSIGNED NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS campaign_clips (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  campaign_id BIGINT UNSIGNED NOT NULL,
  partner_id BIGINT UNSIGNED NOT NULL,
  clip_title VARCHAR(180) NOT NULL,
  platform ENUM('tiktok','instagram','youtube','other') NOT NULL,
  post_url VARCHAR(500) NOT NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  views BIGINT UNSIGNED NOT NULL DEFAULT 0,
  clipper_note VARCHAR(1000) NULL,
  reviewer_note VARCHAR(1000) NULL,
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY campaign_clips_post_url_unique (post_url),
  KEY campaign_clips_campaign_status (campaign_id,status,submitted_at),
  KEY campaign_clips_partner (partner_id,status,submitted_at),
  CONSTRAINT campaign_clips_campaign_fk FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  CONSTRAINT campaign_clips_partner_fk FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
