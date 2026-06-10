export type MailboxPermission = "read" | "reply" | "manage";

export type MailboxPermissionGrant = {
  mailboxId: string;
  permission: MailboxPermission;
};

export function hasMailboxPermission(
  permissions: MailboxPermissionGrant[],
  mailboxId: string,
  permission: MailboxPermission,
) {
  return permissions.some(
    (entry) => entry.mailboxId === mailboxId && entry.permission === permission,
  );
}
