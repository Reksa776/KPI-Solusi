USE solusi_sejalan;

CREATE TABLE IF NOT EXISTS team_kpi_targets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  scope ENUM('dm','dae') NOT NULL,
  metric ENUM('contents','video_views','tiktok_sales','shopee_sales','new_clients','strategies','visits') NOT NULL,
  period_month CHAR(7) NOT NULL,
  target_value BIGINT UNSIGNED NOT NULL DEFAULT 0,
  updated_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY team_kpi_target_unique (scope,metric,period_month),
  CONSTRAINT team_kpi_target_user_fk FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS team_activity_entries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  scope ENUM('dm','dae') NOT NULL,
  entry_type ENUM('dm_client','dae_individual','dae_team','dae_strategy','dae_visit','dae_client') NOT NULL,
  title VARCHAR(180) NOT NULL,
  client_name VARCHAR(160) NULL,
  activity_date DATE NOT NULL,
  contents BIGINT UNSIGNED NOT NULL DEFAULT 0,
  video_views BIGINT UNSIGNED NOT NULL DEFAULT 0,
  tiktok_sales BIGINT UNSIGNED NOT NULL DEFAULT 0,
  shopee_sales BIGINT UNSIGNED NOT NULL DEFAULT 0,
  new_clients INT UNSIGNED NOT NULL DEFAULT 0,
  strategies INT UNSIGNED NOT NULL DEFAULT 0,
  visits INT UNSIGNED NOT NULL DEFAULT 0,
  notes TEXT NULL,
  assigned_user_id INT UNSIGNED NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY team_activity_scope_date (scope,activity_date),
  KEY team_activity_type_date (entry_type,activity_date),
  CONSTRAINT team_activity_user_fk FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT team_activity_assignee_fk FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
