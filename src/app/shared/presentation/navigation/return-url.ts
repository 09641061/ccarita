/**
 * The `volver` address of a redirect, if it is a path inside the app; anything else (another origin, `//host`,
 * empty) becomes `fallback`, so a crafted link cannot send a signed-in user elsewhere.
 */
export function safeReturnUrl(value: string | null | undefined, fallback = '/'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\'))
    return fallback;
  return value;
}
