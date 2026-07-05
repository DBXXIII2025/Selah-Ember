import "server-only";

export type LogLevel = "info" | "warn" | "error";
export type LogMetadata = Record<string, string | number | boolean | null | undefined>;

const SAFE_KEYS = new Set([
  "requestId",
  "path",
  "method",
  "operation",
  "resourceType",
  "provider",
  "bucket",
  "outcome",
  "reason",
  "errorCode",
  "errorName",
  "status",
  "role",
  "scope",
  "ownerCheckPassed",
  "membershipCheckPassed",
]);

const SENSITIVE_KEY = /authorization|cookie|token|secret|password|credential|email|phone|body|content|url|filename|userId|profileId/i;

function isAllowedKey(key: string) {
  return SAFE_KEYS.has(key) || /(?:Count|Bytes|Ms)$/.test(key);
}

function sanitizeMetadata(metadata: LogMetadata) {
  const safe: Record<string, string | number | boolean | null> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined || SENSITIVE_KEY.test(key) || !isAllowedKey(key)) {
      continue;
    }

    if (key === "path" && typeof value === "string") {
      safe[key] = value
        .split("?")[0]
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, ":id")
        .slice(0, 160);
    } else {
      safe[key] = typeof value === "string" ? value.slice(0, 160) : value;
    }
  }

  return safe;
}

function normalizeEventName(event: string) {
  const normalized = event
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, ".")
    .replace(/^\.+|\.+$/g, "");

  return normalized || "application.unknown";
}

export function getErrorMetadata(error: unknown): LogMetadata {
  if (!error || typeof error !== "object") {
    return { errorName: typeof error };
  }

  const record = error as { name?: unknown; code?: unknown; status?: unknown };
  return {
    errorName: typeof record.name === "string" ? record.name : "Error",
    errorCode:
      typeof record.code === "string" || typeof record.code === "number"
        ? String(record.code)
        : undefined,
    status: typeof record.status === "number" ? record.status : undefined,
  };
}

export function logEvent(level: LogLevel, event: string, metadata: LogMetadata = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event: normalizeEventName(event),
    service: "selah-ember-web",
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
    ...sanitizeMetadata(metadata),
  };
  const serialized = JSON.stringify(entry);

  if (level === "error") {
    console.error(serialized);
  } else if (level === "warn") {
    console.warn(serialized);
  } else {
    console.info(serialized);
  }
}
