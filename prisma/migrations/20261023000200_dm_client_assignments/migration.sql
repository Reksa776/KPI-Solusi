CREATE TABLE dm_client_assignments (
  dm_team_member_id INT UNSIGNED NOT NULL,
  agency_client_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (dm_team_member_id, agency_client_id),
  KEY dm_client_assignment_client (agency_client_id),
  CONSTRAINT dm_client_assignment_member_fk
    FOREIGN KEY (dm_team_member_id) REFERENCES dm_team_members(id) ON DELETE CASCADE,
  CONSTRAINT dm_client_assignment_client_fk
    FOREIGN KEY (agency_client_id) REFERENCES agency_clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed the initial assignment list from clients already reported by each DM.
INSERT IGNORE INTO dm_client_assignments (dm_team_member_id, agency_client_id)
SELECT DISTINCT dm_team_member_id, agency_client_id
FROM team_activity_entries
WHERE entry_type='dm_client'
  AND dm_team_member_id IS NOT NULL
  AND agency_client_id IS NOT NULL;
