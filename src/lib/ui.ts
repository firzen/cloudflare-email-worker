import { findDefaultFolderId, sortFoldersForSidebar } from "./sidebar-folders";
import { inboxPageMarkup } from "./ui/markup";
import { renderInboxPageScript } from "./ui/script";
import { inboxPageStyles } from "./ui/styles";

export function renderInboxPage() {
  const script = renderInboxPageScript({
    defaultSelectedFolderIdLiteral: JSON.stringify(findDefaultFolderId([
      { id: "fld_inbox", name: "Inbox", kind: "system" },
    ])),
    findDefaultFolderIdSource: findDefaultFolderId.toString(),
    sortFoldersForSidebarSource: sortFoldersForSidebar.toString(),
  });

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Cloudflare Email Inbox</title>
    <style>${inboxPageStyles}
    </style>
  </head>
  <body>${inboxPageMarkup}
    <script>${script}
    </script>
  </body>
</html>`;
}
