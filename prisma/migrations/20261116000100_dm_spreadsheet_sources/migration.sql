CREATE TABLE dm_spreadsheet_sources (
  dm_team_member_id INT UNSIGNED NOT NULL,
  spreadsheet_url VARCHAR(1000) NOT NULL,
  last_synced_at TIMESTAMP NULL DEFAULT NULL,
  last_sync_status VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (dm_team_member_id),
  CONSTRAINT dm_spreadsheet_source_member_fk FOREIGN KEY (dm_team_member_id)
    REFERENCES dm_team_members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
