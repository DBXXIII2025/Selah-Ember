import "server-only";

import { headers } from "next/headers";
import { logEvent, type LogLevel, type LogMetadata } from "@/lib/observability/log";

export async function getRequestLogContext(): Promise<LogMetadata> {
  try {
    const requestHeaders = await headers();
    return {
      requestId: requestHeaders.get("x-selah-request-id"),
      path: requestHeaders.get("x-selah-pathname"),
    };
  } catch {
    return {};
  }
}

export async function logRequestEvent(
  level: LogLevel,
  event: string,
  metadata: LogMetadata = {},
) {
  logEvent(level, event, {
    ...(await getRequestLogContext()),
    ...metadata,
  });
}
