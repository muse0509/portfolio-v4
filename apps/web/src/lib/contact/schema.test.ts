import { describe, expect, it } from "vitest";

import { contactRequestSchema } from "./schema";

const validPayload = {
  name: "Yusuke Kikuta",
  email: "visitor@example.com",
  category: "product-development",
  message: "新規プロダクト開発について相談したいと考えています。",
  privacyAccepted: true,
  turnstileToken: "turnstile-token",
} as const;

describe("contactRequestSchema", () => {
  it("accepts required fields and their allowed length boundaries", () => {
    const referenceUrlPrefix = "https://example.com/?q=";
    const result = contactRequestSchema.safeParse({
      ...validPayload,
      name: "名".repeat(80),
      company: "会".repeat(120),
      message: "相".repeat(4_000),
      startTiming: "時".repeat(80),
      availability: "稼".repeat(80),
      budget: "予".repeat(100),
      referenceUrl:
        referenceUrlPrefix + "a".repeat(2_048 - referenceUrlPrefix.length),
      turnstileToken: "t".repeat(2_048),
    });

    expect(result.success).toBe(true);
  });

  it.each([
    ["name", "名".repeat(81)],
    ["email", `${"a".repeat(243)}@example.com`],
    ["company", "会".repeat(121)],
    ["message", "相".repeat(4_001)],
    ["startTiming", "時".repeat(81)],
    ["availability", "稼".repeat(81)],
    ["budget", "予".repeat(101)],
    ["turnstileToken", "t".repeat(2_049)],
  ])("rejects %s above its maximum length", (field, value) => {
    expect(
      contactRequestSchema.safeParse({ ...validPayload, [field]: value }).success,
    ).toBe(false);
  });

  it("rejects missing or invalid required fields", () => {
    const result = contactRequestSchema.safeParse({
      ...validPayload,
      name: "   ",
      email: "invalid-email",
      message: "19文字未満",
      privacyAccepted: false,
      turnstileToken: "",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path[0]);
      expect(paths).toEqual(
        expect.arrayContaining([
          "name",
          "email",
          "message",
          "privacyAccepted",
          "turnstileToken",
        ]),
      );
    }
  });

  it("rejects unknown fields and non-http reference URLs", () => {
    expect(
      contactRequestSchema.safeParse({ ...validPayload, admin: true }).success,
    ).toBe(false);
    expect(
      contactRequestSchema.safeParse({
        ...validPayload,
        referenceUrl: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });

  it("trims input and omits blank optional fields", () => {
    const result = contactRequestSchema.parse({
      ...validPayload,
      name: "  Yusuke Kikuta  ",
      company: "   ",
      referenceUrl: "   ",
    });

    expect(result.name).toBe("Yusuke Kikuta");
    expect(result.company).toBeUndefined();
    expect(result.referenceUrl).toBeUndefined();
  });
});
