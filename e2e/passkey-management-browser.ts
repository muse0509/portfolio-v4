import type { JSHandle, Page } from "@playwright/test";

const basePath = "/api/admin/passkeys";

type CeremonyAttempt = {
  optionsStatus: number;
  operationId: string | null;
  requiredUV: boolean;
  body: string | null;
};

export async function managementPost(page: Page, path: string, body: Record<string, unknown>): Promise<number> {
  return page.evaluate(async ({ path, body }) => {
    const response = await fetch(path, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    await response.arrayBuffer();
    return response.status;
  }, { path: `${basePath}${path}`, body });
}

export async function listPasskeys(page: Page) {
  return page.evaluate(async (path) => {
    const response = await fetch(path);
    const data: unknown = await response.json();
    const rows: unknown[] = data && typeof data === "object" && "passkeys" in data && Array.isArray(data.passkeys)
      ? data.passkeys : [];
    const safeFieldsOnly = rows.every((row) => row !== null && typeof row === "object" &&
      Object.keys(row).sort().join(",") === "createdAt,id,name");
    // Return only the explicitly public fields, even if a regression adds secrets.
    return {
      status: response.status,
      safeFieldsOnly,
      noStore: response.headers.get("Cache-Control") === "no-store",
      passkeys: rows.map((row) => {
        if (row === null || typeof row !== "object") throw new Error("Unexpected passkey list.");
        return {
          id: "id" in row && typeof row.id === "string" ? row.id : "",
          name: "name" in row && typeof row.name === "string" ? row.name : null,
        };
      }),
    };
  }, basePath);
}

export async function beginReauthentication(
  page: Page,
  operation: "add" | "delete",
  passkeyId?: string,
): Promise<JSHandle<CeremonyAttempt>> {
  return page.evaluateHandle(async ({ path, operation, passkeyId }) => {
    let optionsStatus = 0;
    let operationId: string | null = null;
    let requiredUV = false;
    try {
      const response = await fetch(`${path}/reauth/options`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation, ...(passkeyId === undefined ? {} : { passkeyId }) }),
      });
      optionsStatus = response.status;
      if (optionsStatus !== 200) return { optionsStatus, operationId, requiredUV, body: null };
      const data = await response.json();
      if (!data || typeof data !== "object" || !("operationId" in data) ||
          typeof data.operationId !== "string" || !("options" in data)) {
        throw new Error("Unexpected test reauthentication options.");
      }
      operationId = data.operationId;
      const publicKey = PublicKeyCredential.parseRequestOptionsFromJSON(data.options as PublicKeyCredentialRequestOptionsJSON);
      requiredUV = publicKey.userVerification === "required";
      const credential = await navigator.credentials.get({ publicKey });
      if (!(credential instanceof PublicKeyCredential)) return { optionsStatus, operationId, requiredUV, body: null };
      return { optionsStatus, operationId, requiredUV, body: JSON.stringify({ operationId, response: credential.toJSON() }) };
    } catch { return { optionsStatus, operationId, requiredUV, body: null }; }
  }, { path: basePath, operation, passkeyId });
}

export async function finishReauthentication(page: Page, attempt: JSHandle<CeremonyAttempt>): Promise<number> {
  return finishCeremony(page, `${basePath}/reauth/verify`, attempt);
}

/** Keep the pending operation, but supply a real assertion for the ordinary-login challenge. */
export async function replaceWithOrdinaryLoginResponse(page: Page, attempt: JSHandle<CeremonyAttempt>): Promise<void> {
  await page.evaluate(async (attempt) => {
    const options = await fetch("/api/auth/passkey/generate-authenticate-options");
    if (options.status !== 200) throw new Error("Test login options were not available.");
    const publicKey = PublicKeyCredential.parseRequestOptionsFromJSON(await options.json());
    const credential = await navigator.credentials.get({ publicKey });
    if (!(credential instanceof PublicKeyCredential)) throw new Error("Test login assertion was not available.");
    attempt.body = JSON.stringify({ operationId: attempt.operationId, response: credential.toJSON() });
  }, attempt);
}

export async function reauthenticate(page: Page, operation: "add" | "delete", passkeyId?: string) {
  const attempt = await beginReauthentication(page, operation, passkeyId);
  try {
    const details = await attempt.evaluate(({ optionsStatus, operationId, requiredUV }) => ({ optionsStatus, operationId, requiredUV }));
    return { ...details, verificationStatus: await finishReauthentication(page, attempt) };
  } finally { await attempt.dispose(); }
}

export async function beginAdditionalRegistration(page: Page, operationId: string, name = "Backup test key"): Promise<JSHandle<CeremonyAttempt>> {
  return page.evaluateHandle(async ({ path, operationId, name }) => {
    let optionsStatus = 0;
    let requiredUV = false;
    try {
      const options = await fetch(`${path}/add/options`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operationId }),
      });
      optionsStatus = options.status;
      if (optionsStatus !== 200) return { optionsStatus, operationId, requiredUV, body: null };
      const publicKey = PublicKeyCredential.parseCreationOptionsFromJSON(await options.json());
      requiredUV = publicKey.authenticatorSelection?.userVerification === "required";
      const credential = await navigator.credentials.create({ publicKey });
      if (!(credential instanceof PublicKeyCredential)) return { optionsStatus, operationId, requiredUV, body: null };
      return { optionsStatus, operationId, requiredUV, body: JSON.stringify({ operationId, response: credential.toJSON(), name }) };
    } catch { return { optionsStatus, operationId, requiredUV, body: null }; }
  }, { path: basePath, operationId, name });
}

export async function finishAdditionalRegistration(page: Page, attempt: JSHandle<CeremonyAttempt>): Promise<number> {
  return finishCeremony(page, `${basePath}/add/verify`, attempt);
}

async function finishCeremony(page: Page, path: string, attempt: JSHandle<CeremonyAttempt>): Promise<number> {
  return page.evaluate(async ({ path, attempt }) => {
    if (attempt.body === null) return 0;
    const response = await fetch(path, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: attempt.body,
    });
    await response.arrayBuffer();
    return response.status;
  }, { path, attempt });
}
