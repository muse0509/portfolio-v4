import { beforeEach, describe, expect, it, vi } from "vitest";

const { contextMock, apiFetchMock } = vi.hoisted(() => ({
  contextMock: vi.fn(),
  apiFetchMock: vi.fn<(input: string) => Promise<Response>>(),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: contextMock,
}));

import { GET } from "./route";

async function expectUnavailable(response: Response): Promise<void> {
  expect(response.status).toBe(503);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(response.headers.get("X-Backend-Detail")).toBeNull();
  expect(await response.json()).toEqual({ status: "unavailable" });
}

describe("backend health route", () => {
  beforeEach(() => {
    contextMock.mockReset();
    apiFetchMock.mockReset();
    contextMock.mockResolvedValue({ env: { API: { fetch: apiFetchMock } } });
  });

  it("calls only the fixed Service Binding endpoint and returns its own health response", async () => {
    apiFetchMock.mockResolvedValue(
      Response.json(
        { status: "ok" },
        { headers: { "X-Backend-Detail": "internal information" } },
      ),
    );

    const response = await GET();

    expect(contextMock).toHaveBeenCalledExactlyOnceWith({ async: true });
    expect(apiFetchMock).toHaveBeenCalledExactlyOnceWith("http://api/health");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Backend-Detail")).toBeNull();
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("returns unavailable when the binding is missing", async () => {
    contextMock.mockResolvedValue({ env: {} });

    await expectUnavailable(await GET());
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("sanitizes context initialization failures", async () => {
    contextMock.mockRejectedValue(new Error("internal context details"));

    await expectUnavailable(await GET());
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("sanitizes Service Binding failures", async () => {
    apiFetchMock.mockRejectedValue(new Error("internal service details"));

    await expectUnavailable(await GET());
  });

  it.each([201, 503])("rejects upstream status %s without forwarding its body", async (status) => {
    apiFetchMock.mockResolvedValue(
      new Response("internal database details", {
        status,
        headers: { "X-Backend-Detail": "internal information" },
      }),
    );

    await expectUnavailable(await GET());
  });

  it.each([
    "{invalid-json",
    '{"status":"unavailable"}',
    '{"status":"ok","detail":"internal information"}',
    "null",
  ])("rejects an invalid upstream health body: %s", async (body) => {
    apiFetchMock.mockResolvedValue(
      new Response(body, { headers: { "Content-Type": "application/json" } }),
    );

    await expectUnavailable(await GET());
  });
});
