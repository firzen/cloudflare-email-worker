export const inboxPageMessagesScript = String.raw`
      function selectedMessage() {
        return visibleMessages().find(
          (message) =>
            message.id === state.selectedMessageId &&
            message.message_type === state.selectedMessageType,
        ) || null;
      }

      function normalizeInboundMessage(message) {
        return { ...message, message_type: "inbound" };
      }

      function normalizeOutboundMessage(message) {
        return { ...message, message_type: "outbound" };
      }

      function normalizedInboundMessages() {
        return state.messages.map(normalizeInboundMessage);
      }

      function normalizedOutboundMessages() {
        return state.outboundMessages.map(normalizeOutboundMessage);
      }

      function normalizedSearchQuery() {
        return state.searchQuery.trim().toLowerCase();
      }

      function compareVisibleMessageByNewest(left, right) {
        const leftTime = String(left.received_at || "");
        const rightTime = String(right.received_at || "");
        const timeComparison = rightTime.localeCompare(leftTime);
        if (timeComparison !== 0) {
          return timeComparison;
        }

        return String(right.id).localeCompare(String(left.id));
      }

      function matchesSearch(message, query) {
        if (!query) return true;

        const searchable = [
          message.from_email,
          message.to_email,
          message.subject,
          message.snippet,
          message.text_body,
          message.html_body,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(query);
      }

      function visibleMessages() {
        const query = normalizedSearchQuery();
        const inbound = normalizedInboundMessages();
        const outbound = normalizedOutboundMessages();

        if (query) {
          return [...inbound, ...outbound]
            .filter((message) => matchesSearch(message, query))
            .sort(compareVisibleMessageByNewest);
        }

        if (state.selectedFolderId === SENT_FOLDER_ID) {
          return outbound.sort(compareVisibleMessageByNewest);
        }

        if (!state.selectedFolderId) {
          return inbound.sort(compareVisibleMessageByNewest);
        }

        return inbound
          .filter((message) => message.folder_id === state.selectedFolderId)
          .sort(compareVisibleMessageByNewest);
      }

      function selectedFolderName() {
        if (normalizedSearchQuery()) return "Search results";
        if (!state.selectedFolderId) return "All";
        const folder = state.folders.find((item) => item.id === state.selectedFolderId);
        return folder ? folder.name : "All";
      }

      function unreadCountForFolder(folderId = null) {
        return normalizedInboundMessages().filter((message) => {
          if (message.is_read) return false;
          if (folderId === null) return true;
          return message.folder_id === folderId;
        }).length;
      }

      function setSelectedMessage(item) {
        state.selectedMessageId = item ? item.id : null;
        state.selectedMessageType = item ? item.message_type : "inbound";
      }

      async function loadSelectedMessageDetail() {
        if (!state.selectedMessageId) {
          state.selectedMessageDetail = null;
          renderEmptyDetail();
          return;
        }

        if (state.selectedMessageType === "outbound") {
          await loadSentMessageDetail(state.selectedMessageId);
          return;
        }

        await loadMessageDetail(state.selectedMessageId);
      }

      function renderMessages() {
        const items = visibleMessages();
        els.listCaption.textContent = normalizedSearchQuery()
          ? items.length + " matching messages across Inbox and Sent"
          : items.length + " visible messages · " + selectedFolderName();

        if (!items.length) {
          els.messageList.innerHTML = '<div class="empty-state">No visible messages yet.</div>';
          return;
        }

        els.messageList.innerHTML = items.map((message) => {
          const active = message.id === state.selectedMessageId && message.message_type === state.selectedMessageType ? " active" : "";
          const unread = message.message_type === "inbound" && !message.is_read ? " unread" : "";
          const badge = message.message_type === "inbound" && !message.is_read ? '<span class="thread-pill">New</span>' : "";
          const counterpart = message.message_type === "outbound" ? message.to_email : message.from_email;
          const preview = message.message_type === "outbound"
            ? escapeHtml(message.snippet || message.from_email || "")
            : escapeHtml(message.to_email || "");
          const meta = message.message_type === "outbound" ? '<span class="thread-meta">Sent</span>' : "";
          return '' +
            '<button class="thread' + active + unread + '" type="button" data-message-id="' + escapeHtml(message.id) + '" data-message-type="' + escapeHtml(message.message_type) + '">' +
              '<div class="thread-main">' +
                '<div class="thread-topline">' +
                  '<span class="thread-sender">' + escapeHtml(counterpart || "") + '</span>' +
                  meta +
                '</div>' +
                '<p class="thread-subject">' + escapeHtml(message.subject || "(no subject)") + '</p>' +
                '<p class="thread-snippet">' + preview + '</p>' +
              '</div>' +
              '<div class="thread-side">' +
                '<span class="thread-time">' + escapeHtml(displayShortTime(message.received_at)) + '</span>' +
                badge +
              '</div>' +
            '</button>';
        }).join("");
      }

      async function loadMessageDetail(messageId) {
        state.detailLoading = true;
        renderDetailLoading();
        try {
          const data = await api("/api/messages/" + encodeURIComponent(messageId));
          state.selectedMessageDetail = { ...data.item, messageType: "inbound" };
          state.detailLoading = false;
          renderDetail(state.selectedMessageDetail);
        } catch (error) {
          state.detailLoading = false;
          state.selectedMessageDetail = null;
          els.detailView.className = "detail-view";
          els.detailView.innerHTML = '<div class="empty-state">' + escapeHtml(error.message) + '</div>';
          showToast(error.message, "error");
        }
      }

      async function loadSentMessageDetail(messageId) {
        state.detailLoading = true;
        renderDetailLoading();
        try {
          const data = await api("/api/messages/sent/" + encodeURIComponent(messageId));
          state.selectedMessageDetail = data.item;
          state.detailLoading = false;
          renderDetail(data.item);
        } catch (error) {
          state.detailLoading = false;
          state.selectedMessageDetail = null;
          els.detailView.className = "detail-view";
          els.detailView.innerHTML = '<div class="empty-state">' + escapeHtml(error.message) + '</div>';
          showToast(error.message, "error");
        }
      }

      function setDetailActions(item) {
        const isInbound = Boolean(item) && item.messageType !== "outbound";
        els.markReadButton.style.display = isInbound ? "inline-flex" : "none";
        els.moveFolderSelect.style.display = isInbound ? "inline-flex" : "none";
        els.moveButton.style.display = isInbound ? "inline-flex" : "none";
        els.deleteButton.style.display = isInbound ? "grid" : "none";

        if (isInbound) {
          els.markReadButton.textContent = item.isRead ? "Mark unread" : "Mark read";
        }
      }

      function renderEmptyDetail() {
        els.threadTitle.textContent = "(no subject)";
        els.threadSubline.textContent = "Select a message to inspect its detail.";
        els.detailView.className = "detail-view";
        els.detailView.innerHTML = '<div class="empty-state">Select a message to load its detail view.</div>';
        setDetailActions(null);
        els.moveFolderSelect.innerHTML = state.folders.map((folder) => {
          if (folder.id === SENT_FOLDER_ID) return "";
          return '<option value="' + escapeHtml(folder.id) + '">' + escapeHtml(folder.name) + '</option>';
        }).join("");
      }

      function renderDetailLoading() {
        els.detailView.className = "detail-view loading";
        els.detailView.innerHTML = '' +
          '<div class="detail-skeleton">' +
            '<div class="skeleton-line skeleton-line-title"></div>' +
            '<div class="skeleton-line"></div>' +
            '<div class="skeleton-line skeleton-line-wide"></div>' +
            '<div class="skeleton-card"></div>' +
          '</div>';
      }

      function renderDetail(item) {
        const folderOptions = state.folders.map((folder) => {
          if (folder.id === SENT_FOLDER_ID) return "";
          const selected = folder.id === item.folderId ? " selected" : "";
          return '<option value="' + escapeHtml(folder.id) + '"' + selected + '>' + escapeHtml(folder.name) + '</option>';
        }).join("");

        const isOutbound = item.messageType === "outbound";

        els.threadTitle.textContent = item.subject || "(no subject)";
        els.threadSubline.textContent = (isOutbound ? "Sent from " : "From ") + item.fromEmail + " to " + item.toEmail + " · " + displayDate(item.receivedAt);
        els.moveFolderSelect.innerHTML = folderOptions;
        els.detailView.className = "detail-view";
        setDetailActions(item);

        const attachmentSection = Array.isArray(item.attachments) && item.attachments.length
          ? '<div class="attachment-list">' + item.attachments.map((attachment) => {
              const downloadUrl = item.messageType === "outbound"
                ? "/api/messages/sent/" + encodeURIComponent(item.id) + "/attachments/" + encodeURIComponent(attachment.id)
                : "/api/messages/" + encodeURIComponent(item.id) + "/attachments/" + encodeURIComponent(attachment.id);
              const downloadLink = '<a href="' + downloadUrl + '" download style="font-size:12px;color:var(--accent);text-decoration:none;" onclick="event.stopPropagation();">Download</a>';
              return '<div class="attachment-item"><strong>' + escapeHtml(attachment.filename) + '</strong><span>' +
                escapeHtml(formatFileSize(attachment.sizeBytes || 0)) + '</span>' + downloadLink + '</div>';
            }).join("") + '</div>'
          : "";

        els.detailView.innerHTML = '' +
          '<article class="message-block">' +
            '<div class="message-inner">' +
              '<div class="message-person">' +
                '<div class="message-avatar">' + escapeHtml(avatarText(item.fromEmail)) + '</div>' +
                '<div>' +
                  '<div class="message-name">' + escapeHtml(item.fromEmail) + '</div>' +
                  '<div class="message-address">' + escapeHtml(item.toEmail) + '</div>' +
                '</div>' +
                '<div class="message-time">' + escapeHtml(displayShortTime(item.receivedAt)) + '</div>' +
              '</div>' +
              '<div class="message-meta-grid">' +
                '<strong>From:</strong><span>' + escapeHtml(item.fromEmail) + '</span>' +
                '<strong>To:</strong><span>' + escapeHtml(item.toEmail) + '</span>' +
                '<strong>Subject:</strong><span>' + escapeHtml(item.subject || "(no subject)") + '</span>' +
                '<strong>Date:</strong><span>' + escapeHtml(displayDate(item.receivedAt)) + '</span>' +
              '</div>' +
              (item.htmlBody
                ? '<div class="message-content message-content-html">' + sanitizeHtml(item.htmlBody) + '</div>'
                : '<div class="message-content">' + escapeHtml(item.textBody || item.snippet || "(empty)") + '</div>') +
              attachmentSection +
            '</div>' +
          '</article>' +
          (isOutbound
            ? '<p class="status" id="detail-status"></p>'
            : '<section class="reply-box">' +
                '<h3>Reply</h3>' +
                '<div class="field">' +
                  '<label for="reply-subject">Subject</label>' +
                  '<input id="reply-subject" value="' + escapeHtml(defaultReplySubject(item.subject || "")) + '">' +
                '</div>' +
                '<div class="field">' +
                  '<label for="reply-text">Plain text</label>' +
                  '<textarea id="reply-text"></textarea>' +
                '</div>' +
                '<div class="field">' +
                  '<label for="reply-attachments">Attachments</label>' +
                  '<input id="reply-attachments" type="file" multiple>' +
                  '<div class="attachment-list empty" id="reply-attachments-list">No files selected.</div>' +
                '</div>' +
                '<div class="reply-box-actions">' +
                  '<button class="primary-button" id="reply-button" type="button" data-loading-label="Sending..." style="width:auto;">Send reply</button>' +
                '</div>' +
                '<p class="status" id="detail-status"></p>' +
              '</section>');

        if (isOutbound) {
          return;
        }

        const replyAttachmentsInput = document.getElementById("reply-attachments");
        const replyAttachmentsList = document.getElementById("reply-attachments-list");
        replyAttachmentsInput.addEventListener("change", () => {
          const files = Array.from(replyAttachmentsInput.files || []);
          replyAttachmentsList.className = "attachment-list" + (files.length ? "" : " empty");
          replyAttachmentsList.innerHTML = files.length
            ? files.map((file) =>
                '<div class="attachment-item"><strong>' + escapeHtml(file.name) + '</strong><span>' + escapeHtml(formatFileSize(file.size)) + '</span></div>',
              ).join("")
            : "No files selected.";
        });

        const replyButton = document.getElementById("reply-button");
        document.getElementById("reply-button").addEventListener("click", async () => {
          const subject = document.getElementById("reply-subject").value;
          const textBody = document.getElementById("reply-text").value;
          const attachments = Array.from(replyAttachmentsInput.files || []);
          const form = new FormData();
          form.set("subject", subject);
          form.set("textBody", textBody);
          for (const file of attachments) {
            form.append("attachments", file);
          }
          await runMessageAction("/api/messages/" + encodeURIComponent(item.id) + "/reply", {
            method: "POST",
            body: form,
          }, "Reply sent.", replyButton);
        });
      }

      async function runMessageAction(path, options, successMessage = "Saved.", button = null) {
        const status = document.getElementById("detail-status");
        try {
          setStatus(status, "Working...");
          setButtonLoading(button, true);
          await api(path, options);
          setStatus(status, successMessage, "success");
          showToast(successMessage, "success");
          await loadWorkspace();
        } catch (error) {
          setStatus(status, error.message, "error");
          showToast(error.message, "error");
        } finally {
          setButtonLoading(button, false);
        }
      }

      els.markReadButton.addEventListener("click", async () => {
        const item = state.selectedMessageDetail;
        if (!item || item.messageType === "outbound") return;
        const path = item.isRead
          ? "/api/messages/" + encodeURIComponent(item.id) + "/unread"
          : "/api/messages/" + encodeURIComponent(item.id) + "/read";
        const successMessage = item.isRead ? "Marked as unread." : "Marked as read.";
        await runMessageAction(path, { method: "POST" }, successMessage, els.markReadButton);
      });

      els.moveButton.addEventListener("click", async () => {
        const item = state.selectedMessageDetail;
        if (!item) return;
        const folderId = els.moveFolderSelect.value;
        await runMessageAction("/api/messages/" + encodeURIComponent(item.id) + "/move", {
          method: "POST",
          body: JSON.stringify({ folderId }),
        }, "Message moved.", els.moveButton);
      });

      els.deleteButton.addEventListener("click", async () => {
        const item = state.selectedMessageDetail;
        if (!item || item.messageType === "outbound") return;
        await runMessageAction("/api/messages/" + encodeURIComponent(item.id) + "/delete", { method: "POST" }, "Moved to Deleted.", els.deleteButton);
      });

      els.messageSearch.addEventListener("input", async () => {
        state.searchQuery = els.messageSearch.value || "";
        const items = visibleMessages();
        if (!items.find((message) => message.id === state.selectedMessageId && message.message_type === state.selectedMessageType)) {
          setSelectedMessage(items[0] || null);
        }
        renderMessages();
        await loadSelectedMessageDetail();
      });

      els.messageList.addEventListener("click", async (event) => {
        const node = event.target.closest("[data-message-id]");
        if (!node) return;
        state.selectedMessageId = node.getAttribute("data-message-id");
        state.selectedMessageType = node.getAttribute("data-message-type") || "inbound";
        renderMessages();
        await loadSelectedMessageDetail();
      });

      renderEmptyDetail();
      boot();
`;
