import { getStats } from './stats';

/** True while `next build` is prerendering: the database is not available (or wanted) then. */
export const isBuildPhase = () => process.env.NEXT_PHASE === 'phase-production-build';

/**
 * Timestamp of the newest data update for the footer. Never throws: a database problem (or the
 * build phase, when there is no database) must not take the whole site down.
 */
export async function getLastDataUpdate(): Promise<string | null> {
  if (isBuildPhase()) return null;
  try {
    return (await getStats()).lastDataUpdate;
  } catch (err) {
    console.warn(
      '[site] could not read the last data update',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
