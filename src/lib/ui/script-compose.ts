export const inboxPageComposeScript = String.raw`
      function openComposeModal() {
        state.composeOpen = true;
        els.composeModal.classList.add("visible");
        els.composeModal.setAttribute("aria-hidden", "false");
        renderComposeFromOptions();
      }

      function closeComposeModal() {
        state.composeOpen = false;
        els.composeModal.classList.remove("visible");
        els.composeModal.setAttribute("aria-hidden", "true");
        resetComposeForm();
      }

      function resetComposeForm() {
        els.composeFromPrefix.value = "";
        els.composeFromDomain.innerHTML = "";
        els.composeTo.value = "";
        els.composeCc.value = "";
        els.composeBcc.value = "";
        els.composeSubject.value = "";
        els.composeText.value = "";
        els.composeAttachments.value = "";
        els.composeAttachmentsList.className = "attachment-list empty";
        els.composeAttachmentsList.textContent = "No files selected.";
        setStatus(els.composeStatus, "");
      }

      function renderComposeFromOptions() {
        const domainMap = new Map();
        for (const mailbox of state.mailboxes) {
          const domain = mailbox.full_address.split("@")[1] || mailbox.full_address;
          if (!domainMap.has(domain)) {
            domainMap.set(domain, { domain, mailboxId: mailbox.id, localPart: mailbox.full_address.split("@")[0] || "" });
          }
        }
        const options = Array.from(domainMap.values());
        els.composeFromDomain.innerHTML = options.map((opt) =>
          '<option value="' + escapeHtml(opt.mailboxId) + '" data-local-part="' + escapeHtml(opt.localPart) + '">' + escapeHtml(opt.domain) + '</option>'
        ).join("");
        if (options[0]) {
          els.composeFromPrefix.value = options[0].localPart;
        }
      }

      els.composeButton.addEventListener("click", openComposeModal);
      els.closeComposeButton.addEventListener("click", closeComposeModal);
      els.composeCancelButton.addEventListener("click", closeComposeModal);
      els.composeModal.addEventListener("click", (event) => {
        if (event.target === els.composeModal) {
          closeComposeModal();
        }
      });

      els.composeAttachments.addEventListener("change", () => {
        const files = Array.from(els.composeAttachments.files || []);
        els.composeAttachmentsList.className = "attachment-list" + (files.length ? "" : " empty");
        els.composeAttachmentsList.innerHTML = files.length
          ? files.map((file) =>
              '<div class="attachment-item"><strong>' + escapeHtml(file.name) + '</strong><span>' + escapeHtml(formatFileSize(file.size)) + '</span></div>',
            ).join("")
          : "No files selected.";
      });

      els.composeSendButton.addEventListener("click", async () => {
        const mailboxId = els.composeFromDomain.value;
        const fromPrefix = els.composeFromPrefix.value.trim();
        const to = els.composeTo.value.trim();
        const cc = els.composeCc.value.trim();
        const bcc = els.composeBcc.value.trim();
        const subject = els.composeSubject.value.trim();
        const textBody = els.composeText.value.trim();
        const attachments = Array.from(els.composeAttachments.files || []);

        if (!to && !cc && !bcc) {
          setStatus(els.composeStatus, "At least one recipient is required.", "error");
          return;
        }
        if (!subject) {
          setStatus(els.composeStatus, "Subject is required.", "error");
          return;
        }
        if (!textBody && attachments.length === 0) {
          setStatus(els.composeStatus, "Please enter a message or attach a file.", "error");
          return;
        }

        const form = new FormData();
        form.set("mailboxId", mailboxId);
        form.set("fromPrefix", fromPrefix);
        form.set("to", to);
        form.set("cc", cc);
        form.set("bcc", bcc);
        form.set("subject", subject);
        form.set("textBody", textBody);
        for (const file of attachments) {
          form.append("attachments", file);
        }

        try {
          setStatus(els.composeStatus, "Sending...");
          setButtonLoading(els.composeSendButton, true);
          await api("/api/messages/send", { method: "POST", body: form });
          setStatus(els.composeStatus, "Message sent.", "success");
          showToast("Message sent.", "success");
          closeComposeModal();
          await loadWorkspace();
        } catch (error) {
          setStatus(els.composeStatus, error.message, "error");
          showToast(error.message, "error");
        } finally {
          setButtonLoading(els.composeSendButton, false);
        }
      });
`;
