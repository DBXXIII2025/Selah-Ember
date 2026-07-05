export function logClientError(event: string, error: Error & { digest?: string }) {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      event,
      service: "selah-ember-web",
      digest: error.digest || null,
    }),
  );
}
