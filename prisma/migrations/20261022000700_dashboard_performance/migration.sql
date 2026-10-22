-- Ported from database/migrations/007_dashboard_performance.sql.
ALTER TABLE leads
  ADD COLUMN converted_at DATETIME NULL AFTER status;

ALTER TABLE campaigns
  ADD COLUMN assigned_dm_user_id INT UNSIGNED NULL AFTER client_user_id,
  ADD KEY campaigns_dm_owner (assigned_dm_user_id),
  ADD CONSTRAINT campaigns_dm_owner_fk FOREIGN KEY (assigned_dm_user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE campaign_deliverables
  ADD COLUMN video_views BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER engagements,
  ADD COLUMN tiktok_sales BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER video_views,
  ADD COLUMN shopee_sales BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER tiktok_sales;
