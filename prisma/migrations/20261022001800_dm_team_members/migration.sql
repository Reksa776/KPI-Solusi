-- Ported from database/migrations/018_dm_team_members.sql.
CREATE TABLE IF NOT EXISTS dm_team_members (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(160) NOT NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY dm_team_member_name_unique (full_name),
  CONSTRAINT dm_team_member_creator_fk FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE team_activity_entries
  ADD COLUMN dm_team_member_id INT UNSIGNED NULL AFTER assigned_user_id,
  ADD COLUMN dm_person VARCHAR(160) NULL AFTER dm_team_member_id,
  ADD KEY team_activity_dm_member (dm_team_member_id),
  ADD CONSTRAINT team_activity_dm_member_fk FOREIGN KEY (dm_team_member_id) REFERENCES dm_team_members(id) ON DELETE SET NULL;

INSERT IGNORE INTO dm_team_members (full_name)
SELECT DISTINCT u.full_name
FROM team_activity_entries e
JOIN users u ON u.id=e.assigned_user_id
WHERE e.entry_type='dm_client' AND e.scope='dm' AND TRIM(u.full_name)<>'';

UPDATE team_activity_entries e
JOIN users u ON u.id=e.assigned_user_id
JOIN dm_team_members m ON m.full_name=u.full_name
SET e.dm_team_member_id=m.id,e.dm_person=m.full_name
WHERE e.entry_type='dm_client' AND e.scope='dm' AND e.dm_team_member_id IS NULL;
