import { z } from 'zod';
import { HttpError } from './http';
import { absoluteHttpUrl, excerpt, plainText, toIso } from './text';
import type { Adapter, Candidate } from './types';

/**
 * GitHub releases API -> release candidates for a provider's official repository. Drafts are
 * never imported; pre-releases only when the source is configured to include them.
 */

const configSchema = z.strictObject({
  repo: z
    .string()
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}\/[A-Za-z0-9._-]{1,100}$/, 'use owner/name')
    // "owner/.." would let the request path climb out of /repos/{owner}/{name}.
    .refine((r) => !r.split('/').some((part) => part === '.' || part === '..'), 'use owner/name'),
  provider: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  model: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .nullable()
    .default(null),
  includePrereleases: z.boolean().default(false),
  maxItems: z.number().int().min(1).max(30).default(10),
});
type Config = z.output<typeof configSchema>;

type GhRelease = {
  tag_name?: unknown;
  name?: unknown;
  body?: unknown;
  html_url?: unknown;
  published_at?: unknown;
  draft?: unknown;
  prerelease?: unknown;
};

export const githubReleasesAdapter: Adapter<Config> = {
  kind: 'github-releases',
  label: 'GitHub releases',
  help: "Tracks the releases of a provider's official GitHub repository through the public GitHub API (set GITHUB_TOKEN on the worker for a higher rate limit).",
  exampleConfig: {
    repo: 'owner/repository',
    provider: 'example-lab',
    model: null,
    includePrereleases: false,
    maxItems: 10,
  },
  configSchema,

  async run({ http, now, secrets }, config) {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (secrets.githubToken) headers.Authorization = `Bearer ${secrets.githubToken}`;

    const data = await http.getJson<unknown>(
      `https://api.github.com/repos/${config.repo}/releases?per_page=${config.maxItems}`,
      { headers },
    );
    if (!Array.isArray(data)) throw new HttpError('network', 'Unexpected GitHub response.');

    const nowIso = now.toISOString();
    const repoName = config.repo.split('/')[1]!;
    const candidates: Candidate[] = [];
    for (const r of data as GhRelease[]) {
      if (r.draft === true) continue;
      if (r.prerelease === true && !config.includePrereleases) continue;
      const tag = typeof r.tag_name === 'string' ? r.tag_name : '';
      const name = typeof r.name === 'string' && r.name.trim() ? r.name.trim() : tag;
      const url = absoluteHttpUrl(r.html_url);
      const published = toIso(r.published_at);
      const body = plainText(r.body);

      candidates.push({
        entity: 'releases',
        record: {
          provider: config.provider,
          model: config.model,
          kind: 'MINOR',
          releaseDate: published ? published.slice(0, 10) : null,
          title: name.toLowerCase().includes(repoName.toLowerCase()) ? name : `${repoName} ${name}`,
          description: body ? excerpt(body, 240) : `Release ${tag} of ${config.repo} on GitHub.`,
          announcementUrl: url,
          docsUrl: null,
          sourceUrl: url,
          verificationStatus: 'OFFICIALLY_VERIFIED',
          verifiedAt: nowIso,
          dataType: 'GitHub release',
        },
      });
    }
    return { candidates, seen: data.length };
  },
};
