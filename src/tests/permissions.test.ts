import { describe, expect, it } from "vitest";
import { hasMailboxPermission } from "../lib/permissions";

describe("permissions", () => {
  it("returns true when the permission exists", () => {
    expect(
      hasMailboxPermission(
        [{ mailboxId: "mbx_1", permission: "reply" }],
        "mbx_1",
        "reply",
      ),
    ).toBe(true);
  });
});
