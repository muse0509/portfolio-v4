import type { ZodError } from "zod";

import {
  CONTACT_MAX_BODY_BYTES,
  getCloudflareClientIp,
  hasFilledHoneypot,
  isAllowedContactOrigin,
  isDeclaredBodyTooLarge,
  isJsonContentType,
  parseAllowedHostnames,
} from "./request-security";
import { contactRequestSchema } from "./schema";
import { sendContactEmail } from "./send-contact-email";
import { verifyTurnstile } from "./turnstile";

export type ContactErrorCode =
  | "INVALID_CONTENT_TYPE"
  | "PAYLOAD_TOO_LARGE"
  | "INVALID_REQUEST"
  | "ORIGIN_REJECTED"
  | "VERIFICATION_FAILED"
  | "RATE_LIMITED"
  | "SEND_FAILED";

type ContactEnvironment = {
  CONTACT_ALLOWED_ORIGINS: string | undefined;
  TURNSTILE_SECRET_KEY: string | undefined;
  TURNSTILE_ALLOWED_HOSTNAMES: string | undefined;
  RESEND_API_KEY: string | undefined;
  CONTACT_TO_EMAIL: string | undefined;
  CONTACT_FROM_EMAIL: string | undefined;
};

type ContactHandlerDependencies = {
  environment?: ContactEnvironment;
  fetchImpl?: typeof fetch;
  turnstileTimeoutMs?: number;
  resendTimeoutMs?: number;
};

export async function handleContactRequest(
  request: Request,
  dependencies: ContactHandlerDependencies = {},
): Promise<Response> {
  const environment = dependencies.environment ?? getRuntimeEnvironment();

  if (!isJsonContentType(request.headers.get("Content-Type"))) {
    return errorResponse(
      "INVALID_CONTENT_TYPE",
      "Content-Typeはapplication/jsonを指定してください。",
      415,
    );
  }

  if (
    !isAllowedContactOrigin(
      request.headers.get("Origin"),
      environment.CONTACT_ALLOWED_ORIGINS,
    )
  ) {
    return errorResponse(
      "ORIGIN_REJECTED",
      "この送信元からの問い合わせは受け付けられません。",
      403,
    );
  }

  if (isDeclaredBodyTooLarge(request.headers.get("Content-Length"))) {
    return errorResponse(
      "PAYLOAD_TOO_LARGE",
      "送信内容が大きすぎます。",
      413,
    );
  }

  let rawBody: string;

  try {
    rawBody = await request.text();
  } catch {
    return errorResponse(
      "INVALID_REQUEST",
      "送信内容を読み取れませんでした。",
      400,
    );
  }

  if (new TextEncoder().encode(rawBody).byteLength > CONTACT_MAX_BODY_BYTES) {
    return errorResponse(
      "PAYLOAD_TOO_LARGE",
      "送信内容が大きすぎます。",
      413,
    );
  }

  let payload: unknown;

  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return errorResponse(
      "INVALID_REQUEST",
      "JSON形式の送信内容を確認してください。",
      400,
    );
  }

  if (hasFilledHoneypot(payload)) {
    return successResponse();
  }

  const parsedContact = contactRequestSchema.safeParse(payload);

  if (!parsedContact.success) {
    return errorResponse(
      "INVALID_REQUEST",
      "入力内容を確認してください。",
      400,
      collectFieldErrors(parsedContact.error),
    );
  }

  const clientIp = getCloudflareClientIp(request);
  const verified = await verifyTurnstile({
    token: parsedContact.data.turnstileToken,
    secret: environment.TURNSTILE_SECRET_KEY,
    allowedHostnames: parseAllowedHostnames(
      environment.TURNSTILE_ALLOWED_HOSTNAMES,
    ),
    ...(clientIp ? { remoteIp: clientIp } : {}),
    fetchImpl: dependencies.fetchImpl ?? fetch,
    timeoutMs: dependencies.turnstileTimeoutMs ?? 5_000,
  });

  if (!verified) {
    return errorResponse(
      "VERIFICATION_FAILED",
      "認証を確認できませんでした。もう一度お試しください。",
      403,
    );
  }

  const sent = await sendContactEmail({
    contact: parsedContact.data,
    configuration: {
      apiKey: environment.RESEND_API_KEY,
      to: environment.CONTACT_TO_EMAIL,
      from: environment.CONTACT_FROM_EMAIL,
    },
    fetchImpl: dependencies.fetchImpl ?? fetch,
    timeoutMs: dependencies.resendTimeoutMs ?? 8_000,
  });

  if (!sent) {
    return errorResponse(
      "SEND_FAILED",
      "現在メールを送信できません。時間をおいて再度お試しください。",
      502,
    );
  }

  return successResponse();
}

function getRuntimeEnvironment(): ContactEnvironment {
  return {
    CONTACT_ALLOWED_ORIGINS: process.env.CONTACT_ALLOWED_ORIGINS,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
    TURNSTILE_ALLOWED_HOSTNAMES: process.env.TURNSTILE_ALLOWED_HOSTNAMES,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    CONTACT_TO_EMAIL: process.env.CONTACT_TO_EMAIL,
    CONTACT_FROM_EMAIL: process.env.CONTACT_FROM_EMAIL,
  };
}

function collectFieldErrors(error: ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    if (typeof field !== "string") {
      continue;
    }

    fieldErrors[field] ??= [];
    fieldErrors[field].push(issue.message);
  }

  return fieldErrors;
}

function successResponse(): Response {
  return Response.json(
    { ok: true },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

function errorResponse(
  code: ContactErrorCode,
  message: string,
  status: number,
  fieldErrors: Record<string, string[]> = {},
): Response {
  return Response.json(
    { ok: false, code, message, fieldErrors },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
