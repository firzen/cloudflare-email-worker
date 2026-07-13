CREATE TABLE app_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO app_settings (setting_key, setting_value) VALUES
  ('login_title', 'Cloudflare Email Inbox'),
  ('login_description', 'Operate multi-domain inbound mail from one shared workspace. Sign in to triage messages, move them between folders, and manage operator access from settings.');
