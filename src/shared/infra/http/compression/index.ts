import compression from 'compression';
import type { RequestHandler } from 'express';

// Spec 072: JSON lists are large; gzip level 5, or brotli (the library default, quality 4) from 1 KB.
// The default filter already skips responses that set Content-Encoding.
export function buildCompression(): RequestHandler {
  return compression({ level: 5, threshold: 1024 });
}
