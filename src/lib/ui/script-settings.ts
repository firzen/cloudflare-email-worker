export const inboxPageSettingsScript = String.raw`
      function openSettingsModal() {
        ensureVisibleSettingsTab();
        renderSettingsTabs();
        els.settingsModal.classList.add("visible");
        els.settingsModal.setAttribute("aria-hidden", "false");
      }

      function closeSettingsModal() {
        els.settingsModal.classList.remove("visible");
        els.settingsModal.setAttribute("aria-hidden", "true");
      }

      function renderSettings() {
        ensureVisibleSettingsTab();
        renderSettingsTabs();
        renderMailboxSummary();
        renderAuditList();
        renderEmployeeList();
        renderPermissionsPanel();
        renderCloudflareSyncPanel();
        renderLoginBrandingPanel();
      }

      function availableSettingsTabs() {
        if (state.user && state.user.role === "admin") {
          return ["workspace", "activity", "users", "sync", "login"];
        }

        return ["workspace", "activity"];
      }

      function ensureVisibleSettingsTab() {
        const available = availableSettingsTabs();
        if (!available.includes(state.settingsTab)) {
          state.settingsTab = available[0] || "workspace";
        }
      }

      function renderSettingsTabs() {
        const available = new Set(availableSettingsTabs());
        document.querySelectorAll("[data-settings-tab]").forEach((button) => {
          const tab = button.getAttribute("data-settings-tab");
          const isVisible = available.has(tab);
          const isActive = state.settingsTab === tab;
          button.style.display = isVisible ? "inline-flex" : "none";
          button.classList.toggle("active", isActive);
          button.setAttribute("aria-selected", isActive ? "true" : "false");
        });

        document.querySelectorAll("[data-settings-panel]").forEach((panel) => {
          const tab = panel.getAttribute("data-settings-panel");
          const isActive = state.settingsTab === tab && available.has(tab);
          panel.classList.toggle("active", isActive);
        });
      }

      function renderMailboxSummary() {
        if (!state.mailboxes.length) {
          els.mailboxSummary.innerHTML = '<div class="info-row"><div><strong>No permitted mailboxes</strong><span>Mailbox access will appear here.</span></div></div>';
          return;
        }

        els.mailboxSummary.innerHTML = state.mailboxes.map((mailbox) => {
          return '' +
            '<div class="info-row">' +
              '<div>' +
                '<strong>' + escapeHtml(mailbox.full_address) + '</strong>' +
                '<span>' + escapeHtml(mailbox.id) + '</span>' +
              '</div>' +
            '</div>';
        }).join("");
      }

      function resetPasswordForm() {
        els.currentPasswordInput.value = "";
        els.newPasswordInput.value = "";
        els.confirmPasswordInput.value = "";
      }

      function renderAuditList() {
        if (!state.auditLogs.length) {
          els.auditList.innerHTML = '<div class="info-row"><div><strong>No audit entries yet</strong><span>Activity will appear here once operators start working mail.</span></div></div>';
          return;
        }

        els.auditList.innerHTML = state.auditLogs.slice(0, 8).map((log) => {
          return '' +
            '<div class="info-row">' +
              '<div>' +
                '<strong>' + escapeHtml(log.action) + '</strong>' +
                '<span>' + escapeHtml(displayDate(log.createdAt)) + '</span>' +
              '</div>' +
            '</div>';
        }).join("");
      }

      function renderEmployeeList() {
        if (!state.user || state.user.role !== "admin") {
          els.employeesSection.style.display = "none";
          return;
        }

        els.employeesSection.style.display = "block";

        if (!state.users.length) {
          els.employeeList.innerHTML = '<div class="employee-row"><div><strong>No employees found</strong><span>User records will appear here.</span></div></div>';
          return;
        }

        els.employeeList.innerHTML = state.users.map((user) => {
          const active = user.id === state.selectedUserId ? " active" : "";
          const statusText = user.status === "disabled" ? "disabled" : user.role;
          return '' +
            '<div class="employee-row' + active + '">' +
              '<div>' +
                '<strong>' + escapeHtml(user.name) + '</strong>' +
                '<span>' + escapeHtml(user.email) + ' · ' + escapeHtml(user.role) + ' · ' + escapeHtml(statusText) + '</span>' +
              '</div>' +
              '<div class="employee-actions">' +
                '<button class="text-button" type="button" data-edit-user-id="' + escapeHtml(user.id) + '">Edit</button>' +
              '</div>' +
            '</div>';
        }).join("");
      }

      function renderPermissionsPanel() {
        if (!state.user || state.user.role !== "admin") {
          els.permissionsSection.style.display = "none";
          return;
        }

        els.permissionsSection.style.display = "block";
        const user = state.editingUser;
        if (!user) {
          els.userNameInput.value = "";
          els.userEmailInput.value = "";
          els.userRoleInput.value = "operator";
          els.userStatusInput.value = "active";
          els.userPasswordInput.value = "";
          els.permissionSearchInput.value = state.permissionSearchQuery;
          els.adminUserList.innerHTML = '<div class="permission-card"><strong>Select a user or click New user.</strong></div>';
          els.deleteUserButton.disabled = true;
          return;
        }

        els.userNameInput.value = user.name || "";
        els.userEmailInput.value = user.email || "";
        els.userRoleInput.value = user.role || "operator";
        els.userStatusInput.value = user.status || "active";
        els.userPasswordInput.value = "";
        els.permissionSearchInput.value = state.permissionSearchQuery;
        els.deleteUserButton.disabled = !user.id;

        if (!state.mailboxes.length) {
          els.adminUserList.innerHTML = '<div class="permission-card"><strong>No mailboxes available.</strong></div>';
          return;
        }

        const groups = visiblePermissionDomainGroups();
        if (!groups.length) {
          els.adminUserList.innerHTML = '<div class="permission-card"><strong>No matching mailboxes.</strong><div style="font-size:12px;color:var(--text-soft);margin-top:4px;">Try another search keyword.</div></div>';
          return;
        }

        els.adminUserList.innerHTML = groups.map((group) => {
          return '' +
            '<div class="domain-group">' +
              '<div class="domain-group-header">' +
                '<div class="domain-group-title">' +
                  '<div>' +
                    '<strong>' + escapeHtml(group.domain) + '</strong>' +
                    '<span>' + escapeHtml(group.mailboxes.length) + ' mailbox' + (group.mailboxes.length === 1 ? '' : 'es') + '</span>' +
                  '</div>' +
                '</div>' +
              '</div>' +
              '<div class="domain-group-body"><div class="domain-mailbox-list">' + group.mailboxes.map((mailbox) => {
                  const granted = permissionDraftSet(mailbox.id);
                  return '' +
                    '<div class="permission-card">' +
                      '<strong>' + escapeHtml(mailbox.full_address) + '</strong>' +
                      '<div style="font-size:12px;color:var(--text-soft);margin-top:3px;">' + escapeHtml(mailbox.id) + '</div>' +
                      '<div class="permission-actions">' +
                        renderPermissionToggle(mailbox.id, "read", granted.has("read")) +
                        renderPermissionToggle(mailbox.id, "reply", granted.has("reply")) +
                        renderPermissionToggle(mailbox.id, "manage", granted.has("manage")) +
                      '</div>' +
                    '</div>';
                }).join("") + '</div></div>' +
            '</div>';
        }).join("");
      }

      function renderCloudflareSyncPanel() {
        if (!state.user || state.user.role !== "admin") {
          els.cloudflareSyncSection.style.display = "none";
          return;
        }

        els.cloudflareSyncSection.style.display = "block";
      }

      function renderLoginBrandingPanel() {
        if (!state.user || state.user.role !== "admin") {
          els.loginBrandingSection.style.display = "none";
          return;
        }
        els.loginBrandingSection.style.display = "block";
        const login = state.loginBranding || {};
        els.loginTitleInput.value = login.title || "";
        els.loginDescriptionInput.value = login.description || "";
      }

      function renderCloudflareSyncResults(result) {
        const items = Array.isArray(result.items) ? result.items : [];
        const failed = items.filter((item) => item.status === "failed");

        els.cloudflareSyncResults.innerHTML = '' +
          '<div class="info-row"><div><strong>' + escapeHtml(result.succeededDomains) + ' succeeded / ' + escapeHtml(result.totalDomains) + ' total</strong><span>' +
          escapeHtml(result.failedDomains) + ' failed</span></div></div>' +
          (failed.length
            ? failed.map((item) => {
                return '<div class="permission-card"><strong>' + escapeHtml(item.domain) + '</strong><div style="font-size:12px;color:var(--text-soft);margin-top:4px;">' +
                  escapeHtml(item.failedStep || "unknown") + ' · ' + escapeHtml(item.error || "Unknown error.") + '</div></div>';
              }).join("")
            : '<div class="info-row"><div><strong>All domains are in sync.</strong><span>No repair action is pending.</span></div></div>');
      }

      function renderPermissionToggle(mailboxId, permission, checked) {
        return '<label><input type="checkbox" data-mailbox-id="' + escapeHtml(mailboxId) + '" data-permission="' + escapeHtml(permission) + '"' + (checked ? " checked" : "") + '> ' + escapeHtml(permission) + '</label>';
      }

      function mailboxDomain(mailbox) {
        return String(mailbox.full_address || "").split("@")[1] || String(mailbox.full_address || "");
      }

      function normalizePermissionDrafts(items) {
        const drafts = {};
        for (const entry of items || []) {
          drafts[entry.mailboxId] = Array.from(new Set((entry.permissions || []).filter(Boolean)));
        }
        return drafts;
      }

      function permissionDraftSet(mailboxId) {
        return new Set(state.permissionDrafts[mailboxId] || []);
      }

      function visiblePermissionDomainGroups() {
        const query = state.permissionSearchQuery.trim().toLowerCase();
        const groups = new Map();

        for (const mailbox of state.mailboxes) {
          const domain = mailboxDomain(mailbox);
          const haystack = [mailbox.full_address, mailbox.id, domain].filter(Boolean).join(" ").toLowerCase();
          if (query && !haystack.includes(query)) {
            continue;
          }

          if (!groups.has(domain)) {
            groups.set(domain, []);
          }
          groups.get(domain).push(mailbox);
        }

        return Array.from(groups.entries())
          .sort((left, right) => left[0].localeCompare(right[0]))
          .map(([domain, mailboxes]) => ({
            domain,
            mailboxes: mailboxes.sort((left, right) => String(left.full_address || "").localeCompare(String(right.full_address || ""))),
          }));
      }

      function visiblePermissionMailboxIds() {
        return visiblePermissionDomainGroups().flatMap((group) => group.mailboxes.map((mailbox) => mailbox.id));
      }

      function updatePermissionDraft(mailboxId, permission, checked) {
        const next = new Set(state.permissionDrafts[mailboxId] || []);
        if (checked) {
          next.add(permission);
        } else {
          next.delete(permission);
        }

        state.permissionDrafts[mailboxId] = Array.from(next);
      }

      function setVisiblePermission(permission, checked) {
        visiblePermissionMailboxIds().forEach((mailboxId) => {
          updatePermissionDraft(mailboxId, permission, checked);
        });
      }

      function allVisiblePermissionSelected(permission) {
        const mailboxIds = visiblePermissionMailboxIds();
        if (!mailboxIds.length) return false;
        return mailboxIds.every((mailboxId) => permissionDraftSet(mailboxId).has(permission));
      }

      function toggleVisiblePermission(permission) {
        setVisiblePermission(permission, !allVisiblePermissionSelected(permission));
      }

      async function loadSelectedUserEditor() {
        if (!state.user || state.user.role !== "admin") {
          state.mailboxPermissions = [];
          state.editingUser = null;
          state.permissionDrafts = {};
          state.permissionSearchQuery = "";
          return;
        }

        if (!state.selectedUserId) {
          state.editingUser = {
            id: "",
            name: "",
            email: "",
            role: "operator",
            status: "active",
          };
          state.mailboxPermissions = [];
          state.permissionDrafts = {};
          state.permissionSearchQuery = "";
          return;
        }

        const [userDetail, permissions] = await Promise.all([
          api("/api/users/" + encodeURIComponent(state.selectedUserId)),
          api("/api/users/" + encodeURIComponent(state.selectedUserId) + "/permissions"),
        ]);
        state.editingUser = userDetail.user;
        state.mailboxPermissions = permissions.items;
        state.permissionDrafts = normalizePermissionDrafts(permissions.items);
        state.permissionSearchQuery = "";
      }

      els.settingsButton.addEventListener("click", openSettingsModal);
      els.closeSettingsButton.addEventListener("click", closeSettingsModal);
      els.settingsModal.addEventListener("click", (event) => {
        if (event.target === els.settingsModal) {
          closeSettingsModal();
        }
      });

      els.settingsTabs.addEventListener("click", (event) => {
        const button = event.target.closest("[data-settings-tab]");
        if (!button) return;

        const nextTab = button.getAttribute("data-settings-tab");
        if (!nextTab || nextTab === state.settingsTab) return;
        state.settingsTab = nextTab;
        renderSettingsTabs();
      });

      els.employeeList.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-edit-user-id]");
        if (!button) return;

        state.selectedUserId = button.getAttribute("data-edit-user-id");

        try {
          setStatus(els.adminStatus, "");
          await loadSelectedUserEditor();
          renderEmployeeList();
          renderPermissionsPanel();
        } catch (error) {
          setStatus(els.adminStatus, error.message, "error");
        }
      });

      els.newUserButton.addEventListener("click", () => {
        state.selectedUserId = null;
        state.editingUser = {
          id: "",
          name: "",
          email: "",
          role: "operator",
          status: "active",
        };
        state.mailboxPermissions = [];
        state.permissionDrafts = {};
        state.permissionSearchQuery = "";
        setStatus(els.adminStatus, "Creating a new user.");
        renderEmployeeList();
        renderPermissionsPanel();
      });

      els.changePasswordButton.addEventListener("click", async () => {
        try {
          setStatus(els.passwordStatus, "Updating password...");
          setButtonLoading(els.changePasswordButton, true, "Updating...");
          await api("/api/auth/password", {
            method: "POST",
            body: JSON.stringify({
              currentPassword: els.currentPasswordInput.value,
              newPassword: els.newPasswordInput.value,
              confirmPassword: els.confirmPasswordInput.value,
            }),
          });
          resetPasswordForm();
          setStatus(els.passwordStatus, "Password updated.", "success");
          showToast("Password updated.", "success");
        } catch (error) {
          setStatus(els.passwordStatus, error.message, "error");
          showToast(error.message, "error");
        } finally {
          setButtonLoading(els.changePasswordButton, false, "Updating...");
        }
      });

      els.savePermissionsButton.addEventListener("click", async () => {
        const user = state.editingUser;
        if (!user) return;

        const payload = {
          email: els.userEmailInput.value,
          name: els.userNameInput.value,
          role: els.userRoleInput.value,
          status: els.userStatusInput.value,
          password: els.userPasswordInput.value,
        };

        const assignments = state.mailboxes.map((mailbox) => ({
          mailboxId: mailbox.id,
          permissions: Array.from(new Set((state.permissionDrafts[mailbox.id] || []).filter(Boolean))),
        })).filter((entry) => entry.permissions.length > 0);

        try {
          setStatus(els.adminStatus, "Saving...");
          setButtonLoading(els.savePermissionsButton, true, "Saving...");
          let savedUserId = user.id;

          if (savedUserId) {
            await api("/api/users/" + encodeURIComponent(savedUserId), {
              method: "PUT",
              body: JSON.stringify(payload),
            });
          } else {
            const created = await api("/api/users", {
              method: "POST",
              body: JSON.stringify({
                email: payload.email,
                name: payload.name,
                role: payload.role,
                password: payload.password,
              }),
            });
            savedUserId = created.user.id;
          }

          await api("/api/users/" + encodeURIComponent(savedUserId) + "/permissions", {
            method: "PUT",
            body: JSON.stringify({ assignments }),
          });

          state.selectedUserId = savedUserId;
          await loadWorkspace();
          renderPermissionsPanel();
          const msg = user.id ? "User updated." : "User created.";
          setStatus(els.adminStatus, msg, "success");
          showToast(msg, "success");
        } catch (error) {
          setStatus(els.adminStatus, error.message, "error");
          showToast(error.message, "error");
        } finally {
          setButtonLoading(els.savePermissionsButton, false, "Saving...");
        }
      });

      els.permissionSearchInput.addEventListener("input", (event) => {
        state.permissionSearchQuery = event.target.value || "";
        renderPermissionsPanel();
      });

      els.adminUserList.addEventListener("change", (event) => {
        const checkbox = event.target.closest('input[type="checkbox"][data-mailbox-id][data-permission]');
        if (!checkbox) return;

        updatePermissionDraft(
          checkbox.getAttribute("data-mailbox-id"),
          checkbox.getAttribute("data-permission"),
          checkbox.checked,
        );
      });

      els.permissionBulkReadButton.addEventListener("click", () => {
        toggleVisiblePermission("read");
        renderPermissionsPanel();
      });

      els.permissionBulkReplyButton.addEventListener("click", () => {
        toggleVisiblePermission("reply");
        renderPermissionsPanel();
      });

      els.permissionBulkManageButton.addEventListener("click", () => {
        toggleVisiblePermission("manage");
        renderPermissionsPanel();
      });

      els.deleteUserButton.addEventListener("click", async () => {
        if (!state.selectedUserId) return;

        try {
          setStatus(els.adminStatus, "Disabling...");
          setButtonLoading(els.deleteUserButton, true, "Disabling...");
          await api("/api/users/" + encodeURIComponent(state.selectedUserId), {
            method: "DELETE",
          });
          state.selectedUserId = null;
          await loadWorkspace();
          setStatus(els.adminStatus, "User disabled.", "success");
          showToast("User disabled.", "success");
        } catch (error) {
          setStatus(els.adminStatus, error.message, "error");
          showToast(error.message, "error");
        } finally {
          setButtonLoading(els.deleteUserButton, false, "Disabling...");
        }
      });

      els.runCloudflareSyncButton.addEventListener("click", async () => {
        try {
          setStatus(els.cloudflareSyncStatus, "Checking Cloudflare...");
          setButtonLoading(els.runCloudflareSyncButton, true, "Checking...");
          const result = await api("/api/users/cloudflare-sync", {
            method: "POST",
          });
          renderCloudflareSyncResults(result);
          await loadWorkspace();
          setStatus(
            els.cloudflareSyncStatus,
            "Sync completed. " + result.succeededDomains + " succeeded, " + result.failedDomains + " failed.",
            result.failedDomains ? "error" : "success",
          );
          showToast(
            "Sync completed. " + result.succeededDomains + " succeeded, " + result.failedDomains + " failed.",
            result.failedDomains ? "error" : "success",
          );
        } catch (error) {
          setStatus(els.cloudflareSyncStatus, error.message, "error");
          showToast(error.message, "error");
        } finally {
          setButtonLoading(els.runCloudflareSyncButton, false, "Checking...");
        }
      });

      els.saveLoginBrandingButton.addEventListener("click", async () => {
        try {
          setStatus(els.loginBrandingStatus, "Saving...");
          setButtonLoading(els.saveLoginBrandingButton, true, "Saving...");
          const result = await api("/api/settings/login", {
            method: "PUT",
            body: JSON.stringify({
              title: els.loginTitleInput.value,
              description: els.loginDescriptionInput.value,
            }),
          });
          state.loginBranding = result.login;
          setStatus(els.loginBrandingStatus, "Login page updated.", "success");
          showToast("Login page updated.", "success");
        } catch (error) {
          setStatus(els.loginBrandingStatus, error.message, "error");
          showToast(error.message, "error");
        } finally {
          setButtonLoading(els.saveLoginBrandingButton, false, "Saving...");
        }
      });
`;
