import type { ProviderSummary } from '../../src/types/catalog';
import { getRepositories } from './index';

export type { ProviderSummary };

/** Providers with their model counts (thin wrapper kept for the homepage components). */
export function listProviders(): Promise<ProviderSummary[]> {
  return getRepositories().providers.listAll();
}
