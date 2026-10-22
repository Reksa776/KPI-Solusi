ALTER TABLE team_activity_entries ADD COLUMN week_start DATE NULL AFTER activity_date;
UPDATE team_activity_entries SET week_start=DATE_SUB(activity_date, INTERVAL WEEKDAY(activity_date) DAY) WHERE week_start IS NULL;
ALTER TABLE team_activity_entries MODIFY week_start DATE NOT NULL;
CREATE INDEX team_activity_week_dae ON team_activity_entries (entry_type,week_start,dae_person);

ALTER TABLE dae_strategy_details ADD COLUMN week_start DATE NULL AFTER dae_person;
UPDATE dae_strategy_details SET week_start=DATE_SUB(DATE(created_at), INTERVAL WEEKDAY(created_at) DAY) WHERE week_start IS NULL;
ALTER TABLE dae_strategy_details MODIFY week_start DATE NOT NULL;
CREATE INDEX dae_strategy_week_person ON dae_strategy_details (week_start,dae_person);

ALTER TABLE dae_visit_details ADD COLUMN week_start DATE NULL AFTER dae_person;
UPDATE dae_visit_details SET week_start=DATE_SUB(DATE(created_at), INTERVAL WEEKDAY(created_at) DAY) WHERE week_start IS NULL;
ALTER TABLE dae_visit_details MODIFY week_start DATE NOT NULL;
CREATE INDEX dae_visit_week_person ON dae_visit_details (week_start,dae_person);
ALTER TABLE dae_visit_details DROP INDEX dae_visit_person_client;
CREATE UNIQUE INDEX dae_visit_week_person_client ON dae_visit_details (week_start,dae_person,agency_client_id);
