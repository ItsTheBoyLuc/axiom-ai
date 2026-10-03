import { githubReleasesAdapter } from './github-releases';
import { huggingFaceAdapter } from './huggingface';
import { rssAdapter } from './rss';
import type { Adapter } from './types';

/** Every adapter the worker can run. Adding one here is the only registration step. */
export const ADAPTERS: Record<string, Adapter<never>> = {
  [rssAdapter.kind]: rssAdapter as unknown as Adapter<never>,
  [githubReleasesAdapter.kind]: githubReleasesAdapter as unknown as Adapter<never>,
  [huggingFaceAdapter.kind]: huggingFaceAdapter as unknown as Adapter<never>,
};

export const ADAPTER_KINDS = Object.keys(ADAPTERS);
export const getAdapter = (kind: string): Adapter<never> | undefined => ADAPTERS[kind];
export type { Adapter, AdapterContext, AdapterResult, Candidate } from './types';
