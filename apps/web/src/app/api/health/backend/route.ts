import { getCloudflareContext } from "@opennextjs/cloudflare";

function unavailableResponse(): Response {
  return Response.json(
    { status: "unavailable" },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(): Promise<Response> {
  try {
    const { env } = await getCloudflareContext({ async: true });

    if (!env.API) {
      return unavailableResponse();
    }

    const upstream = await env.API.fetch("http://api/health");

    if (upstream.status !== 200) {
      return unavailableResponse();
    }

    const body: unknown = await upstream.json();

    if (
      body === null ||
      typeof body !== "object" ||
      Object.keys(body).length !== 1 ||
      !("status" in body) ||
      body.status !== "ok"
    ) {
      return unavailableResponse();
    }

    return Response.json(
      { status: "ok" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return unavailableResponse();
  }
}
