import { describe, expect, it } from "vitest";
import { isAllowedEmail, parseAllowedEmails } from "@/lib/allowlist";

describe("allowlist", () => {
  const raw = " Rob@Example.com , hannah@example.com,, ";

  it("parses, trims and lowercases", () => {
    expect([...parseAllowedEmails(raw)]).toEqual([
      "rob@example.com",
      "hannah@example.com",
    ]);
  });

  it.each([
    ["rob@example.com", true],
    ["ROB@example.com", true],
    ["  hannah@example.com ", true],
    ["someone@example.com", false],
    ["", false],
    [null, false],
    [undefined, false],
  ])("isAllowedEmail(%j) -> %s", (email, expected) => {
    expect(isAllowedEmail(email, raw)).toBe(expected);
  });

  it("denies everyone when the variable is unset", () => {
    expect(isAllowedEmail("rob@example.com", undefined)).toBe(false);
    expect(isAllowedEmail("rob@example.com", "")).toBe(false);
  });
});
