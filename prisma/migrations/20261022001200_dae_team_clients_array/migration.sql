-- Ported from database/migrations/012_dae_team_clients_array.sql.
ALTER TABLE team_activity_entries
  ADD COLUMN agency_client_ids JSON NULL AFTER agency_client_id;
