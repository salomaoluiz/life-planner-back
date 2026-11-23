import compression, { filter } from 'compression';
import type { RequestHandler } from 'express';

// Spec 120 FR 26: an event stream is never buffered by the compressor.
function isEventStream(contentType: number | string | string[] | undefined): boolean {
  return String(contentType ?? '').includes('text/event-stream');
}

// Spec 072: JSON lists are large; gzip level 5, or brotli (the library default, quality 4) from 1 KB.
// The default filter already skips responses that set Content-Encoding.
export function buildCompression(): RequestHandler {
  return compression({
    filter: (req, res) => (isEventStream(res.getHeader('Content-Type')) ? false : filter(req, res)),
    level: 5,
    threshold: 1024,
  });
}
