export const inboxPageCoreScript = String.raw`
      const SENT_FOLDER_ID = "fld_sent";
      const ALL_FOLDER_ID = "__all__";

      const state = {
        user: null,
        messages: [],
        outboundMessages: [],
        folders: [],
        mailboxes: [],
        users: [],
        auditLogs: [],
        mailboxPermissions: [],
        selectedUserId: null,
        editingUser: null,
        permissionDrafts: {},
        permissionSearchQuery: "",
        searchQuery: "",
        selectedMessageId: null,
        selectedMessageType: "inbound",
        selectedMessageDetail: null,
        detailLoading: false,
        toastTimer: null,
        settingsTab: "workspace",
        selectedFolderId: __DEFAULT_SELECTED_FOLDER_ID__,
        composeOpen: false,
      };

      const els = {
        loginCard: document.getElementById("login-card"),
        workspace: document.getElementById("workspace"),
        loginStatus: document.getElementById("login-status"),
        email: document.getElementById("email"),
        password: document.getElementById("password"),
        loginButton: document.getElementById("login-button"),
        refreshButton: document.getElementById("refresh-button"),
        sessionBadge: document.getElementById("session-badge"),
        userAvatar: document.getElementById("user-avatar"),
        userName: document.getElementById("user-name"),
        userEmail: document.getElementById("user-email"),
        settingsUserName: document.getElementById("settings-user-name"),
        settingsUserEmail: document.getElementById("settings-user-email"),
        listCaption: document.getElementById("list-caption"),
        folderList: document.getElementById("folder-list"),
        messageSearch: document.getElementById("message-search"),
        messageList: document.getElementById("message-list"),
        threadTitle: document.getElementById("thread-title"),
        threadSubline: document.getElementById("thread-subline"),
        detailView: document.getElementById("detail-view"),
        moveFolderSelect: document.getElementById("move-folder-select"),
        markReadButton: document.getElementById("mark-read-button"),
        moveButton: document.getElementById("move-button"),
        deleteButton: document.getElementById("delete-button"),
        permanentDeleteButton: document.getElementById("permanent-delete-button"),
        settingsButton: document.getElementById("settings-button"),
        settingsModal: document.getElementById("settings-modal"),
        closeSettingsButton: document.getElementById("close-settings-button"),
        settingsTabs: document.getElementById("settings-tabs"),
        logoutButton: document.getElementById("logout-button"),
        mailboxSummary: document.getElementById("mailbox-summary"),
        currentPasswordInput: document.getElementById("current-password-input"),
        newPasswordInput: document.getElementById("new-password-input"),
        confirmPasswordInput: document.getElementById("confirm-password-input"),
        changePasswordButton: document.getElementById("change-password-button"),
        passwordStatus: document.getElementById("password-status"),
        auditList: document.getElementById("audit-list"),
        permissionsSection: document.getElementById("permissions-section"),
        employeesSection: document.getElementById("employees-section"),
        cloudflareSyncSection: document.getElementById("cloudflare-sync-section"),
        toastRegion: document.getElementById("toast-region"),
        adminUserList: document.getElementById("admin-user-list"),
        savePermissionsButton: document.getElementById("save-permissions-button"),
        adminStatus: document.getElementById("admin-status"),
        newUserButton: document.getElementById("new-user-button"),
        deleteUserButton: document.getElementById("delete-user-button"),
        employeeList: document.getElementById("employee-list"),
        userNameInput: document.getElementById("user-name-input"),
        userEmailInput: document.getElementById("user-email-input"),
        userRoleInput: document.getElementById("user-role-input"),
        userStatusInput: document.getElementById("user-status-input"),
        userPasswordInput: document.getElementById("user-password-input"),
        permissionSearchInput: document.getElementById("permission-search-input"),
        permissionBulkReadButton: document.getElementById("permission-bulk-read"),
        permissionBulkReplyButton: document.getElementById("permission-bulk-reply"),
        permissionBulkManageButton: document.getElementById("permission-bulk-manage"),
        runCloudflareSyncButton: document.getElementById("run-cloudflare-sync-button"),
        cloudflareSyncStatus: document.getElementById("cloudflare-sync-status"),
        cloudflareSyncResults: document.getElementById("cloudflare-sync-results"),
        composeButton: document.getElementById("compose-button"),
        composeModal: document.getElementById("compose-modal"),
        composeFromPrefix: document.getElementById("compose-from-prefix"),
        composeFromDomain: document.getElementById("compose-from-domain"),
        composeTo: document.getElementById("compose-to"),
        composeCc: document.getElementById("compose-cc"),
        composeBcc: document.getElementById("compose-bcc"),
        composeSubject: document.getElementById("compose-subject"),
        composeText: document.getElementById("compose-text"),
        composeAttachments: document.getElementById("compose-attachments"),
        composeAttachmentsList: document.getElementById("compose-attachments-list"),
        composeSendButton: document.getElementById("compose-send-button"),
        composeCancelButton: document.getElementById("compose-cancel-button"),
        composeStatus: document.getElementById("compose-status"),
        closeComposeButton: document.getElementById("close-compose-button"),
      };

      function escapeHtml(value) {
        return String(value ?? "")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#39;");
      }

      function sanitizeHtml(html) {
        const template = document.createElement("template");
        template.innerHTML = String(html || "").trim();
        const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT, null);
        const toRemove = [];
        while (walker.nextNode()) {
          const node = walker.currentNode;
          if (node.nodeName === "SCRIPT" || node.nodeName === "IFRAME" || node.nodeName === "OBJECT" || node.nodeName === "EMBED") {
            toRemove.push(node);
            continue;
          }
          for (const attr of Array.from(node.attributes)) {
            const name = attr.name.toLowerCase();
            if (name.startsWith("on") || (name === "src" || name === "href") && /^javascript:/iu.test(attr.value)) {
              node.removeAttribute(attr.name);
            }
          }
        }
        toRemove.forEach((node) => node.remove());
        return template.innerHTML;
      }

      function setStatus(target, text, kind = "") {
        if (!target) return;
        target.textContent = text;
        target.className = kind ? "status " + kind : "status";
      }

      function setButtonLoading(button, loading, loadingLabel) {
        if (!button) return;
        if (!button.dataset.baseLabel) {
          button.dataset.baseLabel = button.textContent || "";
        }
        button.disabled = loading;
        button.setAttribute("aria-busy", loading ? "true" : "false");
        button.classList.toggle("is-loading", loading);
        button.textContent = loading
          ? (loadingLabel || button.dataset.loadingLabel || "Working...")
          : button.dataset.baseLabel;
      }

      function showToast(message, kind = "success") {
        const region = els.toastRegion;
        if (!region) return;
        region.innerHTML = '<div class="toast toast-' + kind + '">' + escapeHtml(message) + "</div>";
        region.classList.add("visible");
        if (state.toastTimer) clearTimeout(state.toastTimer);
        state.toastTimer = setTimeout(() => {
          region.classList.remove("visible");
          region.innerHTML = "";
          state.toastTimer = null;
        }, kind === "error" ? 5200 : 2600);
      }

      async function api(path, options = {}) {
        const headers = { ...(options.headers || {}) };
        if (options.body != null && !(options.body instanceof FormData) && !headers["content-type"]) {
          headers["content-type"] = "application/json";
        }

        let res;
        try {
          res = await fetch(path, {
            credentials: "same-origin",
            cache: "no-store",
            headers,
            ...options,
          });
        } catch (error) {
          const shouldRetry =
            options.method === "POST" &&
            !options.body &&
            error instanceof TypeError;

          if (shouldRetry) {
            await new Promise((resolve) => setTimeout(resolve, 300));
            res = await fetch(path, {
              credentials: "same-origin",
              cache: "no-store",
              headers,
              ...options,
            });
          } else {
            throw new Error(
              error instanceof Error
                ? "Network request failed: " + error.message
                : "Network request failed.",
            );
          }
        }

        const contentType = res.headers.get("content-type") || "";
        const data = contentType.includes("application/json") ? await res.json() : await res.text();

        if (!res.ok) {
          const message = data && data.error
            ? [
                data.error.message,
                data.error.step ? "step: " + data.error.step : "",
                data.error.details ? "details: " + data.error.details : "",
              ].filter(Boolean).join(" | ")
            : String(data);
          throw new Error(message || "Request failed");
        }

        return data;
      }

      function formatMailboxCount(items) {
        return items.length + (items.length === 1 ? " mailbox" : " mailboxes");
      }

      function displayDate(value) {
        if (!value) return "";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return date.toLocaleString();
      }

      function displayShortTime(value) {
        if (!value) return "";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      }

      function defaultReplySubject(value) {
        const subject = String(value || "");
        return /^re:/iu.test(subject) ? subject : "Re: " + subject;
      }

      function formatFileSize(bytes) {
        const size = Number(bytes) || 0;
        if (size < 1024) return size + " B";
        if (size < 1024 * 1024) return (size / 1024).toFixed(1).replace(/\\.0$/u, "") + " KB";
        return (size / (1024 * 1024)).toFixed(1).replace(/\\.0$/u, "") + " MB";
      }

      function avatarText(value) {
        const source = String(value || "").trim();
        if (!source) return "U";
        return source.slice(0, 2).toUpperCase();
      }

      async function boot() {
        try {
          const data = await api("/api/auth/me", { headers: {} });
          state.user = data.user;
          await loadWorkspace();
          renderSession();
        } catch {
          renderSession();
        }
      }

      function renderSession() {
        const signedIn = Boolean(state.user);
        els.loginCard.style.display = signedIn ? "none" : "block";
        els.workspace.classList.toggle("visible", signedIn);
        if (!signedIn) {
          closeSettingsModal();
          return;
        }

        const user = state.user;
        els.sessionBadge.textContent = formatMailboxCount(state.mailboxes);
        els.userAvatar.textContent = avatarText(user.name || user.email);
        els.userName.textContent = user.name;
        els.userName.title = user.name || "";
        els.userEmail.textContent = user.email + " · " + user.role;
        els.userEmail.title = els.userEmail.textContent;
        els.settingsUserName.textContent = user.name;
        els.settingsUserName.title = user.name || "";
        els.settingsUserEmail.textContent = user.email + " · " + user.role;
        els.settingsUserEmail.title = els.settingsUserEmail.textContent;
      }

      async function loadWorkspace() {
        const [mailboxes, folders, messages, outboundMessages, audits] = await Promise.all([
          api("/api/mailboxes"),
          api("/api/folders"),
          api("/api/messages"),
          api("/api/messages/sent"),
          api("/api/audit-logs"),
        ]);

        state.mailboxes = mailboxes.items;
        state.folders = folders.items;
        state.messages = messages.items;
        state.outboundMessages = outboundMessages.items;
        state.auditLogs = audits.items;

        const foldersInView = __SORT_FOLDERS_FOR_SIDEBAR__(state.folders);
        if (state.selectedFolderId !== null && !foldersInView.find((folder) => folder.id === state.selectedFolderId)) {
          state.selectedFolderId = __FIND_DEFAULT_FOLDER_ID__(foldersInView);
        }

        if (state.selectedFolderId === null) {
          state.selectedFolderId = __FIND_DEFAULT_FOLDER_ID__(foldersInView);
        }

        if (state.user && state.user.role === "admin") {
          const users = await api("/api/users");
          state.users = users.items;
          if (!state.selectedUserId || !state.users.find((item) => item.id === state.selectedUserId)) {
            state.selectedUserId = state.users[0] ? state.users[0].id : null;
          }
          await loadSelectedUserEditor();
        } else {
          state.users = [];
          state.selectedUserId = null;
          state.editingUser = null;
          state.mailboxPermissions = [];
        }

        const items = visibleMessages();
        if (!items.find((message) => message.id === state.selectedMessageId && message.message_type === state.selectedMessageType)) {
          setSelectedMessage(items[0] || null);
        }

        renderSidebar();
        renderSettings();
        renderMessages();

        await loadSelectedMessageDetail();
      }

      function renderSidebar() {
        const items = __SORT_FOLDERS_FOR_SIDEBAR__(state.folders);
        const allUnreadCount = unreadCountForFolder();
        const allRow = '' +
          '<button class="folder-row' + (state.selectedFolderId === null ? " active" : "") + '" type="button" data-folder-id="__all__">' +
            '<span class="folder-icon">◎</span>' +
            '<span class="folder-name" title="All">All</span>' +
            '<span class="folder-kind">' + escapeHtml(allUnreadCount) + '</span>' +
          '</button>';

        if (!items.length) {
          els.folderList.innerHTML = allRow;
        } else {
          els.folderList.innerHTML = items.map((folder) => {
          const active = folder.id === state.selectedFolderId ? " active" : "";
          const unreadCount = unreadCountForFolder(folder.id);
          return '' +
            '<button class="folder-row' + active + '" type="button" data-folder-id="' + escapeHtml(folder.id) + '">' +
              '<span class="folder-icon">☰</span>' +
              '<span class="folder-name" title="' + escapeHtml(folder.name) + '">' + escapeHtml(folder.name) + '</span>' +
              '<span class="folder-kind">' + escapeHtml(unreadCount) + '</span>' +
            '</button>';
          }).join("") + allRow;
        }

        els.folderList.querySelectorAll("[data-folder-id]").forEach((node) => {
          node.addEventListener("click", async () => {
            const nextFolderId = node.getAttribute("data-folder-id");
            state.selectedFolderId = nextFolderId === ALL_FOLDER_ID ? null : nextFolderId;
            const nextMessage = visibleMessages()[0] || null;
            setSelectedMessage(nextMessage);
            renderSidebar();
            renderMessages();
            await loadSelectedMessageDetail();
          });
        });
      }

      els.loginButton.addEventListener("click", async () => {
        setStatus(els.loginStatus, "Signing in...");
        try {
          setButtonLoading(els.loginButton, true, "Signing in...");
          const data = await api("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({
              email: els.email.value,
              password: els.password.value,
            }),
          });
          state.user = data.user;
          setStatus(els.loginStatus, "");
          await loadWorkspace();
          renderSession();
        } catch (error) {
          setStatus(els.loginStatus, error.message, "error");
          showToast(error.message, "error");
        } finally {
          setButtonLoading(els.loginButton, false);
        }
      });

      els.logoutButton.addEventListener("click", async () => {
        await api("/api/auth/logout", { method: "POST" });
        state.user = null;
        state.messages = [];
        state.outboundMessages = [];
        state.folders = [];
        state.mailboxes = [];
        state.auditLogs = [];
        state.users = [];
        state.mailboxPermissions = [];
        state.permissionDrafts = {};
        state.permissionSearchQuery = "";
        state.searchQuery = "";
        state.selectedMessageId = null;
        state.selectedMessageType = "inbound";
        state.selectedMessageDetail = null;
        state.selectedFolderId = null;
        els.messageSearch.value = "";
        renderSession();
        renderEmptyDetail();
      });

      els.refreshButton.addEventListener("click", async () => {
        try {
          setButtonLoading(els.refreshButton, true, "...");
          await loadWorkspace();
        } catch (error) {
          els.detailView.innerHTML = '<div class="empty-state">' + escapeHtml(error.message) + '</div>';
          showToast(error.message, "error");
        } finally {
          setButtonLoading(els.refreshButton, false, "...");
        }
      });
`;
