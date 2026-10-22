-- Ported from database/migrations/016_dae_weekly_reports.sql.
CREATE TABLE IF NOT EXISTS dae_weekly_reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  dae_person VARCHAR(160) NOT NULL,
  week_start DATE NOT NULL,
  client_retention_count INT UNSIGNED NOT NULL DEFAULT 0,
  strategy_idea_count INT UNSIGNED NOT NULL DEFAULT 0,
  visit_count INT UNSIGNED NOT NULL DEFAULT 0,
  achievement_client_count INT UNSIGNED NOT NULL DEFAULT 0,
  achievement_rank INT UNSIGNED NOT NULL DEFAULT 0,
  team_coordination TEXT NULL,
  daily_report TEXT NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY dae_weekly_report_person_week (dae_person,week_start),
  KEY dae_weekly_report_week (week_start),
  CONSTRAINT dae_weekly_report_creator_fk FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
