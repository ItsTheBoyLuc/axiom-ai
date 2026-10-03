import { z } from 'zod';
import { HttpError } from './http';
import { toIso } from './text';
import type { Adapter, Candidate } from './types';

/**
 * Hugging Face API -> release candidates: "a new model repository was published by this
 * organisation". It reports only what the API states (repository id, creation date, task tag);
 * it does not invent a model description, capabilities or benchmark results.
 */

const configSchema = z.strictObject({
  author: z
    .string()
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/, 'a Hugging Face user or organisation'),
  provider: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  maxItems: z.number().int().min(1).max(50).default(20),
});
type Config = z.output<typeof configSchema>;

type HfModel = {
  id?: unknown;
  createdAt?: unknown;
  pipeline_tag?: unknown;
  private?: unknown;
  gated?: unknown;
};

export const huggingFaceAdapter: Adapter<Config> = {
  kind: 'huggingface',
  label: 'Hugging Face organisation',
  help: 'Stages a release entry for each new public model repository an organisation publishes on Hugging Face (newest first), from the public Hugging Face API.',
  exampleConfig: { author: 'example-lab', provider: 'example-lab', maxItems: 20 },
  configSchema,

  async run({ http, now }, config) {
    const url =
      `https://huggingface.co/api/models?author=${encodeURIComponent(config.author)}` +
      `&sort=createdAt&direction=-1&limit=${config.maxItems}`;
    const data = await http.getJson<unknown>(url);
    if (!Array.isArray(data)) throw new HttpError('network', 'Unexpected Hugging Face response.');

    const nowIso = now.toISOString();
    const candidates: Candidate[] = [];
    for (const m of data as HfModel[]) {
      if (m.private === true) continue;
      const id = typeof m.id === 'string' ? m.id : '';
      const created = toIso(m.createdAt);
      const repoUrl = id ? `https://huggingface.co/${id}` : null;
      const task = typeof m.pipeline_tag === 'string' && m.pipeline_tag ? m.pipeline_tag : null;

      candidates.push({
        entity: 'releases',
        record: {
          provider: config.provider,
          model: null,
          kind: 'MINOR',
          releaseDate: created ? created.slice(0, 10) : null,
          title: `${id} published on Hugging Face`,
          description: `Model repository ${id} was published by ${config.author} on Hugging Face${task ? ` (task: ${task})` : ''}.`,
          announcementUrl: repoUrl,
          docsUrl: null,
          sourceUrl: repoUrl,
          // The repository is under the organisation's own account, but this is a listing, not
          // an announcement: staged as provider reported and left to the admin to confirm.
          verificationStatus: 'PROVIDER_REPORTED',
          verifiedAt: null,
          dataType: 'Hugging Face API',
        },
      });
    }
    return { candidates, seen: data.length };
  },
};
