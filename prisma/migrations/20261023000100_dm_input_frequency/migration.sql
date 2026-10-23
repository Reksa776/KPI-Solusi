-- DM client performance can be entered per day or per week.
-- Existing DM rows remain weekly by default.
ALTER TABLE team_activity_entries
  ADD COLUMN input_frequency VARCHAR(10) NOT NULL DEFAULT 'weekly' AFTER week_start;

CREATE INDEX team_activity_dm_client_period
  ON team_activity_entries (entry_type, dm_team_member_id, agency_client_id, week_start);
