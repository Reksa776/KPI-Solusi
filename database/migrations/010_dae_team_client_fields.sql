ALTER TABLE team_activity_entries
  ADD COLUMN dae_person VARCHAR(160) NULL AFTER assigned_user_id,
  ADD COLUMN client_type VARCHAR(30) NULL AFTER dae_person;

CREATE INDEX team_activity_client_type ON team_activity_entries (client_type);
