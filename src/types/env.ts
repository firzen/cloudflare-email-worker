export type OutboundEmailPayload = {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
  attachments?: OutboundEmailAttachment[];
};

export type OutboundEmailAttachment = {
  filename: string;
  content: ArrayBuffer;
  type?: string;
  disposition?: string;
};

export type EmailSender = {
  send: (payload: OutboundEmailPayload) => Promise<
    { id?: string; messageId?: string } | void
  >;
};

export type Env = {
  DB: D1Database;
  RAW_EMAILS: R2Bucket;
  ATTACHMENTS: R2Bucket;
  APP_SESSIONS: KVNamespace;
  APP_SECRET: string;
  EMAIL: EmailSender;
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  CLOUDFLARE_WORKER_NAME: string;
  BOOTSTRAP_ADMIN_USER_ID?: string;
};
