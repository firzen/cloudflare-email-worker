import { describe, expect, it } from "vitest";
import schema0001 from "../../migrations/0001_initial.sql?raw";
import schema0002 from "../../migrations/0002_outbound_message_attachments.sql?raw";

const schema = [schema0001, schema0002].join("\n");

describe("initial schema", () => {
  it("defines core tables, lookup indexes, explicit fk policies, audit-log target checks, and seeded system folders", () => {
    const requiredSnippets = [
      "CREATE TABLE users (",
      "CREATE TABLE domains (",
      "CREATE TABLE mailboxes (",
      "CREATE TABLE user_mailbox_permissions (",
      "CREATE TABLE folders (",
      "CREATE TABLE messages (",
      "CREATE TABLE message_attachments (",
      "CREATE TABLE outbound_messages (",
      "CREATE TABLE outbound_message_attachments (",
      "CREATE TABLE audit_logs (",
      "CREATE INDEX idx_mailboxes_domain_id ON mailboxes(domain_id);",
      "CREATE INDEX idx_user_mailbox_permissions_user_id ON user_mailbox_permissions(user_id);",
      "CREATE INDEX idx_user_mailbox_permissions_mailbox_id ON user_mailbox_permissions(mailbox_id);",
      "CREATE INDEX idx_messages_mailbox_id ON messages(mailbox_id);",
      "CREATE INDEX idx_messages_domain_id ON messages(domain_id);",
      "CREATE INDEX idx_messages_folder_id ON messages(folder_id);",
      "CREATE INDEX idx_message_attachments_message_id ON message_attachments(message_id);",
      "CREATE INDEX idx_outbound_messages_reply_to_message_id ON outbound_messages(reply_to_message_id);",
      "CREATE INDEX idx_outbound_messages_sent_by_user_id ON outbound_messages(sent_by_user_id);",
      "CREATE INDEX idx_outbound_messages_sent_as_mailbox_id ON outbound_messages(sent_as_mailbox_id);",
      "CREATE INDEX idx_outbound_message_attachments_outbound_message_id ON outbound_message_attachments(outbound_message_id);",
      "CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);",
      "CREATE INDEX idx_audit_logs_mailbox_id ON audit_logs(mailbox_id);",
      "CREATE INDEX idx_audit_logs_folder_id ON audit_logs(folder_id);",
      "CREATE INDEX idx_audit_logs_target_user_id ON audit_logs(target_user_id);",
      "CREATE INDEX idx_audit_logs_message_id ON audit_logs(message_id);",
      "CREATE INDEX idx_audit_logs_outbound_message_id ON audit_logs(outbound_message_id);",
      "ON DELETE RESTRICT",
      "ON DELETE CASCADE",
      "ON DELETE SET NULL",
      "ON UPDATE CASCADE",
      "CHECK (",
      "WHEN 'message' THEN target_id = message_id AND message_id IS NOT NULL AND mailbox_id IS NULL AND folder_id IS NULL AND target_user_id IS NULL AND outbound_message_id IS NULL",
      "WHEN 'mailbox' THEN target_id = mailbox_id AND mailbox_id IS NOT NULL AND message_id IS NULL AND folder_id IS NULL AND target_user_id IS NULL AND outbound_message_id IS NULL",
      "WHEN 'folder' THEN target_id = folder_id AND folder_id IS NOT NULL AND mailbox_id IS NULL AND message_id IS NULL AND target_user_id IS NULL AND outbound_message_id IS NULL",
      "WHEN 'user' THEN target_id = target_user_id AND target_user_id IS NOT NULL AND mailbox_id IS NULL AND message_id IS NULL AND folder_id IS NULL AND outbound_message_id IS NULL",
      "WHEN 'outbound_message' THEN target_id = outbound_message_id AND outbound_message_id IS NOT NULL AND mailbox_id IS NULL AND message_id IS NULL AND folder_id IS NULL AND target_user_id IS NULL",
      "CHECK (",
      "INSERT INTO folders (id, name, kind) VALUES",
      "('fld_inbox', 'Inbox', 'system')",
      "('fld_archived', 'Archived', 'system')",
      "('fld_deleted', 'Deleted', 'system')",
    ];

    for (const snippet of requiredSnippets) {
      expect(schema).toContain(snippet);
    }

    expect(schema.match(/INSERT INTO folders \(id, name, kind\) VALUES/g) ?? []).toHaveLength(1);
  });
});
