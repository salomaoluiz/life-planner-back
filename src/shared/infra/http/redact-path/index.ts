const INVITE_TOKEN_SEGMENT = /(\/family-invites\/)[^/?#]+/g;

// Secrets that travel in the URL path must not be echoed back (proxies/clients may log the response).
export function redactSensitivePath(url: string): string {
  return url.replace(INVITE_TOKEN_SEGMENT, '$1:token');
}
