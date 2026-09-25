export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function codeOf(error: unknown): unknown {
  return typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
}
