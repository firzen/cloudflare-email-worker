import { findDefaultFolderId, sortFoldersForSidebar } from "./sidebar-folders";
import { inboxPageMarkup } from "./ui/markup";
import { renderInboxPageScript } from "./ui/script";
import { inboxPageStyles } from "./ui/styles";
import type { LoginBranding } from "./login-branding";

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function renderInboxPage(loginBranding: LoginBranding) {
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
  <body>${inboxPageMarkup
    .replace("__LOGIN_TITLE__", escapeHtml(loginBranding.title))
    .replace("__LOGIN_DESCRIPTION__", escapeHtml(loginBranding.description))}
    <script>${script}
    </script>
  </body>
</html>`;
}
