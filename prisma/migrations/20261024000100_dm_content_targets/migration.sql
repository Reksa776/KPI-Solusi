CREATE TABLE dm_content_targets (
  dm_team_member_id INT UNSIGNED NOT NULL,
  agency_client_id BIGINT UNSIGNED NOT NULL,
  week_start DATE NOT NULL,
  target_contents INT UNSIGNED NOT NULL DEFAULT 0,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (dm_team_member_id, agency_client_id, week_start),
  KEY dm_content_target_week (week_start),
  CONSTRAINT dm_content_target_member_fk
    FOREIGN KEY (dm_team_member_id) REFERENCES dm_team_members(id) ON DELETE CASCADE,
  CONSTRAINT dm_content_target_client_fk
    FOREIGN KEY (agency_client_id) REFERENCES agency_clients(id) ON DELETE CASCADE,
  CONSTRAINT dm_content_target_creator_fk
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
