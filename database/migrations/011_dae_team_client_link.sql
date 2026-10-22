ALTER TABLE team_activity_entries
  ADD COLUMN agency_client_id BIGINT UNSIGNED NULL AFTER client_type,
  ADD KEY team_activity_agency_client (agency_client_id),
  ADD CONSTRAINT team_activity_agency_client_fk FOREIGN KEY (agency_client_id)
    REFERENCES agency_clients(id) ON DELETE SET NULL;
