import { z } from 'zod';
import { endpoints, type Endpoint } from './endpoints';
import { errorSchema } from './response-schemas';

/**
 * OpenAPI 3.1 document generated from the endpoint registry and its Zod schemas
 * (docs/PROMPT.md 3, 10). Nothing here is hand-written per route, so the documentation is
 * always the same thing the handlers actually validate and return.
 */

type Json = Record<string, unknown>;

function toJsonSchema(schema: z.ZodType, io: 'input' | 'output'): Json {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema, {
    io,
    unrepresentable: 'any',
  }) as Json;
  void _ignored;
  return rest;
}

function parametersOf(schema: z.ZodType | undefined, where: 'query' | 'path'): Json[] {
  if (!schema) return [];
  const js = toJsonSchema(schema, 'input') as {
    properties?: Record<string, Json>;
    required?: string[];
  };
  return Object.entries(js.properties ?? {}).map(([name, s]) => {
    const { description, ...schemaRest } = s as Json & { description?: string };
    return {
      name,
      in: where,
      required: where === 'path' ? true : (js.required ?? []).includes(name),
      ...(description ? { description } : {}),
      schema: schemaRest,
    };
  });
}

const errorRef = { $ref: '#/components/schemas/ApiError' };
const errorContent = { 'application/json': { schema: errorRef } };
const ERROR_TEXT: Record<number, string> = {
  400: 'Invalid query or path parameters',
  404: 'Not found',
  503: 'A dependency is unavailable',
};

function operation(e: Endpoint): Json {
  const contentType = e.contentType?.split(';')[0] ?? 'application/json';
  const responses: Record<string, Json> = {
    '200': {
      description: 'OK',
      headers: {
        ETag: {
          schema: { type: 'string' },
          description: 'Entity tag; send it back in If-None-Match to get a 304.',
        },
        'Cache-Control': { schema: { type: 'string' } },
        'X-Cache': {
          schema: { type: 'string', enum: ['HIT', 'MISS', 'BYPASS'] },
          description: 'Redis cache status.',
        },
      },
      content: { [contentType]: { schema: toJsonSchema(e.response, 'output') } },
    },
    '304': { description: 'Not modified (If-None-Match matched)' },
  };
  const statuses = new Set<number>([...(e.query || e.params ? [400] : []), ...(e.errors ?? [])]);
  for (const s of statuses)
    responses[String(s)] = { description: ERROR_TEXT[s] ?? 'Error', content: errorContent };
  responses['500'] = {
    description: 'Unexpected error (safe message, details are only in server logs)',
    content: errorContent,
  };

  return {
    operationId: e.id,
    summary: e.summary,
    ...(e.description ? { description: e.description } : {}),
    tags: [e.tag],
    parameters: [...parametersOf(e.params, 'path'), ...parametersOf(e.query, 'query')],
    responses,
  };
}

export type OpenApiDoc = ReturnType<typeof buildOpenApi>;

export function buildOpenApi() {
  const paths: Record<string, Json> = {};
  for (const e of Object.values(endpoints)) {
    (paths[e.path] ??= {})[e.method.toLowerCase()] = operation(e);
  }
  const tags = [...new Set(Object.values(endpoints).map((e) => e.tag))].map((name) => ({ name }));

  return {
    openapi: '3.1.0',
    info: {
      title: 'AXIOM AI API',
      version: '1.0.0',
      description:
        'Read API for AI models, providers, benchmarks, releases and news. Every factual record carries its source and verification status; values that are not publicly disclosed are `null`, never guessed. Records flagged `isDemo` are placeholders. There is no overall score or global ranking anywhere in this API.',
    },
    servers: [{ url: '/api/v1' }],
    tags,
    paths,
    components: { schemas: { ApiError: toJsonSchema(errorSchema, 'output') } },
  };
}
