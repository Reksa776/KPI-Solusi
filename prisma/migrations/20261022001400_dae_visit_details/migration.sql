-- Ported from database/migrations/014_dae_visit_details.sql.
CREATE TABLE IF NOT EXISTS dae_visit_details (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  dae_person VARCHAR(160) NOT NULL,
  agency_client_id BIGINT UNSIGNED NOT NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY dae_visit_person_client (dae_person, agency_client_id),
  KEY dae_visit_client (agency_client_id),
  CONSTRAINT dae_visit_client_fk FOREIGN KEY (agency_client_id) REFERENCES agency_clients(id) ON DELETE CASCADE,
  CONSTRAINT dae_visit_creator_fk FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
