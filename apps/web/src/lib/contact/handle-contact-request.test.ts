import { describe, expect, it, vi } from "vitest";

import { handleContactRequest } from "./handle-contact-request";

const environment = {
  CONTACT_ALLOWED_ORIGINS: "https://portfolio.example",
  TURNSTILE_SECRET_KEY: "turnstile-secret",
  TURNSTILE_ALLOWED_HOSTNAMES: "portfolio.example",
  RESEND_API_KEY: "re_example",
  CONTACT_TO_EMAIL: "inbox@example.com",
  CONTACT_FROM_EMAIL: "Portfolio <contact@example.com>",
};

const validPayload = {
  name: "Yusuke Kikuta",
  email: "visitor@example.com",
  category: "product-development",
  message: "新規プロダクト開発について相談したいと考えています。",
  privacyAccepted: true,
  turnstileToken: "turnstile-token",
};

type ProviderFetchOptions = {
  turnstileResponse?: unknown;
  turnstileInvalidJson?: boolean;
  resendStatus?: number;
  resendNetworkError?: boolean;
};

function makeRequest(
  body: unknown = validPayload,
  options: {
    contentType?: string;
    origin?: string | null;
    rawBody?: string;
    includeIp?: boolean;
  } = {},
): Request {
  const headers = new Headers();
  headers.set("Content-Type", options.contentType ?? "application/json");

  if (options.origin !== null) {
    headers.set("Origin", options.origin ?? "https://portfolio.example");
  }

  if (options.includeIp !== false) {
    headers.set("CF-Connecting-IP", "203.0.113.10");
  }

  return new Request("https://portfolio.example/api/contact", {
    method: "POST",
    headers,
    body: options.rawBody ?? JSON.stringify(body),
  });
}

