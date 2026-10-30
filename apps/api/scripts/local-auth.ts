import { randomBytes, randomUUID } from "node:crypto";
import { lstat, mkdir, open, rename, unlink } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { getPlatformProxy } from "wrangler";
import { issueRegistrationPermit } from "../src/auth/bootstrap.ts";
import { user } from "../src/auth/schema.ts";

const apiDirectory = fileURLToPath(new URL("../", import.meta.url));
const secretPath = join(apiDirectory, ".dev.vars");
const defaultStateDirectory = join(apiDirectory, ".wrangler", "state");
const defaultPermitPath = join(apiDirectory, ".wrangler", "registration-permit.txt");

function printHelp(): void {
  console.log(`Local administrator authentication setup (Node.js 24).

Usage:
  node scripts/local-auth.ts setup
  node scripts/local-auth.ts issue [--state-dir /absolute/local/test-directory]

setup creates .dev.vars with mode 0600 only when the file does not exist.
issue requires local migrations and takes the administrator ID only from server configuration.
The registration permit is written with mode 0600; only its file path is printed.
--state-dir isolates local test state (Wrangler's persist-to directory) and the permit file.
Neither command deploys, contacts remote D1, or creates a session.`);
}

function hasCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

async function setup(): Promise<void> {
  let file;

  try {
    file = await open(secretPath, "wx", 0o600);
  } catch (error) {
    if (hasCode(error, "EEXIST")) {
      console.log(`Existing file preserved: ${secretPath}`);
      return;
    }
    throw error;
  }

  try {
    const secret = randomBytes(32).toString("base64url");
    await file.writeFile(`BETTER_AUTH_SECRET=${secret}\n`, "utf8");
    await file.sync();
  } finally {
    await file.close();
  }

  console.log(`Created local secret file: ${secretPath}`);
}

async function savePermit(path: string, permit: string): Promise<void> {
  const directory = dirname(path);
  await mkdir(directory, { recursive: true, mode: 0o700 });

  try {
    if (!(await lstat(path)).isFile()) {
      throw new Error("Registration permit destination must be a regular file.");
    }
  } catch (error) {
    if (!hasCode(error, "ENOENT")) throw error;
  }

  // Write and sync a private sibling before renaming, so readers never see a
  // partial token and replacement keeps the intended owner-only permissions.
  const temporaryPath = join(directory, `.registration-permit-${randomUUID()}.tmp`);
  const file = await open(temporaryPath, "wx", 0o600);

  try {
    try {
      await file.writeFile(`${permit}\n`, "utf8");
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(temporaryPath, path);
  } finally {
    await unlink(temporaryPath).catch((error: unknown) => {
      if (!hasCode(error, "ENOENT")) throw error;
    });
  }
}

async function issue(stateDirectory?: string): Promise<void> {
  const localState = stateDirectory ?? defaultStateDirectory;
  const permitPath = stateDirectory
    ? join(stateDirectory, "registration-permit.txt")
    : defaultPermitPath;

  // Keep configuration and library diagnostics out of operator output and logs.
  process.env.WRANGLER_LOG = "none";
  process.env.WRANGLER_WRITE_LOGS = "false";
  const proxy = await getPlatformProxy<ApiEnv>({
    configPath: join(apiDirectory, "wrangler.jsonc"),
    remoteBindings: false,
    // Wrangler appends v3 to --persist-to; getPlatformProxy expects that suffix.
    persist: { path: join(localState, "v3") },
  });

  try {
    const { env } = proxy;

    if (
      env.AUTH_MODE !== "local" ||
      env.AUTH_BASE_URL !== "http://localhost:8788" ||
      env.AUTH_RP_ID !== "localhost" ||
      typeof env.ADMIN_USER_ID !== "string" ||
      env.ADMIN_USER_ID.trim().length === 0
    ) {
      throw new Error("Local authentication configuration is required.");
    }

    const db = drizzle(env.DB);
    const administrator = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, env.ADMIN_USER_ID))
      .get();

    if (!administrator) {
      const now = new Date();
      await db.insert(user).values({
        id: env.ADMIN_USER_ID,
        email: "admin@portfolio.invalid",
        name: "Local administrator",
        emailVerified: false,
        createdAt: now,
        updatedAt: now,
      }).onConflictDoNothing({ target: user.id });
    }

    const { permit } = await issueRegistrationPermit(env.DB, env.ADMIN_USER_ID);
    await savePermit(permitPath, permit);
    console.log(permitPath);
  } finally {
    await proxy.dispose();
  }
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  if (command === "--help" || command === "-h" || command === undefined) {
    printHelp();
    return;
  }
  if (command === "setup" && args.length === 0) {
    await setup();
    return;
  }
  if (command === "issue") {
    if (args.length === 0) {
      await issue();
      return;
    }
    if (args.length === 2 && args[0] === "--state-dir" && args[1] && isAbsolute(args[1])) {
      await issue(args[1]);
      return;
    }
  }

  throw new Error("Invalid local authentication command.");
}

await main().catch(() => {
  // Library errors can include SQL or configuration values; never echo them.
  console.error("Local authentication command failed. Check --help, local configuration, migrations, and file permissions.");
  process.exitCode = 1;
});
