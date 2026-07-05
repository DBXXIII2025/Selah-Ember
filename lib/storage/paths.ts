export function isCanonicalStoragePath(
  path: string,
  scopeId: string,
  ownerUserId: string,
) {
  const segments = path.split("/");

  return (
    segments.length === 3 &&
    segments[0] === scopeId &&
    segments[1] === ownerUserId &&
    Boolean(segments[2]) &&
    segments.every((segment) => segment !== "." && segment !== "..")
  );
}
