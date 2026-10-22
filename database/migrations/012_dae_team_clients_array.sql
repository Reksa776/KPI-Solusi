ALTER TABLE team_activity_entries
  ADD COLUMN agency_client_ids JSON NULL AFTER agency_client_id;
