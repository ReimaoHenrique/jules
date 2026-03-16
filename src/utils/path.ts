export function sanitizePath(rawValue: string | undefined): string | undefined {
  if (!rawValue) {
    return undefined;
  }

  // Split by slashes to sanitize each segment but keep the hierarchy
  const segments = rawValue
    .split("/")
    .map((segment) =>
      segment
        .trim()
        .replace(/[^a-zA-Z0-9._-]/g, "_")
    )
    .filter((segment) => segment.length > 0);

  return segments.length > 0 ? segments.join("/") : undefined;
}
