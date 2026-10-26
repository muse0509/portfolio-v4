import { describe, expect, it } from "vitest";

import type { ContactRequest } from "./schema";
import { buildContactEmail } from "./send-contact-email";

const contact: ContactRequest = {
  name: "Yusuke Kikuta",
  email: "visitor@example.com",
  category: "product-development",
  message: "新規プロダクト開発について相談したいと考えています。",
  privacyAccepted: true,
  turnstileToken: "turnstile-token",
};

const configuration = {
  from: "Portfolio <contact@example.com>",
  to: "inbox@example.com",
};

describe("buildContactEmail", () => {
  it("removes CR/LF and control characters from the subject", () => {
    const email = buildContactEmail(
      { ...contact, name: "Yusuke\r\nBcc: attacker@example.com\u0000" },
      configuration,
    );

    expect(email.subject).toBe(
      "[Portfolio] 新規プロダクト開発 — Yusuke Bcc: attacker@example.com",
    );
    expect(email.subject).not.toMatch(/[\r\n\u0000]/);
  });

  it("does not add empty optional fields to the plain-text body", () => {
    const email = buildContactEmail(contact, configuration);

    expect(email.text).toContain("相談内容:");
    expect(email.text).not.toContain("会社名・所属:");
    expect(email.text).not.toContain("開始時期:");
    expect(email.text).not.toContain("稼働条件:");
    expect(email.text).not.toContain("予算:");
    expect(email.text).not.toContain("参考URL:");
    expect(email).not.toHaveProperty("html");
  });
});
