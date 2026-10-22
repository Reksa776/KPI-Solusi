ALTER TABLE dae_visit_details
  ADD COLUMN visit_count INT UNSIGNED NOT NULL DEFAULT 1 AFTER agency_client_id;
