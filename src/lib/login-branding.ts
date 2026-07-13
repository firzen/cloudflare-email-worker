export const defaultLoginBranding = {
  title: "Cloudflare Email Inbox",
  description:
    "Operate multi-domain inbound mail from one shared workspace. Sign in to triage messages, move them between folders, and manage operator access from settings.",
} as const;

type LoginBrandingRow = {
  setting_key: string;
  setting_value: string;
};

export type LoginBranding = {
  title: string;
  description: string;
};

export async function getLoginBranding(db?: D1Database): Promise<LoginBranding> {
  if (!db) return { ...defaultLoginBranding };

  try {
    const settings = await db
      .prepare(
        `
          SELECT setting_key, setting_value
          FROM app_settings
          WHERE setting_key IN ('login_title', 'login_description')
        `,
      )
      .bind()
      .all<LoginBrandingRow>();
    const values = new Map((settings.results ?? []).map((item) => [item.setting_key, item.setting_value]));

    return {
      title: values.get("login_title") || defaultLoginBranding.title,
      description: values.get("login_description") ?? defaultLoginBranding.description,
    };
  } catch {
    // Allows the Worker to serve the default login page until its D1 migration is applied.
    return { ...defaultLoginBranding };
  }
}