function createProviderFetch({
  turnstileResponse = {
    success: true,
    action: "contact",
    hostname: "portfolio.example",
  },
  turnstileInvalidJson = false,
  resendStatus = 200,
  resendNetworkError = false,
}: ProviderFetchOptions = {}) {
  return vi.fn(
    async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      const url = String(input);

      expect(init?.method).toBe("POST");

      if (url.includes("/turnstile/v0/siteverify")) {
        if (turnstileInvalidJson) {
          return new Response("{invalid-json", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        return Response.json(turnstileResponse);
      }

      if (resendNetworkError) {
        throw new Error("network unavailable");
      }

      return Response.json(
        resendStatus >= 200 && resendStatus < 300
          ? { id: "email-id" }
          : { message: "provider error" },
        { status: resendStatus },
      );
    },
  );
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe("handleContactRequest", () => {
  it("verifies Turnstile and sends a plain-text Resend email", async () => {
    const fetchMock = createProviderFetch();
    const response = await handleContactRequest(makeRequest(), {
      environment,
      fetchImpl: fetchMock,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(readJson(response)).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const turnstileRequest = JSON.parse(
      String(fetchMock.mock.calls[0]?.[1]?.body),
    ) as Record<string, unknown>;
    expect(turnstileRequest).toMatchObject({
      secret: "turnstile-secret",
      response: "turnstile-token",
      remoteip: "203.0.113.10",
    });

    const resendRequest = JSON.parse(
      String(fetchMock.mock.calls[1]?.[1]?.body),
    ) as Record<string, unknown>;
    expect(resendRequest).toMatchObject({
      from: "Portfolio <contact@example.com>",
      to: "inbox@example.com",
      reply_to: "visitor@example.com",
    });
    expect(resendRequest).not.toHaveProperty("html");
  });

  it("rejects a non-JSON Content-Type before external calls", async () => {
    const fetchMock = createProviderFetch();
    const response = await handleContactRequest(
      makeRequest(validPayload, { contentType: "text/plain" }),
      { environment, fetchImpl: fetchMock },
    );

    expect(response.status).toBe(415);
    await expect(readJson(response)).resolves.toMatchObject({
      ok: false,
      code: "INVALID_CONTENT_TYPE",
      fieldErrors: {},
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a UTF-8 body above 10KB before JSON parsing", async () => {
    const fetchMock = createProviderFetch();
    const response = await handleContactRequest(
      makeRequest(undefined, { rawBody: "あ".repeat(3_414) }),
      { environment, fetchImpl: fetchMock },
    );

    expect(response.status).toBe(413);
    await expect(readJson(response)).resolves.toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON", async () => {
    const fetchMock = createProviderFetch();
    const response = await handleContactRequest(
      makeRequest(undefined, { rawBody: "{not-json" }),
      { environment, fetchImpl: fetchMock },
    );

    expect(response.status).toBe(400);
    await expect(readJson(response)).resolves.toMatchObject({
      code: "INVALID_REQUEST",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    { origin: null, scenario: "missing" },
    { origin: "https://attacker.example", scenario: "different" },
  ])("rejects a $scenario Origin", async ({ origin }) => {
    const fetchMock = createProviderFetch();
    const response = await handleContactRequest(
      makeRequest(validPayload, { origin }),
      { environment, fetchImpl: fetchMock },
    );

    expect(response.status).toBe(403);
    await expect(readJson(response)).resolves.toMatchObject({
      code: "ORIGIN_REJECTED",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a simulated success for a filled honeypot without external calls", async () => {
    const fetchMock = createProviderFetch();
    const response = await handleContactRequest(
      makeRequest({ ...validPayload, website: "https://spam.example" }),
      { environment, fetchImpl: fetchMock },
    );

    expect(response.status).toBe(200);
    await expect(readJson(response)).resolves.toEqual({ ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input and rejects unknown fields", async () => {
    const fetchMock = createProviderFetch();
    const response = await handleContactRequest(
      makeRequest({ ...validPayload, name: "", unexpected: true }),
      { environment, fetchImpl: fetchMock },
    );
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ code: "INVALID_REQUEST" });
    expect(body.fieldErrors).toMatchObject({ name: expect.any(Array) });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    { turnstileResponse: { success: false }, scenario: "unsuccessful" },
    {
      turnstileResponse: {
        success: true,
        action: "login",
        hostname: "portfolio.example",
      },
      scenario: "wrong action",
    },
    {
      turnstileResponse: {
        success: true,
        action: "contact",
        hostname: "attacker.example",
      },
      scenario: "wrong hostname",
    },
    { turnstileResponse: "invalid response", scenario: "invalid JSON shape" },
  ])("rejects Turnstile verification with $scenario", async ({
    turnstileResponse,
  }) => {
    const fetchMock = createProviderFetch({ turnstileResponse });
    const response = await handleContactRequest(makeRequest(), {
      environment,
      fetchImpl: fetchMock,
    });

    expect(response.status).toBe(403);
    await expect(readJson(response)).resolves.toMatchObject({
      code: "VERIFICATION_FAILED",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fails closed when Turnstile times out", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    );

    const response = await handleContactRequest(makeRequest(), {
      environment,
      fetchImpl: fetchMock,
      turnstileTimeoutMs: 5,
    });

    expect(response.status).toBe(403);
    await expect(readJson(response)).resolves.toMatchObject({
      code: "VERIFICATION_FAILED",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fails closed when Turnstile returns malformed JSON", async () => {
    const fetchMock = createProviderFetch({ turnstileInvalidJson: true });
    const response = await handleContactRequest(makeRequest(), {
      environment,
      fetchImpl: fetchMock,
    });

    expect(response.status).toBe(403);
    await expect(readJson(response)).resolves.toMatchObject({
      code: "VERIFICATION_FAILED",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([400, 500])("returns SEND_FAILED for Resend %s", async (status) => {
    const fetchMock = createProviderFetch({ resendStatus: status });
    const response = await handleContactRequest(makeRequest(), {
      environment,
      fetchImpl: fetchMock,
    });

    expect(response.status).toBe(502);
    await expect(readJson(response)).resolves.toMatchObject({
      code: "SEND_FAILED",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns SEND_FAILED for a Resend network error", async () => {
    const fetchMock = createProviderFetch({ resendNetworkError: true });
    const response = await handleContactRequest(makeRequest(), {
      environment,
      fetchImpl: fetchMock,
    });

    expect(response.status).toBe(502);
    await expect(readJson(response)).resolves.toMatchObject({
      code: "SEND_FAILED",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
