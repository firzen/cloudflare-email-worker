import { inboxPageComposeScript } from "./script-compose";
import { inboxPageCoreScript } from "./script-core";
import { inboxPageMessagesScript } from "./script-messages";
import { inboxPageSettingsScript } from "./script-settings";

type InboxPageScriptOptions = {
  defaultSelectedFolderIdLiteral: string;
  findDefaultFolderIdSource: string;
  sortFoldersForSidebarSource: string;
};

export function renderInboxPageScript({
  defaultSelectedFolderIdLiteral,
  findDefaultFolderIdSource,
  sortFoldersForSidebarSource,
}: InboxPageScriptOptions) {
  return [
    inboxPageCoreScript,
    inboxPageSettingsScript,
    inboxPageComposeScript,
    inboxPageMessagesScript,
  ].join("\n")
    .replaceAll("__DEFAULT_SELECTED_FOLDER_ID__", defaultSelectedFolderIdLiteral)
    .replaceAll("__FIND_DEFAULT_FOLDER_ID__", findDefaultFolderIdSource)
    .replaceAll("__SORT_FOLDERS_FOR_SIDEBAR__", sortFoldersForSidebarSource);
}
