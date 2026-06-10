import { describe, expect, it } from "vitest";
import { findDefaultFolderId, sortFoldersForSidebar } from "../lib/sidebar-folders";

describe("sidebar folders", () => {
  it("places Inbox first and Sent near the top", () => {
    const result = sortFoldersForSidebar([
      { id: "fld_archived", name: "Archived", kind: "system" },
      { id: "fld_sent", name: "Sent", kind: "system" },
      { id: "fld_inbox", name: "Inbox", kind: "system" },
      { id: "fld_deleted", name: "Deleted", kind: "system" },
    ]);

    expect(result.map((folder) => folder.name)).toEqual([
      "Inbox",
      "Sent",
      "Archived",
      "Deleted",
    ]);
  });

  it("defaults to Inbox when available", () => {
    const result = findDefaultFolderId([
      { id: "fld_archived", name: "Archived", kind: "system" },
      { id: "fld_inbox", name: "Inbox", kind: "system" },
    ]);

    expect(result).toBe("fld_inbox");
  });

  it("falls back to All when Inbox is unavailable", () => {
    const result = findDefaultFolderId([
      { id: "fld_archived", name: "Archived", kind: "system" },
      { id: "fld_deleted", name: "Deleted", kind: "system" },
    ]);

    expect(result).toBeNull();
  });
});
