type MailboxRow = {
  id: string;
  full_address: string;
};

type PermissionRow = {
  user_id: string;
  mailbox_id: string;
  permission: string;
};

type FolderRow = {
  id: string;
  name: string;
  kind: string;
};

type MessageRow = {
  id: string;
  mailbox_id: string;
  folder_id: string;
  from_email: string;
  to_email: string;
  subject: string;
  snippet: string | null;
  text_body: string | null;
  html_body: string | null;
  received_at: string;
  is_read: number;
  deleted_at?: string | null;
};

type OutboundMessageRow = {
  id: string;
  sent_as_mailbox_id: string;
  from_email: string;
  to_email: string;
  subject: string;
  text_body: string | null;
  html_body: string | null;
  status: string;
  sent_at: string | null;
};

type OutboundAttachmentRow = {
  id: string;
  outbound_message_id: string;
  filename: string;
  content_type: string | null;
  size_bytes: number;
};

type Fixtures = {
  mailboxes?: MailboxRow[];
  folders?: FolderRow[];
  permissions?: PermissionRow[];
  messages?: MessageRow[];
  outboundMessages?: OutboundMessageRow[];
  outboundAttachments?: OutboundAttachmentRow[];
};

export function createFakeDb(fixtures: Fixtures) {
  const mailboxes = fixtures.mailboxes ?? [];
  const folders = fixtures.folders ?? [];
  const permissions = fixtures.permissions ?? [];
  const messages = fixtures.messages ?? [];
  const outboundMessages = fixtures.outboundMessages ?? [];
  const outboundAttachments = fixtures.outboundAttachments ?? [];

  return {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async all() {
              return {
                results: runAllQuery(
                  sql,
                  params,
                  mailboxes,
                  permissions,
                  messages,
                  outboundMessages,
                  outboundAttachments,
                ),
              };
            },
            async first<T>() {
              return runFirstQuery<T>(
                sql,
                params,
                folders,
                permissions,
                messages,
                outboundMessages,
              );
            },
            async run() {
              return runMutation(sql, params, permissions, messages);
            },
          };
        },
      };
    },
  } as unknown as D1Database;
}

function runAllQuery(
  sql: string,
  params: unknown[],
  mailboxes: MailboxRow[],
  permissions: PermissionRow[],
  messages: MessageRow[],
  outboundMessages: OutboundMessageRow[],
  outboundAttachments: OutboundAttachmentRow[],
) {
  if (sql.includes("FROM mailboxes")) {
    const [userId] = params;
    const allowedMailboxIds = getAllowedMailboxIds(String(userId), permissions);

    return mailboxes
      .filter((mailbox) => allowedMailboxIds.has(mailbox.id))
      .sort((left, right) => left.full_address.localeCompare(right.full_address))
      .map(({ id, full_address }) => ({ id, full_address }));
  }

  if (sql.includes("FROM messages")) {
    const [userId] = params;
    const allowedMailboxIds = getAllowedMailboxIds(String(userId), permissions);

    const visibleMessages = messages
      .filter((message) => message.deleted_at == null)
      .filter((message) => allowedMailboxIds.has(message.mailbox_id));

    if (sql.includes("ORDER BY received_at DESC, id DESC")) {
      visibleMessages.sort(compareMessagesByNewest);
    } else if (sql.includes("ORDER BY received_at DESC")) {
      visibleMessages.sort((left, right) => right.received_at.localeCompare(left.received_at));
    }

    return visibleMessages.slice(0, 50).map(projectListMessage);
  }

  if (sql.includes("FROM outbound_messages")) {
    const [userId] = params;
    const allowedMailboxIds = getAllowedMailboxIds(String(userId), permissions);

    return outboundMessages
      .filter((message) => message.status === "sent")
      .filter((message) => message.sent_at != null)
      .filter((message) => allowedMailboxIds.has(message.sent_as_mailbox_id))
      .sort(compareOutboundMessagesByNewest)
      .slice(0, 50)
      .map(projectOutboundListMessage);
  }

  if (sql.includes("FROM outbound_message_attachments")) {
    const [outboundMessageId] = params;
    return outboundAttachments
      .filter((attachment) => attachment.outbound_message_id === outboundMessageId)
      .map((attachment) => ({ ...attachment }));
  }

  throw new Error(`Unsupported all() query in fake DB: ${sql}`);
}

