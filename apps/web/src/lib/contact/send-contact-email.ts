import { z } from "zod";

import type { ContactCategory, ContactRequest } from "./schema";

const RESEND_EMAILS_URL = "https://api.resend.com/emails";

export const contactCategoryLabels = {
  "product-development": "新規プロダクト開発",
  "existing-product": "既存プロダクトの改善",
  "solana-web3": "Solana・Web3開発",
  "engineering-engagement": "技術支援・開発体制",
  "speaking-media": "登壇・取材",
  other: "その他",
} as const satisfies Record<ContactCategory, string>;

const emailAddressSchema = z.string().trim().max(254).email();

type ResendConfiguration = {
  apiKey: string | undefined;
  to: string | undefined;
  from: string | undefined;
};

type SendContactEmailOptions = {
  contact: ContactRequest;
  configuration: ResendConfiguration;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export type ContactEmail = {
  from: string;
  to: string;
  reply_to: string;
  subject: string;
  text: string;
};

export function sanitizeSubjectValue(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f\u0085\u2028\u2029]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function buildContactEmail(
  contact: ContactRequest,
  configuration: { from: string; to: string },
): ContactEmail {
  const lines = [
    "Portfolioサイトから問い合わせが届きました。",
    "",
    `問い合わせ種別: ${contactCategoryLabels[contact.category]}`,
    `お名前: ${contact.name}`,
    `メールアドレス: ${contact.email}`,
  ];

  const optionalLines: Array<[string, string | undefined]> = [
    ["会社名・所属", contact.company],
    ["開始時期", contact.startTiming],
    ["稼働条件", contact.availability],
    ["予算", contact.budget],
    ["参考URL", contact.referenceUrl],
  ];

  for (const [label, value] of optionalLines) {
    if (value) {
      lines.push(`${label}: ${value}`);
    }
  }

  lines.push("", "相談内容:", contact.message);

  return {
    from: configuration.from,
    to: configuration.to,
    reply_to: contact.email,
    subject: `[Portfolio] ${contactCategoryLabels[contact.category]} — ${sanitizeSubjectValue(contact.name)}`,
    text: lines.join("\n"),
  };
}

export async function sendContactEmail({
  contact,
  configuration,
  fetchImpl = fetch,
  timeoutMs = 8_000,
}: SendContactEmailOptions): Promise<boolean> {
  const parsedConfiguration = parseResendConfiguration(configuration);

  if (!parsedConfiguration) {
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(RESEND_EMAILS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${parsedConfiguration.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        buildContactEmail(contact, {
          from: parsedConfiguration.from,
          to: parsedConfiguration.to,
        }),
      ),
      signal: controller.signal,
    });

    const succeeded = response.status >= 200 && response.status < 300;
    await response.body?.cancel();
    return succeeded;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function parseResendConfiguration(
  configuration: ResendConfiguration,
): { apiKey: string; to: string; from: string } | null {
  const apiKey = configuration.apiKey?.trim();
  const to = configuration.to?.trim();
  const from = configuration.from?.trim();

  if (
    !apiKey ||
    apiKey.length > 512 ||
    !to ||
    !emailAddressSchema.safeParse(to).success ||
    !from ||
    from.length > 320 ||
    !isValidFromAddress(from)
  ) {
    return null;
  }

  return { apiKey, to, from };
}

function isValidFromAddress(value: string): boolean {
  if (/[\r\n]/.test(value)) {
    return false;
  }

  const angleAddress = /^([^<>]{1,100})\s+<([^<>]+)>$/.exec(value);
  const address = angleAddress?.[2] ?? value;
  return emailAddressSchema.safeParse(address).success;
}
