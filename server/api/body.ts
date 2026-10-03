import { z } from 'zod';
import { ApiError } from './http';

/** Request bodies are small JSON documents; anything bigger is refused before it is parsed. */
export const MAX_BODY_BYTES = 256 * 1024;

/**
 * Reads and validates a JSON body: correct content type, size limit (also when the client lies
 * about Content-Length), valid JSON, then the Zod schema. Every failure is a spec error envelope
 * (400 / 413 / 415) with field-level details, never a stack trace.
 */
export async function readJson<S extends z.ZodType>(
  request: Request,
  schema: S,
  maxBytes = MAX_BODY_BYTES,
): Promise<z.output<S>> {
  const type = request.headers.get('content-type') ?? '';
  if (!/^application\/json\b/i.test(type)) {
    throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Send the body as application/json.');
  }
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > maxBytes)
    throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'The request body is too large.');

  const text = await readLimited(request, maxBytes);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ApiError(400, 'INVALID_BODY', 'The request body is not valid JSON.');
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ApiError(
      400,
      'INVALID_BODY',
      'The request body is invalid.',
      parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return parsed.data;
}

async function readLimited(request: Request, maxBytes: number): Promise<string> {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'The request body is too large.');
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}
