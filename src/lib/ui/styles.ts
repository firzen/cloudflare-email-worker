export const inboxPageStyles = String.raw`
      :root {
        color-scheme: light;
        --app-bg: #edf1f5;
        --surface: #fbfcfd;
        --panel: #ffffff;
        --panel-soft: #f6f7f9;
        --panel-muted: #f1f3f6;
        --line: #e3e7ee;
        --line-strong: #d6dce5;
        --text: #303744;
        --text-soft: #697386;
        --text-faint: #9aa4b2;
        --accent: #3d7df6;
        --accent-soft: #eaf2ff;
        --accent-line: #b9d1ff;
        --danger: #ff8f58;
        --success: #29a56c;
        --shadow: 0 10px 30px rgba(25, 39, 61, 0.06);
        --radius-lg: 18px;
        --radius-md: 12px;
        --radius-sm: 8px;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background:
          radial-gradient(circle at top left, rgba(61, 125, 246, 0.08), transparent 26%),
          linear-gradient(180deg, #f8fafc 0%, var(--app-bg) 100%);
        color: var(--text);
        font-family: "Inter", "SF Pro Text", "Segoe UI", sans-serif;
      }

      button,
      input,
      select,
      textarea {
        font: inherit;
      }

      button {
        cursor: pointer;
      }

      .app-root {
        padding: 16px;
      }

      .toast-region {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 30;
        display: grid;
        gap: 10px;
        pointer-events: none;
        opacity: 0;
        transform: translateY(-8px);
        transition: opacity 160ms ease, transform 160ms ease;
      }

      .toast-region.visible {
        opacity: 1;
        transform: translateY(0);
      }

      .toast {
        min-width: 280px;
        max-width: 420px;
        padding: 12px 14px;
        border-radius: 14px;
        border: 1px solid var(--line-strong);
        background: rgba(255, 255, 255, 0.96);
        box-shadow: 0 16px 34px rgba(25, 39, 61, 0.16);
        color: var(--text);
        font-size: 13px;
        line-height: 1.45;
      }

      .toast-success {
        border-color: rgba(41, 165, 108, 0.28);
      }

      .toast-error {
        border-color: rgba(191, 74, 34, 0.24);
      }

      .login-shell {
        max-width: 460px;
        margin: 10vh auto 0;
        padding: 28px;
        border-radius: 22px;
        background: rgba(255, 255, 255, 0.92);
        border: 1px solid rgba(214, 220, 229, 0.9);
        box-shadow: var(--shadow);
      }

      .login-shell h1 {
        margin: 0 0 10px;
        font-size: 34px;
        letter-spacing: -0.05em;
      }

      .login-shell p {
        margin: 0 0 18px;
        color: var(--text-soft);
        line-height: 1.55;
      }

      .field {
        display: grid;
        gap: 8px;
        margin-bottom: 14px;
      }

      .field label {
        font-size: 12px;
        color: var(--text-soft);
      }

      .field input:not([type="checkbox"]):not([type="radio"]) ,
      .field textarea,
      .field select {
        width: 100%;
        border: 1px solid var(--line-strong);
        border-radius: 12px;
        padding: 12px 14px;
        background: white;
        color: var(--text);
      }

      .field textarea {
        min-height: 110px;
        resize: vertical;
      }

      .compact-form {
        display: grid;
        gap: 10px;
      }

      .compact-form .field {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 0;
      }

      .compact-form .field-multiline {
        align-items: flex-start;
      }

      .compact-form .field label {
        width: 84px;
        flex: 0 0 84px;
        padding-top: 9px;
        color: var(--text-soft);
        white-space: nowrap;
      }

      .compact-form .field-multiline label {
        padding-top: 11px;
      }

      .compact-form .field-control {
        flex: 1;
        min-width: 0;
        display: grid;
        gap: 8px;
      }

      .compact-form-field {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 0;
      }

      .compact-form-field label {
        width: 84px;
        flex: 0 0 84px;
        color: var(--text-soft);
        white-space: nowrap;
      }

      .compact-form-field .field-control {
        flex: 1;
        min-width: 0;
      }

      .compact-form-field input:not([type="checkbox"]):not([type="radio"]),
      .compact-form-field textarea,
      .compact-form-field select {
        border-radius: 10px;
        padding: 9px 11px;
      }

      .compact-form input:not([type="checkbox"]):not([type="radio"]),
      .compact-form textarea,
      .compact-form select {
        border-radius: 10px;
        padding: 9px 11px;
      }

      .compact-form textarea {
        min-height: 88px;
      }

      .status {
        min-height: 20px;
        margin: 0;
        font-size: 12px;
        color: var(--text-soft);
      }

      .status.error {
        color: #bf4a22;
      }

      .status.success {
        color: var(--success);
      }

      .primary-button,
      .secondary-button,
      .toolbar-button,
      .tiny-button,
      .round-button,
      .ghost-button,
      .settings-button,
      .folder-row,
      .thread,
      .field input,
      .field textarea,
      .field select,
      .search-bar {
        border: 1px solid var(--line);
        background: white;
        color: var(--text-soft);
        transition:
          transform 140ms ease,
          box-shadow 160ms ease,
          border-color 160ms ease,
          background-color 160ms ease,
          color 160ms ease,
          opacity 160ms ease;
      }

      .primary-button {
        width: 100%;
        padding: 12px 16px;
        border-radius: 12px;
        background: var(--accent);
        border-color: var(--accent);
        color: white;
        font-weight: 700;
        box-shadow: 0 12px 24px rgba(61, 125, 246, 0.2);
      }

      .secondary-button,
      .ghost-button {
        border-radius: 10px;
        padding: 10px 12px;
      }

      .primary-button:hover,
      .secondary-button:hover,
      .toolbar-button:hover,
      .tiny-button:hover,
      .round-button:hover,
      .settings-button:hover {
        box-shadow: 0 10px 20px rgba(25, 39, 61, 0.08);
      }

      .primary-button:active,
      .secondary-button:active,
      .toolbar-button:active,
      .tiny-button:active,
      .round-button:active,
      .settings-button:active,
      .folder-row:active,
      .thread:active {
        transform: translateY(1px) scale(0.99);
      }

      button.is-loading {
        cursor: progress;
      }

      button:disabled {
        opacity: 0.68;
        cursor: not-allowed;
        transform: none;
      }

      .workspace {
        display: none;
      }

      .workspace.visible {
        display: block;
      }

      .shell {
        display: grid;
        grid-template-columns: 220px 320px minmax(620px, 1fr);
        height: calc(100vh - 32px);
        background: rgba(255, 255, 255, 0.72);
        border: 1px solid rgba(214, 220, 229, 0.9);
        border-radius: 22px;
        overflow: hidden;
        box-shadow: var(--shadow);
      }

      .shell > * {
        min-width: 0;
        min-height: 0;
      }

      .sidebar,
      .conversation-pane,
      .message-pane {
        border-right: 1px solid var(--line);
      }

      .sidebar {
        background: linear-gradient(180deg, #f7f8fa 0%, #f3f5f8 100%);
        padding: 12px 10px 10px;
        display: grid;
        grid-template-rows: auto auto 1fr auto;
        gap: 12px;
        overflow: visible;
      }

      .sidebar-top {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 4px 0;
      }

      .round-button {
        width: 28px;
        height: 28px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        font-size: 13px;
      }

      .workspace-chip {
        margin-left: auto;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 9px;
        border-radius: 999px;
        background: white;
        border: 1px solid var(--line);
        font-size: 12px;
        color: var(--text-soft);
      }

      .sidebar-search {
        margin: 0 4px;
        padding: 10px 12px;
        border-radius: 10px;
        background: var(--panel-muted);
        font-size: 13px;
        color: var(--text-faint);
      }

      .section-title {
        padding: 8px 8px 6px;
        font-size: 11px;
        color: var(--text-faint);
      }

      .folder-list {
        display: grid;
        gap: 2px;
        padding: 2px 6px 4px 2px;
      }

      .sidebar-scroll {
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        padding-right: 2px;
      }

      .folder-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        border: 1px solid transparent;
        border-radius: 9px;
        background: transparent;
        font-size: 13px;
        color: var(--text-soft);
        text-align: left;
      }

      .folder-row:hover {
        background: rgba(255, 255, 255, 0.72);
        border-color: rgba(214, 220, 229, 0.9);
      }

      .folder-row.active {
        background: #eef3fb;
        border-color: #d8e5ff;
        box-shadow: 0 8px 18px rgba(61, 125, 246, 0.08);
        color: var(--text);
      }

      .folder-icon {
        width: 14px;
        text-align: center;
        color: var(--text-faint);
        flex: 0 0 14px;
      }

      .folder-name {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        min-width: 0;
      }

      .folder-kind {
        margin-left: auto;
        min-width: 22px;
        padding: 0 6px;
        height: 18px;
        border-radius: 999px;
        background: #edf1f6;
        display: grid;
        place-items: center;
        font-size: 10px;
        font-weight: 700;
        color: var(--text-faint);
        text-transform: uppercase;
        flex-shrink: 0;
      }

      .footer-user {
        border-top: 1px solid var(--line);
        padding: 12px 10px 2px;
        display: grid;
        gap: 10px;
        min-width: 0;
        background: linear-gradient(180deg, rgba(243, 245, 248, 0.15) 0%, #f3f5f8 28%);
      }

      .footer-user-main {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }

      .avatar {
        width: 28px;
        height: 28px;
        border-radius: 999px;
        background: linear-gradient(135deg, #d6e4ff 0%, #bdd1ff 100%);
        color: #2958a7;
        font-size: 12px;
        font-weight: 700;
        display: grid;
        place-items: center;
      }

      .user-meta {
        min-width: 0;
        flex: 1;
      }

      .user-meta strong {
        display: block;
        font-size: 12px;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .user-meta span {
        display: block;
        font-size: 11px;
        color: var(--text-faint);
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .settings-button {
        width: 100%;
        height: 36px;
        border-radius: 10px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        background: white;
        color: var(--text);
        font-weight: 600;
      }

      .conversation-pane,
      .message-pane {
        background: var(--surface);
        min-width: 0;
        min-height: 0;
      }

      .conversation-pane {
        display: grid;
        grid-template-rows: auto auto 1fr;
        background: linear-gradient(180deg, #fbfcfd 0%, #f8fafc 100%);
        overflow: hidden;
      }

      .conversation-toolbar,
      .message-toolbar {
        padding: 10px 12px;
        border-bottom: 1px solid var(--line);
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .search-bar {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 9px 10px;
        border-radius: 10px;
        background: var(--panel-muted);
        border: 1px solid transparent;
        color: var(--text-faint);
        font-size: 13px;
      }

      .search-bar:focus-within,
      .field input:focus,
      .field textarea:focus,
      .field select:focus {
        outline: none;
        border-color: var(--accent-line);
        box-shadow: 0 0 0 4px rgba(61, 125, 246, 0.12);
      }

      .search-bar input {
        width: 100%;
        border: 0;
        outline: none;
        background: transparent;
        color: var(--text);
      }

      .tiny-button {
        width: 28px;
        height: 28px;
        border-radius: 8px;
        display: grid;
        place-items: center;
        font-size: 12px;
      }

      .list-head {
        padding: 10px 12px;
        border-bottom: 1px solid var(--line);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      .list-head strong {
        display: block;
        font-size: 14px;
      }

      .list-head span {
        font-size: 11px;
        color: var(--text-faint);
      }

      .day-group {
        overflow: auto;
        min-height: 0;
      }

      .day-label {
        padding: 8px 12px;
        font-size: 11px;
        color: var(--text-faint);
      }

      .thread {
        position: relative;
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 8px;
        margin: 0;
        padding: 9px 10px 9px 14px;
        border: 0;
        border-left: 2px solid transparent;
        border-radius: 0;
        background: rgba(255, 255, 255, 0.72);
        text-align: left;
        width: 100%;
      }

      .thread + .thread {
        border-top: 1px solid rgba(227, 231, 238, 0.7);
      }

      .thread:hover {
        background: rgba(246, 248, 252, 0.96);
      }

      .thread.active {
        background: linear-gradient(180deg, #4a88f6 0%, #3c79ec 100%);
        color: white;
        border-left-color: #235fcb;
      }

      .thread.active .thread-meta,
      .thread.active .thread-snippet,
      .thread.active .thread-time,
      .thread.active .thread-subject,
      .thread.active .thread-topline,
      .thread.active .thread-mailbox {
        color: rgba(255, 255, 255, 0.95);
      }

      .thread.active .thread-pill {
        background: rgba(255, 255, 255, 0.16);
        color: white;
      }

      .thread.unread .thread-sender,
      .thread.unread .thread-subject {
        font-weight: 700;
      }

      .thread-main {
        min-width: 0;
      }

      .thread-topline {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 3px;
        font-size: 12px;
        color: var(--text-soft);
      }

      .thread-sender {
        font-weight: 600;
        color: var(--text);
      }

      .thread-meta,
      .thread-mailbox {
        color: var(--text-faint);
      }

      .thread-subject {
        margin: 0 0 2px;
        font-size: 13px;
        color: var(--text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .thread-snippet {
        margin: 0;
        font-size: 12px;
        line-height: 1.35;
        color: var(--text-soft);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .thread-side {
        display: grid;
        justify-items: end;
        align-content: start;
        gap: 6px;
      }

      .thread-time {
        font-size: 11px;
        color: var(--text-faint);
      }

      .thread-pill {
        min-width: 18px;
        height: 18px;
        padding: 0 5px;
        border-radius: 999px;
        background: #ecf0f7;
        display: grid;
        place-items: center;
        font-size: 10px;
        font-weight: 700;
        color: var(--text-soft);
      }

      .empty-state {
        margin: 12px;
        padding: 14px;
        border-radius: 12px;
        border: 1px dashed var(--line-strong);
        color: var(--text-soft);
        font-size: 13px;
      }

      .message-pane {
        display: grid;
        grid-template-rows: auto auto 1fr;
        background: linear-gradient(180deg, #fdfefe 0%, #f7f9fc 100%);
        overflow: hidden;
      }

      .toolbar-group {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .toolbar-button {
        height: 30px;
        padding: 0 10px;
        border-radius: 9px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
      }

      .thread-header {
        padding: 16px 18px 12px;
        border-bottom: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.72);
      }

      .thread-title {
        margin: 0;
        font-size: 28px;
        line-height: 1.05;
        font-weight: 500;
        letter-spacing: -0.04em;
      }

      .thread-subline {
        margin-top: 6px;
        font-size: 12px;
        color: var(--text-faint);
      }

      .detail-view {
        overflow-y: auto;
        overflow-x: hidden;
        min-height: 0;
        padding: 12px 14px 18px;
        background: #f8fafc;
        opacity: 1;
        transform: translateY(0);
        transition: opacity 180ms ease, transform 180ms ease;
      }

      .detail-view.loading {
        opacity: 0.82;
      }

      .detail-skeleton {
        display: grid;
        gap: 12px;
        padding: 4px;
      }

      .skeleton-line,
      .skeleton-card {
        border-radius: 12px;
        background: linear-gradient(90deg, #eef2f7 0%, #f8fafd 45%, #eef2f7 100%);
        background-size: 200% 100%;
        animation: shimmer 1.2s linear 3;
      }

      .skeleton-line {
        height: 16px;
      }

      .skeleton-line-title {
        width: 38%;
        height: 26px;
      }

      .skeleton-line-wide {
        width: 82%;
      }

      .skeleton-card {
        height: 260px;
        margin-top: 6px;
      }

      @keyframes shimmer {
        0% {
          background-position: 200% 0;
        }

        100% {
          background-position: -200% 0;
        }
      }

      .message-block {
        background: white;
        border: 1px solid var(--line);
        border-radius: 16px;
        overflow: hidden;
      }

      .message-inner {
        padding: 12px 14px;
      }

      .message-person {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 10px;
        align-items: start;
      }

      .message-avatar {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: #e6edf7;
        display: grid;
        place-items: center;
        color: #4c6180;
        font-size: 12px;
        font-weight: 700;
      }

      .message-name {
        font-size: 13px;
        font-weight: 700;
      }

      .message-name span {
        font-weight: 500;
        color: var(--text-soft);
      }

      .message-address {
        margin-top: 3px;
        font-size: 12px;
        color: var(--text-soft);
      }

      .message-time {
        font-size: 11px;
        color: var(--text-faint);
        white-space: nowrap;
      }

      .message-meta-grid {
        margin-top: 10px;
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 6px 10px;
        font-size: 12px;
        color: var(--text-soft);
      }

      .message-meta-grid strong {
        color: var(--text-faint);
        font-weight: 500;
      }

      .message-content {
        margin-top: 12px;
        padding-right: 6px;
        font-size: 13px;
        line-height: 1.65;
        color: var(--text);
        white-space: pre-wrap;
        word-break: break-word;
      }

      .message-content-html {
        white-space: normal;
      }

      .message-content-html img,
      .message-content-html video {
        max-width: 100%;
        height: auto;
      }

      .message-content-html table {
        display: block;
        max-width: 100%;
        overflow-x: auto;
        border-collapse: collapse;
      }

      .message-content-html pre {
        overflow-x: auto;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .message-content-html blockquote {
        margin: 0 0 0 8px;
        padding-left: 12px;
        border-left: 3px solid var(--line-strong);
        color: var(--text-soft);
      }

      .message-content-html a {
        color: var(--accent);
      }

      .message-actions {
        display: flex;
        gap: 10px;
        padding: 8px 12px;
        border-top: 1px solid var(--line);
        background: #fcfdff;
      }

      .action-pill {
        font-size: 12px;
        color: var(--text-soft);
      }

      .reply-box {
        margin-top: 12px;
        background: white;
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 12px;
        box-shadow: 0 10px 24px rgba(25, 39, 61, 0.05);
      }

      .reply-box h3 {
        margin: 0 0 8px;
        font-size: 14px;
      }

      .reply-box-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 4px;
      }

      .attachment-list {
        display: grid;
        gap: 6px;
      }

      .attachment-list.empty {
        display: block;
      }

      .attachment-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 8px 10px;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: var(--panel-soft);
        font-size: 12px;
        color: var(--text-soft);
      }

      .attachment-item strong {
        color: var(--text);
      }

      .modal {
        position: fixed;
        inset: 0;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: rgba(30, 42, 58, 0.35);
        backdrop-filter: blur(8px);
      }

      .modal.visible {
        display: flex;
      }

      .modal-card {
        width: min(960px, 100%);
        max-height: 85vh;
        background: rgba(255, 255, 255, 0.96);
        border: 1px solid var(--line-strong);
        border-radius: 20px;
        box-shadow: 0 24px 50px rgba(18, 29, 46, 0.18);
        overflow: hidden;
        display: grid;
        grid-template-rows: auto 1fr;
      }

      .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 16px 18px;
        border-bottom: 1px solid var(--line);
      }

      .modal-header h2 {
        margin: 0;
        font-size: 20px;
        letter-spacing: -0.03em;
      }

      .modal-body {
        overflow: auto;
        padding: 18px;
        display: grid;
        gap: 12px;
      }

      .modal-section {
        border: 1px solid var(--line);
        border-radius: 16px;
        background: white;
        padding: 16px;
      }

      .modal-section h3 {
        margin: 0 0 8px;
        font-size: 15px;
      }

      .modal-section p {
        margin: 0 0 12px;
        font-size: 13px;
        color: var(--text-soft);
        line-height: 1.55;
      }

      .settings-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 4px;
      }

      .settings-tab {
        padding: 9px 14px;
        border-radius: 999px;
        border: 1px solid var(--line);
        background: var(--panel-soft);
        color: var(--text-soft);
        font-size: 13px;
        font-weight: 600;
      }

      .settings-tab.active {
        background: var(--accent-soft);
        border-color: var(--accent-line);
        color: var(--accent);
        box-shadow: 0 10px 18px rgba(61, 125, 246, 0.12);
      }

      .settings-panel {
        display: none;
        gap: 16px;
      }

      .settings-panel.active {
        display: grid;
      }

      .settings-grid {
        display: grid;
        gap: 12px;
      }

      .info-row,
      .employee-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 12px;
        border-radius: 12px;
        background: var(--panel-soft);
        font-size: 13px;
      }

      .info-row strong,
      .employee-row strong {
        display: block;
        font-size: 13px;
        color: var(--text);
      }

      .info-row span,
      .employee-row span {
        display: block;
        font-size: 12px;
        color: var(--text-soft);
      }

      .employee-row.active {
        border: 1px solid rgba(59, 130, 246, 0.28);
        box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.18);
      }

      .employee-actions {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .permission-card {
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 10px 12px;
        background: var(--panel-soft);
      }

      .permission-card + .permission-card {
        margin-top: 8px;
      }

      .permission-search {
        margin-top: 12px;
      }

      .permission-toolbar {
        margin-top: 10px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .domain-group {
        border: 1px solid var(--line);
        border-radius: 12px;
        background: white;
        overflow: hidden;
      }

      .domain-group + .domain-group {
        margin-top: 10px;
      }

      .domain-group-header {
        padding: 10px 12px;
        background: #fbfcfe;
        border-bottom: 1px solid var(--line);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      .domain-group-title {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }

      .domain-group-title strong {
        font-size: 14px;
      }

      .domain-group-title span {
        font-size: 12px;
        color: var(--text-soft);
      }

      .domain-action {
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid var(--line);
        background: var(--panel-soft);
        color: var(--text-soft);
        font-size: 12px;
        font-weight: 600;
      }

      .domain-group-body {
        padding: 10px 12px;
        background: white;
      }

      .domain-mailbox-list {
        display: grid;
        gap: 8px;
      }

      #mailbox-summary {
        max-height: 100px;
        overflow-y: auto;
      }

      .mailbox-checklist {
        display: grid;
        gap: 8px;
        max-height: 160px;
        overflow-y: auto;
        padding: 10px 12px;
        border-radius: 12px;
        background: var(--panel-soft);
        border: 1px solid var(--line);
      }

      .mailbox-checklist-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: var(--text);
        cursor: pointer;
      }

      .mailbox-checklist-item input[type="checkbox"] {
        cursor: pointer;
      }

      .mailbox-select-actions {
        display: flex;
        gap: 12px;
        margin-top: 8px;
      }

      .mailbox-select-actions .text-button {
        font-size: 12px;
        color: var(--primary);
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
      }

      .mailbox-select-actions .text-button:hover {
        text-decoration: underline;
      }

      .permission-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 10px;
      }

      .permission-actions label {
        font-size: 12px;
        color: var(--text-soft);
      }

      .modal-footer-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        margin-top: 12px;
      }

      .form-grid {
        display: grid;
        gap: 12px;
      }

      .compose-modal .modal-card {
        width: min(640px, 100%);
      }

      .compose-from-row {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .compose-from-row input,
      .compose-from-row select {
        width: 100%;
        border: 1px solid var(--line-strong);
        border-radius: 10px;
        padding: 9px 11px;
        background: white;
        color: var(--text);
      }

      @media (max-width: 1360px) {
        .shell {
          grid-template-columns: 204px 280px minmax(520px, 1fr);
        }
      }

      @media (max-width: 1040px) {
        .shell {
          grid-template-columns: 204px 1fr;
        }

        .message-pane {
          display: none;
        }
      }

      @media (max-width: 760px) {
        .app-root {
          padding: 8px;
        }

        .shell {
          grid-template-columns: 1fr;
          min-height: calc(100vh - 16px);
        }

        .sidebar {
          display: none;
        }

        .modal {
          padding: 10px;
        }
      }
`;
