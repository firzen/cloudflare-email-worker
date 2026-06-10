PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'operator')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  password_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE domains (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE mailboxes (
  id TEXT PRIMARY KEY,
  domain_id TEXT NOT NULL,
  local_part TEXT NOT NULL,
  full_address TEXT NOT NULL UNIQUE,
  route_type TEXT NOT NULL DEFAULT 'exact' CHECK (route_type IN ('exact', 'catch_all')),
  can_reply INTEGER NOT NULL DEFAULT 1 CHECK (can_reply IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (domain_id) REFERENCES domains(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE user_mailbox_permissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  mailbox_id TEXT NOT NULL,
  permission TEXT NOT NULL CHECK (permission IN ('read', 'reply', 'manage')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, mailbox_id, permission),
  FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (mailbox_id) REFERENCES mailboxes(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('system', 'custom')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  mailbox_id TEXT NOT NULL,
  domain_id TEXT NOT NULL,
  folder_id TEXT NOT NULL,
  message_id_header TEXT,
  in_reply_to_header TEXT,
  references_header TEXT,
  from_name TEXT,
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  cc_json TEXT NOT NULL DEFAULT '[]',
  bcc_json TEXT NOT NULL DEFAULT '[]',
  subject TEXT NOT NULL DEFAULT '',
  text_body TEXT,
  html_body TEXT,
  snippet TEXT,
  received_at TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
  deleted_at TEXT,
  raw_r2_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mailbox_id) REFERENCES mailboxes(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (domain_id) REFERENCES domains(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE message_attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  content_id TEXT,
  disposition TEXT,
  r2_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE outbound_messages (
  id TEXT PRIMARY KEY,
  reply_to_message_id TEXT,
  sent_by_user_id TEXT NOT NULL,
  sent_as_mailbox_id TEXT NOT NULL,
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  cc_json TEXT NOT NULL DEFAULT '[]',
  bcc_json TEXT NOT NULL DEFAULT '[]',
  subject TEXT NOT NULL,
  text_body TEXT,
  html_body TEXT,
  in_reply_to_header TEXT,
  references_header TEXT,
  provider_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reply_to_message_id) REFERENCES messages(id) ON UPDATE CASCADE ON DELETE SET NULL,
  FOREIGN KEY (sent_by_user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (sent_as_mailbox_id) REFERENCES mailboxes(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('message', 'mailbox', 'folder', 'user', 'outbound_message')),
  target_id TEXT NOT NULL,
  mailbox_id TEXT,
  folder_id TEXT,
  message_id TEXT,
  target_user_id TEXT,
  outbound_message_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    CASE target_type
      WHEN 'message' THEN target_id = message_id AND message_id IS NOT NULL AND mailbox_id IS NULL AND folder_id IS NULL AND target_user_id IS NULL AND outbound_message_id IS NULL
      WHEN 'mailbox' THEN target_id = mailbox_id AND mailbox_id IS NOT NULL AND message_id IS NULL AND folder_id IS NULL AND target_user_id IS NULL AND outbound_message_id IS NULL
      WHEN 'folder' THEN target_id = folder_id AND folder_id IS NOT NULL AND mailbox_id IS NULL AND message_id IS NULL AND target_user_id IS NULL AND outbound_message_id IS NULL
      WHEN 'user' THEN target_id = target_user_id AND target_user_id IS NOT NULL AND mailbox_id IS NULL AND message_id IS NULL AND folder_id IS NULL AND outbound_message_id IS NULL
      WHEN 'outbound_message' THEN target_id = outbound_message_id AND outbound_message_id IS NOT NULL AND mailbox_id IS NULL AND message_id IS NULL AND folder_id IS NULL AND target_user_id IS NULL
      ELSE 0
    END
  ),
  FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (mailbox_id) REFERENCES mailboxes(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (target_user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (outbound_message_id) REFERENCES outbound_messages(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX idx_mailboxes_domain_id ON mailboxes(domain_id);
CREATE INDEX idx_user_mailbox_permissions_user_id ON user_mailbox_permissions(user_id);
CREATE INDEX idx_user_mailbox_permissions_mailbox_id ON user_mailbox_permissions(mailbox_id);
CREATE INDEX idx_messages_mailbox_id ON messages(mailbox_id);
CREATE INDEX idx_messages_domain_id ON messages(domain_id);
CREATE INDEX idx_messages_folder_id ON messages(folder_id);
CREATE INDEX idx_message_attachments_message_id ON message_attachments(message_id);
CREATE INDEX idx_outbound_messages_reply_to_message_id ON outbound_messages(reply_to_message_id);
CREATE INDEX idx_outbound_messages_sent_by_user_id ON outbound_messages(sent_by_user_id);
CREATE INDEX idx_outbound_messages_sent_as_mailbox_id ON outbound_messages(sent_as_mailbox_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_mailbox_id ON audit_logs(mailbox_id);
CREATE INDEX idx_audit_logs_folder_id ON audit_logs(folder_id);
CREATE INDEX idx_audit_logs_target_user_id ON audit_logs(target_user_id);
CREATE INDEX idx_audit_logs_message_id ON audit_logs(message_id);
CREATE INDEX idx_audit_logs_outbound_message_id ON audit_logs(outbound_message_id);

INSERT INTO folders (id, name, kind) VALUES
  ('fld_inbox', 'Inbox', 'system'),
  ('fld_archived', 'Archived', 'system'),
  ('fld_deleted', 'Deleted', 'system');
