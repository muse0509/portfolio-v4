import { z } from "zod";

export const contactCategories = [
  "product-development",
  "existing-product",
  "solana-web3",
  "engineering-engagement",
  "speaking-media",
  "other",
] as const;

const optionalTrimmedString = (maximum: number, message: string) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    },
    z.string().max(maximum, message).optional(),
  );

const optionalReferenceUrl = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  },
  z
    .string()
    .max(2_048, "参考URLは2,048文字以内で入力してください。")
    .url("参考URLの形式を確認してください。")
    .refine(
      (value) => {
        try {
          const protocol = new URL(value).protocol;
          return protocol === "http:" || protocol === "https:";
        } catch {
          return false;
        }
      },
      { message: "参考URLはhttpまたはhttpsで指定してください。" },
    )
    .optional(),
);

export const contactRequestSchema = z
  .object({
    name: z
      .string("お名前を入力してください。")
      .trim()
      .min(1, "お名前を入力してください。")
      .max(80, "お名前は80文字以内で入力してください。"),
    email: z
      .string("メールアドレスを入力してください。")
      .trim()
      .max(254, "メールアドレスは254文字以内で入力してください。")
      .email("メールアドレスの形式を確認してください。"),
    company: optionalTrimmedString(
      120,
      "会社名・所属は120文字以内で入力してください。",
    ),
    category: z.enum(contactCategories, {
      message: "問い合わせ種別を選択してください。",
    }),
    message: z
      .string("相談内容を入力してください。")
      .trim()
      .min(20, "相談内容は20文字以上で入力してください。")
      .max(4_000, "相談内容は4,000文字以内で入力してください。"),
    startTiming: optionalTrimmedString(
      80,
      "開始時期は80文字以内で入力してください。",
    ),
    availability: optionalTrimmedString(
      80,
      "稼働条件は80文字以内で入力してください。",
    ),
    budget: optionalTrimmedString(
      100,
      "予算は100文字以内で入力してください。",
    ),
    referenceUrl: optionalReferenceUrl,
    privacyAccepted: z.literal(true, {
      message: "プライバシーポリシーへの同意が必要です。",
    }),
    turnstileToken: z
      .string("認証情報がありません。")
      .trim()
      .min(1, "認証情報がありません。")
      .max(2_048, "認証情報が長すぎます。"),
    website: z.string().max(2_048).optional(),
  })
  .strict();

export type ContactRequest = z.infer<typeof contactRequestSchema>;
export type ContactCategory = ContactRequest["category"];
