-- Ported from database/migrations/017_dae_visit_counts.sql.
ALTER TABLE dae_visit_details
  ADD COLUMN visit_count INT UNSIGNED NOT NULL DEFAULT 1 AFTER agency_client_id;
