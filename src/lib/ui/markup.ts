export const inboxPageMarkup = String.raw`
  <body>
    <div class="app-root" id="app-root">
      <div class="toast-region" id="toast-region" aria-live="polite" aria-atomic="true"></div>
      <section class="login-shell" id="login-card">
        <h1>Cloudflare Email Inbox</h1>
        <p>Operate multi-domain inbound mail from one shared workspace. Sign in to triage messages, move them between folders, and manage operator access from settings.</p>
        <div class="field">
          <label for="email">Email</label>
          <input id="email" type="email" autocomplete="username" />
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input id="password" type="password" autocomplete="current-password" />
        </div>
        <button class="primary-button" id="login-button">Open inbox</button>
        <p class="status" id="login-status"></p>
      </section>

      <section class="workspace" id="workspace">
        <main class="shell">
          <aside class="sidebar">
            <div class="sidebar-top">
              <button class="round-button" type="button" id="refresh-button">⟳</button>
              <div class="workspace-chip" id="session-badge">Signed out</div>
            </div>

            <div class="sidebar-search">Shared inbox</div>

            <div class="sidebar-scroll">
              <div class="section-title">Folders</div>
              <div class="folder-list" id="folder-list"></div>
            </div>

            <div class="footer-user">
              <div class="footer-user-main">
                <div class="avatar" id="user-avatar">U</div>
                <div class="user-meta">
                  <strong id="user-name">Unknown</strong>
                  <span id="user-email"></span>
                </div>
              </div>
              <button class="settings-button" id="settings-button" type="button">⚙ Settings</button>
            </div>
          </aside>

          <section class="conversation-pane">
            <div class="conversation-toolbar">
              <label class="search-bar">
                <span>⌕</span>
                <input id="message-search" placeholder="Search mail" />
              </label>
              <button class="primary-button" id="compose-button" type="button" style="width:auto;padding:9px 14px;border-radius:10px;font-size:13px;box-shadow:none;">✎ Compose</button>
            </div>

            <div class="list-head">
              <div>
                <strong>Inbox</strong>
                <span id="list-caption">Recent messages</span>
              </div>
            </div>

            <div class="day-group">
              <div class="day-label">Today</div>
              <div id="message-list"></div>
            </div>
          </section>

          <section class="message-pane">
            <div class="message-toolbar">
              <div class="toolbar-group">
                <button class="toolbar-button" type="button" id="mark-read-button">Mark read</button>
                <select id="move-folder-select" class="toolbar-button" style="padding-right:28px;"></select>
                <button class="toolbar-button" type="button" id="move-button">Move</button>
              </div>
              <div class="toolbar-group" style="margin-left:auto;">
                <button class="tiny-button" type="button" id="delete-button">⌫</button>
                <button class="toolbar-button" type="button" id="permanent-delete-button" style="display:none;">Delete forever</button>
              </div>
            </div>

            <div class="thread-header">
              <h2 class="thread-title" id="thread-title">(no subject)</h2>
              <div class="thread-subline" id="thread-subline">Select a message to inspect its detail.</div>
            </div>

            <div class="detail-view" id="detail-view">
              <div class="empty-state">Select a message to load its detail view.</div>
            </div>
          </section>
        </main>
      </section>

      <div class="modal" id="settings-modal" aria-hidden="true">
        <div class="modal-card">
          <div class="modal-header">
            <div>
              <h2>Settings</h2>
            </div>
            <button class="tiny-button" id="close-settings-button" type="button">✕</button>
          </div>
          <div class="modal-body">
            <div class="settings-tabs" id="settings-tabs" role="tablist" aria-label="Settings sections">
              <button class="settings-tab active" id="settings-tab-workspace" type="button" role="tab" aria-selected="true" data-settings-tab="workspace">Workspace</button>
              <button class="settings-tab" id="settings-tab-activity" type="button" role="tab" aria-selected="false" data-settings-tab="activity">Activity</button>
              <button class="settings-tab" id="settings-tab-users" type="button" role="tab" aria-selected="false" data-settings-tab="users">Users</button>
              <button class="settings-tab" id="settings-tab-sync" type="button" role="tab" aria-selected="false" data-settings-tab="sync">Cloudflare Sync</button>
            </div>

            <div class="settings-panel active" id="settings-panel-workspace" data-settings-panel="workspace" role="tabpanel">
              <section class="modal-section">
                <h3>Workspace</h3>
                <p>Account, permitted mailboxes, and current session controls live here instead of the left rail.</p>
                <div class="settings-grid">
                  <div class="info-row">
                    <div>
                      <strong id="settings-user-name">Unknown</strong>
                      <span id="settings-user-email"></span>
                    </div>
                    <button class="secondary-button" id="logout-button" type="button">Logout</button>
                  </div>
                  <div id="mailbox-summary"></div>
                </div>
              </section>
            </div>

            <div class="settings-panel" id="settings-panel-activity" data-settings-panel="activity" role="tabpanel">
              <section class="modal-section">
                <h3>Activity</h3>
                <p>Recent audit events stay available in settings so the main layout can stay focused on folders and messages.</p>
                <div class="settings-grid" id="audit-list"></div>
              </section>
            </div>

            <div class="settings-panel" id="settings-panel-users" data-settings-panel="users" role="tabpanel">
              <section class="modal-section" id="employees-section">
                <h3>Employees</h3>
                <p>Choose a user to edit their profile and mailbox permissions.</p>
                <div class="settings-grid" id="employee-list"></div>
              </section>

              <section class="modal-section" id="permissions-section">
                <h3>User Editor</h3>
                <p>Edit profile details and mailbox permissions for the selected user. New users are created here too.</p>
                <div class="form-grid compact-form">
                  <div class="field">
                    <label for="user-name-input">Name</label>
                    <div class="field-control">
                      <input id="user-name-input" type="text" placeholder="Full name" />
                    </div>
                  </div>
                  <div class="field">
                    <label for="user-email-input">Email</label>
                    <div class="field-control">
                      <input id="user-email-input" type="email" placeholder="name@example.com" />
                    </div>
                  </div>
                  <div class="field">
                    <label for="user-role-input">Role</label>
                    <div class="field-control">
                      <select id="user-role-input">
                        <option value="operator">operator</option>
                        <option value="admin">admin</option>
                      </select>
                    </div>
                  </div>
                  <div class="field">
                    <label for="user-status-input">Status</label>
                    <div class="field-control">
                      <select id="user-status-input">
                        <option value="active">active</option>
                        <option value="disabled">disabled</option>
                      </select>
                    </div>
                  </div>
                  <div class="field">
                    <label for="user-password-input">Password</label>
                    <div class="field-control">
                      <input id="user-password-input" type="password" placeholder="Leave blank to keep current password" />
                    </div>
                  </div>
                </div>
                <div class="field permission-search compact-form-field">
                  <label for="permission-search-input">Search</label>
                  <div class="field-control">
                    <input id="permission-search-input" type="text" placeholder="Search by mailbox or domain" />
                  </div>
                </div>
                <div class="permission-toolbar">
                  <button class="domain-action" id="permission-bulk-read" type="button">Read</button>
                  <button class="domain-action" id="permission-bulk-reply" type="button">Reply</button>
                  <button class="domain-action" id="permission-bulk-manage" type="button">Manage</button>
                </div>
                <div id="admin-user-list" style="margin-top:12px;"></div>
                <div class="modal-footer-actions">
                  <p class="status" id="admin-status"></p>
                  <div style="display:flex;gap:10px;justify-content:flex-end;">
                    <button class="text-button" id="new-user-button" type="button">New user</button>
                    <button class="text-button" id="delete-user-button" type="button">Disable user</button>
                    <button class="secondary-button" id="save-permissions-button" type="button">Save user</button>
                  </div>
                </div>
              </section>
            </div>

            <div class="settings-panel" id="settings-panel-sync" data-settings-panel="sync" role="tabpanel">
              <section class="modal-section" id="cloudflare-sync-section">
                <h3>Cloudflare Sync</h3>
                <p>Check every active domain and automatically repair Worker catch-all routing plus email sending setup without stopping on single-domain failures.</p>
                <div class="modal-footer-actions">
                  <p class="status" id="cloudflare-sync-status"></p>
                  <button class="secondary-button" id="run-cloudflare-sync-button" type="button">Check and bind domains</button>
                </div>
                <div class="settings-grid" id="cloudflare-sync-results"></div>
              </section>
            </div>
          </div>
        </div>
      </div>

      <div class="modal compose-modal" id="compose-modal" aria-hidden="true">
        <div class="modal-card">
          <div class="modal-header">
            <div>
              <h2>New Message</h2>
            </div>
            <button class="tiny-button" id="close-compose-button" type="button">✕</button>
          </div>
          <div class="modal-body compact-form">
            <div class="field">
              <label>From</label>
              <div class="field-control">
                <div class="compose-from-row">
                  <input id="compose-from-prefix" type="text" placeholder="sam" style="flex:1;" />
                  <span style="color:var(--text-soft);padding:0 4px;">@</span>
                  <select id="compose-from-domain" style="flex:2;"></select>
                </div>
              </div>
            </div>
            <div class="field">
              <label for="compose-to">To</label>
              <div class="field-control">
                <input id="compose-to" type="text" placeholder="recipient@example.com" />
              </div>
            </div>
            <div class="field">
              <label for="compose-cc">Cc</label>
              <div class="field-control">
                <input id="compose-cc" type="text" placeholder="cc@example.com, another@example.com" />
              </div>
            </div>
            <div class="field">
              <label for="compose-bcc">Bcc</label>
              <div class="field-control">
                <input id="compose-bcc" type="text" placeholder="bcc@example.com" />
              </div>
            </div>
            <div class="field">
              <label for="compose-subject">Subject</label>
              <div class="field-control">
                <input id="compose-subject" type="text" placeholder="Subject" required />
              </div>
            </div>
            <div class="field field-multiline">
              <label for="compose-text">Message</label>
              <div class="field-control">
                <textarea id="compose-text" rows="6" placeholder="Type your message here..."></textarea>
              </div>
            </div>
            <div class="field field-multiline">
              <label for="compose-attachments">Attachments</label>
              <div class="field-control">
                <input id="compose-attachments" type="file" multiple />
                <div class="attachment-list empty" id="compose-attachments-list">No files selected.</div>
              </div>
            </div>
            <div style="display:flex;gap:10px;justify-content:flex-end;">
              <button class="secondary-button" id="compose-cancel-button" type="button" style="width:auto;">Cancel</button>
              <button class="primary-button" id="compose-send-button" type="button" data-loading-label="Sending..." style="width:auto;">Send</button>
            </div>
            <p class="status" id="compose-status"></p>
          </div>
        </div>
      </div>
    </div>

`;
