export const CONTACT_MAX_BODY_BYTES = 10 * 1_024;

export function isJsonContentType(contentType: string | null): boolean {
  if (!contentType) {
    return false;
  }

  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase();
  return mediaType === "application/json";
}

export function isDeclaredBodyTooLarge(contentLength: string | null): boolean {
  if (!contentLength || !/^\d+$/.test(contentLength)) {
    return false;
  }

  return Number(contentLength) > CONTACT_MAX_BODY_BYTES;
}

export function isAllowedContactOrigin(
  requestOrigin: string | null,
  configuredOrigins: string | undefined,
): boolean {
  if (!requestOrigin || !configuredOrigins) {
    return false;
  }

  const origins = configuredOrigins.split(",").map((origin) => origin.trim());

  if (
    origins.length === 0 ||
    origins.some((origin) => !isExactHttpOrigin(origin))
  ) {
    return false;
  }

  return origins.includes(requestOrigin);
}

export function parseAllowedHostnames(
  configuredHostnames: string | undefined,
): readonly string[] | null {
  if (!configuredHostnames) {
    return null;
  }

  const hostnames = configuredHostnames
    .split(",")
    .map((hostname) => hostname.trim());

  if (
    hostnames.length === 0 ||
    hostnames.some((hostname) => !isExactHostname(hostname))
  ) {
    return null;
  }

  return hostnames;
}

export function getCloudflareClientIp(request: Request): string | undefined {
  const value = request.headers.get("CF-Connecting-IP")?.trim();
  return value ? value : undefined;
}

export function hasFilledHoneypot(payload: unknown): boolean {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const value = (payload as Record<string, unknown>).website;

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return value !== undefined && value !== null;
}

function isExactHttpOrigin(value: string): boolean {
  if (!value || value.includes("*")) {
    return false;
  }

  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.origin === value
    );
  } catch {
    return false;
  }
}

function isExactHostname(value: string): boolean {
  if (!value || value.includes("*") || value.includes("/")) {
    return false;
  }

  try {
    const url = new URL(`https://${value}`);
    return url.hostname === value && url.port === "";
  } catch {
    return false;
  }
}
