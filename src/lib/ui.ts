import { findDefaultFolderId, sortFoldersForSidebar } from "./sidebar-folders";

export function renderInboxPage() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Cloudflare Email Inbox</title>
    <style>
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

      .field input,
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
        grid-template-columns: 196px 320px minmax(620px, 1fr);
        height: calc(100vh - 32px);
        background: rgba(255, 255, 255, 0.72);
        border: 1px solid rgba(214, 220, 229, 0.9);
        border-radius: 22px;
        overflow: hidden;
        box-shadow: var(--shadow);
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
        overflow: hidden;
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
        padding: 10px 8px 0;
        display: grid;
        gap: 10px;
      }

      .footer-user-main {
        display: flex;
        align-items: center;
        gap: 10px;
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
        font-weight: 700;
        color: var(--text);
      }

      .thread-meta,
      .thread-mailbox {
        color: var(--text-faint);
      }

      .thread-subject {
        margin: 0 0 2px;
        font-size: 13px;
        font-weight: 600;
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
        overflow: auto;
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
        font-size: 13px;
        line-height: 1.65;
        color: var(--text);
        white-space: pre-wrap;
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
        max-width: 100%;
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
        padding: 14px;
        box-shadow: 0 10px 24px rgba(25, 39, 61, 0.05);
      }

      .reply-box h3 {
        margin: 0 0 10px;
        font-size: 14px;
      }

      .reply-box-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }

      .attachment-list {
        display: grid;
        gap: 8px;
      }

      .attachment-list.empty {
        display: block;
      }

      .attachment-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 12px;
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
        gap: 16px;
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

      .permission-card {
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 12px;
        background: var(--panel-soft);
      }

      .permission-card + .permission-card {
        margin-top: 10px;
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

      @media (max-width: 1360px) {
        .shell {
          grid-template-columns: 180px 280px minmax(520px, 1fr);
        }
      }

      @media (max-width: 1040px) {
        .shell {
          grid-template-columns: 180px 1fr;
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
    </style>
  </head>
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

            <div style="overflow:auto;padding-right:2px;min-height:0;">
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

            <section class="modal-section">
              <h3>Activity</h3>
              <p>Recent audit events stay available in settings so the main layout can stay focused on folders and messages.</p>
              <div class="settings-grid" id="audit-list"></div>
            </section>

            <section class="modal-section" id="permissions-section">
              <h3>Permission Assignment</h3>
              <p>Choose a mailbox and assign read, reply, or manage rights for each employee.</p>
              <div class="field" style="margin-bottom:12px;">
                <label for="admin-mailbox-select">Mailbox</label>
                <select id="admin-mailbox-select"></select>
              </div>
              <div id="admin-user-list"></div>
              <div class="modal-footer-actions">
                <p class="status" id="admin-status"></p>
                <button class="secondary-button" id="save-permissions-button" type="button">Save access</button>
              </div>
            </section>

            <section class="modal-section" id="employees-section">
              <h3>Employees</h3>
              <p>Employee management is surfaced here as an operator directory so admins can review roles before assigning mailbox access.</p>
              <div class="settings-grid" id="employee-list"></div>
            </section>

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

    <script>
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
        searchQuery: "",
        selectedMessageId: null,
        selectedMessageType: "inbound",
        selectedMessageDetail: null,
        detailLoading: false,
        toastTimer: null,
        selectedFolderId: ${JSON.stringify(findDefaultFolderId([
          { id: "fld_inbox", name: "Inbox", kind: "system" },
        ]))},
        selectedAdminMailboxId: null,
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
        settingsButton: document.getElementById("settings-button"),
        settingsModal: document.getElementById("settings-modal"),
        closeSettingsButton: document.getElementById("close-settings-button"),
        logoutButton: document.getElementById("logout-button"),
        mailboxSummary: document.getElementById("mailbox-summary"),
        auditList: document.getElementById("audit-list"),
        permissionsSection: document.getElementById("permissions-section"),
        employeesSection: document.getElementById("employees-section"),
        cloudflareSyncSection: document.getElementById("cloudflare-sync-section"),
        toastRegion: document.getElementById("toast-region"),
        adminMailboxSelect: document.getElementById("admin-mailbox-select"),
        adminUserList: document.getElementById("admin-user-list"),
        savePermissionsButton: document.getElementById("save-permissions-button"),
        adminStatus: document.getElementById("admin-status"),
        employeeList: document.getElementById("employee-list"),
        runCloudflareSyncButton: document.getElementById("run-cloudflare-sync-button"),
        cloudflareSyncStatus: document.getElementById("cloudflare-sync-status"),
        cloudflareSyncResults: document.getElementById("cloudflare-sync-results"),
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
        if (!(options.body instanceof FormData) && !headers["content-type"]) {
          headers["content-type"] = "application/json";
        }

        const res = await fetch(path, {
          headers,
          ...options,
        });

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

      function openSettingsModal() {
        els.settingsModal.classList.add("visible");
        els.settingsModal.setAttribute("aria-hidden", "false");
      }

      function closeSettingsModal() {
        els.settingsModal.classList.remove("visible");
        els.settingsModal.setAttribute("aria-hidden", "true");
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

        const foldersInView = ${sortFoldersForSidebar.toString()}(state.folders);
        if (state.selectedFolderId !== null && !foldersInView.find((folder) => folder.id === state.selectedFolderId)) {
          state.selectedFolderId = ${findDefaultFolderId.toString()}(foldersInView);
        }

        if (state.selectedFolderId === null) {
          state.selectedFolderId = ${findDefaultFolderId.toString()}(foldersInView);
        }

        if (!state.selectedAdminMailboxId && state.mailboxes[0]) {
          state.selectedAdminMailboxId = state.mailboxes[0].id;
        }

        if (state.user && state.user.role === "admin") {
          const users = await api("/api/users");
          state.users = users.items;
          await loadAdminAssignments();
        } else {
          state.users = [];
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
        const items = ${sortFoldersForSidebar.toString()}(state.folders);
        const allRow = '' +
          '<button class="folder-row' + (state.selectedFolderId === null ? " active" : "") + '" type="button" data-folder-id="__all__">' +
            '<span class="folder-icon">◎</span>' +
            '<span class="folder-name" title="All">All</span>' +
            '<span class="folder-kind">ALL</span>' +
          '</button>';

        if (!items.length) {
          els.folderList.innerHTML = allRow;
        } else {
          els.folderList.innerHTML = items.map((folder) => {
          const active = folder.id === state.selectedFolderId ? " active" : "";
          const kind = escapeHtml(folder.kind || "custom");
          return '' +
            '<button class="folder-row' + active + '" type="button" data-folder-id="' + escapeHtml(folder.id) + '">' +
              '<span class="folder-icon">☰</span>' +
              '<span class="folder-name" title="' + escapeHtml(folder.name) + '">' + escapeHtml(folder.name) + '</span>' +
              '<span class="folder-kind">' + kind.slice(0, 3) + '</span>' +
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

      function renderSettings() {
        renderMailboxSummary();
        renderAuditList();
        renderEmployeeList();
        renderPermissionsPanel();
        renderCloudflareSyncPanel();
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
          return '' +
            '<div class="employee-row">' +
              '<div>' +
                '<strong>' + escapeHtml(user.name) + '</strong>' +
                '<span>' + escapeHtml(user.email) + ' · ' + escapeHtml(user.role) + '</span>' +
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
        els.adminMailboxSelect.innerHTML = state.mailboxes.map((mailbox) => {
          const selected = mailbox.id === state.selectedAdminMailboxId ? " selected" : "";
          return '<option value="' + escapeHtml(mailbox.id) + '"' + selected + '>' + escapeHtml(mailbox.full_address) + '</option>';
        }).join("");

        const permissionMap = new Map(
          (state.mailboxPermissions || []).map((entry) => [entry.userId, new Set(entry.permissions)]),
        );

        if (!state.users.length) {
          els.adminUserList.innerHTML = '<div class="permission-card"><strong>No employees found.</strong></div>';
          return;
        }

        els.adminUserList.innerHTML = state.users.map((user) => {
          const granted = permissionMap.get(user.id) || new Set();
          return '' +
            '<div class="permission-card">' +
              '<strong>' + escapeHtml(user.name) + '</strong>' +
              '<div style="font-size:12px;color:var(--text-soft);margin-top:4px;">' + escapeHtml(user.email) + ' · ' + escapeHtml(user.role) + '</div>' +
              '<div class="permission-actions">' +
                renderPermissionToggle(user.id, "read", granted.has("read")) +
                renderPermissionToggle(user.id, "reply", granted.has("reply")) +
                renderPermissionToggle(user.id, "manage", granted.has("manage")) +
              '</div>' +
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

      function renderPermissionToggle(userId, permission, checked) {
        return '<label><input type="checkbox" data-user-id="' + escapeHtml(userId) + '" data-permission="' + escapeHtml(permission) + '"' + (checked ? " checked" : "") + '> ' + escapeHtml(permission) + '</label>';
      }

      async function loadAdminAssignments() {
        if (!state.user || state.user.role !== "admin" || !state.selectedAdminMailboxId) {
          return;
        }

        const data = await api("/api/mailboxes/" + encodeURIComponent(state.selectedAdminMailboxId) + "/permissions");
        state.mailboxPermissions = data.items;
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

      els.settingsButton.addEventListener("click", openSettingsModal);
      els.closeSettingsButton.addEventListener("click", closeSettingsModal);
      els.settingsModal.addEventListener("click", (event) => {
        if (event.target === els.settingsModal) {
          closeSettingsModal();
        }
      });

      els.adminMailboxSelect.addEventListener("change", async () => {
        state.selectedAdminMailboxId = els.adminMailboxSelect.value;
        try {
          await loadAdminAssignments();
          renderPermissionsPanel();
        } catch (error) {
          setStatus(els.adminStatus, error.message, "error");
        }
      });

      els.savePermissionsButton.addEventListener("click", async () => {
        if (!state.selectedAdminMailboxId) return;

        const assignments = state.users.map((user) => {
          const permissions = Array.from(
            document.querySelectorAll('input[data-user-id="' + CSS.escape(user.id) + '"]:checked'),
          ).map((node) => node.getAttribute("data-permission")).filter(Boolean);
          return { userId: user.id, permissions };
        }).filter((entry) => entry.permissions.length > 0);

        try {
          setStatus(els.adminStatus, "Saving...");
          setButtonLoading(els.savePermissionsButton, true, "Saving...");
          await api("/api/mailboxes/" + encodeURIComponent(state.selectedAdminMailboxId) + "/permissions", {
            method: "PUT",
            body: JSON.stringify({ assignments }),
          });
          await loadAdminAssignments();
          renderPermissionsPanel();
          setStatus(els.adminStatus, "Access updated.", "success");
          showToast("Access updated.", "success");
        } catch (error) {
          setStatus(els.adminStatus, error.message, "error");
          showToast(error.message, "error");
        } finally {
          setButtonLoading(els.savePermissionsButton, false, "Saving...");
        }
      });

      els.runCloudflareSyncButton.addEventListener("click", async () => {
        try {
          setStatus(els.cloudflareSyncStatus, "Checking Cloudflare...");
          setButtonLoading(els.runCloudflareSyncButton, true, "Checking...");
          const result = await api("/api/users/cloudflare-sync", {
            method: "POST",
            body: JSON.stringify({}),
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
    </script>
  </body>
</html>`;
}
