USE solusi_sejalan;

CREATE TABLE IF NOT EXISTS agency_clients (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_name VARCHAR(180) NOT NULL,
  client_type ENUM('existing','prospect','ex_client','community','media','institution','agency_ph','etc') NOT NULL DEFAULT 'prospect',
  contact_name VARCHAR(160) NULL,
  email VARCHAR(191) NULL,
  phone VARCHAR(40) NULL,
  notes TEXT NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY agency_clients_type_updated (client_type,updated_at),
  KEY agency_clients_name (client_name),
  CONSTRAINT agency_clients_creator_fk FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
