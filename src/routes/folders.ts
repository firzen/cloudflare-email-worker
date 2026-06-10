import { Hono } from "hono";
import type { Env } from "../types/env";

type AppVariables = {
  userId: string | null;
};

export const foldersRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

const VIRTUAL_SENT_FOLDER = { id: "fld_sent", name: "Sent", kind: "system" } as const;
type FolderRow = { id: string; name: string; kind: string };

foldersRouter.get("/", async (c) => {
  const userId = c.get("userId");

  if (!userId) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
      401,
    );
  }

  const result = await c.env.DB.prepare(
    `
      SELECT id, name, kind
      FROM folders
      ORDER BY name ASC
    `,
  )
    .bind()
    .all<FolderRow>();

  const items: FolderRow[] = [...(result.results ?? [])];

  if (!items.find((folder) => folder.id === VIRTUAL_SENT_FOLDER.id)) {
    items.push(VIRTUAL_SENT_FOLDER);
  }

  items.sort((left, right) => left.name.localeCompare(right.name));

  return c.json({ items });
});