function runFirstQuery<T>(
  sql: string,
  params: unknown[],
  folders: FolderRow[],
  permissions: PermissionRow[],
  messages: MessageRow[],
  outboundMessages: OutboundMessageRow[],
) {
  if (sql.includes("FROM folders")) {
    const [folderId] = params;
    const folder = folders.find((row) => row.id === folderId);
    return (folder ?? null) as T | null;
  }

  if (sql.includes("FROM messages")) {
    const [messageId, userId] = params;
    const requiredPermission = getRequiredPermission(sql);
    const allowedMailboxIds = getAllowedMailboxIds(String(userId), permissions, requiredPermission);
    const message = messages.find(
      (row) =>
        row.id === messageId &&
        row.deleted_at == null &&
        allowedMailboxIds.has(row.mailbox_id),
    );

    return (message ?? null) as T | null;
  }

  if (sql.includes("FROM outbound_messages")) {
    const [messageId, userId] = params;
    const allowedMailboxIds = getAllowedMailboxIds(String(userId), permissions);
    const message = outboundMessages.find(
      (row) =>
        row.id === messageId &&
        row.status === "sent" &&
        row.sent_at != null &&
        allowedMailboxIds.has(row.sent_as_mailbox_id),
    );

    return (message ?? null) as T | null;
  }

  throw new Error(`Unsupported first() query in fake DB: ${sql}`);
}

function runMutation(
  sql: string,
  params: unknown[],
  permissions: PermissionRow[],
  messages: MessageRow[],
) {
  if (sql.includes("UPDATE messages") && sql.includes("SET is_read = 1")) {
    const [messageId] = params;
    const message = messages.find((row) => row.id === messageId && row.deleted_at == null);

    if (message) {
      message.is_read = 1;
      return { success: true, meta: { changes: 1 } };
    }

    return { success: true, meta: { changes: 0 } };
  }

  if (sql.includes("UPDATE messages") && sql.includes("SET is_read = 0")) {
    const [messageId] = params;
    const message = messages.find((row) => row.id === messageId && row.deleted_at == null);

    if (message) {
      message.is_read = 0;
      return { success: true, meta: { changes: 1 } };
    }

    return { success: true, meta: { changes: 0 } };
  }

  if (sql.includes("UPDATE messages") && sql.includes("SET folder_id = ?")) {
    const [folderId, messageId] = params;
    const message = messages.find((row) => row.id === messageId && row.deleted_at == null);

    if (message) {
      message.folder_id = String(folderId);
      return { success: true, meta: { changes: 1 } };
    }

    return { success: true, meta: { changes: 0 } };
  }

  throw new Error(`Unsupported run() query in fake DB: ${sql}`);
}

function getAllowedMailboxIds(
  userId: string,
  permissions: PermissionRow[],
  requiredPermission?: string,
) {
  return new Set(
    permissions
      .filter((permission) => permission.user_id === userId)
      .filter((permission) =>
        requiredPermission ? permission.permission === requiredPermission : true,
      )
      .map((permission) => permission.mailbox_id),
  );
}

function getRequiredPermission(sql: string) {
  const match = sql.match(/permission = '([^']+)'/);
  return match?.[1];
}

function compareMessagesByNewest(left: MessageRow, right: MessageRow) {
  const receivedAtComparison = right.received_at.localeCompare(left.received_at);
  if (receivedAtComparison !== 0) {
    return receivedAtComparison;
  }

  return right.id.localeCompare(left.id);
}

function projectListMessage(message: MessageRow) {
  return {
    id: message.id,
    folder_id: message.folder_id,
    subject: message.subject,
    from_email: message.from_email,
    to_email: message.to_email,
    received_at: message.received_at,
    is_read: message.is_read,
  };
}

function compareOutboundMessagesByNewest(left: OutboundMessageRow, right: OutboundMessageRow) {
  const sentAtComparison = String(right.sent_at).localeCompare(String(left.sent_at));
  if (sentAtComparison !== 0) {
    return sentAtComparison;
  }

  return right.id.localeCompare(left.id);
}

function projectOutboundListMessage(message: OutboundMessageRow) {
  return {
    id: message.id,
    folder_id: "fld_sent",
    subject: message.subject,
    from_email: message.from_email,
    to_email: message.to_email,
    snippet: message.text_body || message.html_body || "",
    received_at: message.sent_at,
    is_read: 1,
    message_type: "outbound",
  };
}
