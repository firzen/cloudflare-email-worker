CREATE TABLE outbound_message_attachments (
  id TEXT PRIMARY KEY,
  outbound_message_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  content_id TEXT,
  disposition TEXT,
  r2_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (outbound_message_id) REFERENCES outbound_messages(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX idx_outbound_message_attachments_outbound_message_id ON outbound_message_attachments(outbound_message_id);
