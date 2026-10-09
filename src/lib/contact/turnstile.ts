import { z } from "zod";

const TURNSTILE_SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const turnstileResponseSchema = z.object({
  success: z.boolean(),
  action: z.string().optional(),
  hostname: z.string().optional(),
});

type VerifyTurnstileOptions = {
  token: string;
  secret: string | undefined;
  allowedHostnames: readonly string[] | null;
  remoteIp?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export async function verifyTurnstile({
  token,
  secret,
  allowedHostnames,
  remoteIp,
  fetchImpl = fetch,
  timeoutMs = 5_000,
}: VerifyTurnstileOptions): Promise<boolean> {
  if (!secret || !allowedHostnames || allowedHostnames.length === 0) {
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(TURNSTILE_SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret,
        response: token,
        ...(remoteIp ? { remoteip: remoteIp } : {}),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      await response.body?.cancel();
      return false;
    }

    const result = turnstileResponseSchema.safeParse(await response.json());

    return (
      result.success &&
      result.data.success === true &&
      result.data.action === "contact" &&
      typeof result.data.hostname === "string" &&
      allowedHostnames.includes(result.data.hostname)
    );
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
