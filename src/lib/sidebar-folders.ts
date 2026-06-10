export type SidebarFolder = {
  id: string;
  name: string;
  kind: string;
};

export function sortFoldersForSidebar(folders: SidebarFolder[]) {
  return [...folders].sort((left, right) => {
    const leftIsInbox = left.name.toLowerCase() === "inbox";
    const rightIsInbox = right.name.toLowerCase() === "inbox";
    const leftIsSent = left.name.toLowerCase() === "sent";
    const rightIsSent = right.name.toLowerCase() === "sent";

    if (leftIsInbox && !rightIsInbox) return -1;
    if (!leftIsInbox && rightIsInbox) return 1;
    if (leftIsSent && !rightIsSent) return leftIsInbox ? 1 : -1;
    if (!leftIsSent && rightIsSent) return rightIsInbox ? -1 : 1;

    return left.name.localeCompare(right.name);
  });
}

export function findDefaultFolderId(folders: SidebarFolder[]) {
  const inbox = folders.find((folder) => folder.name.toLowerCase() === "inbox");
  return inbox?.id ?? null;
}
