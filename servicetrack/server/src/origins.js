// A browser origin includes scheme, hostname and port. Localhost and 127.0.0.1
// reach the same laptop but are different origins, so allow both explicitly.
export function allowedOrigins(clientOrigin, apiPort) {
  const allowed = new Set();
  for (const address of [clientOrigin, `http://localhost:${apiPort}`]) {
    const url = new URL(address.trim());
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('CLIENT_ORIGIN must be an http:// or https:// address.');
    }
    allowed.add(url.origin);
    if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      for (const hostname of ['localhost', '127.0.0.1', '[::1]']) {
        const alias = new URL(url.origin);
        alias.hostname = hostname;
        allowed.add(alias.origin);
      }
    }
  }
  return allowed;
}
