import {
  AVAILABILITIES,
  CAPABILITIES,
  CATEGORIES,
  DEPLOYMENTS,
  MODALITIES,
  PRICING_KINDS,
  RELEASE_KINDS,
} from '@/types/model';
import { BENCHMARK_CATEGORIES, NEWS_CATEGORIES } from '@/types/catalog';
import { VERIFICATION_STATUSES, verificationLabel } from '@/lib/verification';

/**
 * Field descriptions for the admin editor. One list per entity, mirroring the seed schemas in
 * prisma/seed/schemas.ts (which stay the single source of truth for VALIDATION: the server
 * re-validates everything). Pure and React-free so the conversion between form text and the
 * record JSON is unit-tested.
 */

export type RefKind = 'providers' | 'models' | 'benchmarks';
export type Option = { value: string; label: string };

export type FieldKind =
  | 'text'
  | 'textarea'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'tristate' // yes / no / not publicly disclosed (null)
  | 'select'
  | 'ref'
  | 'date'
  | 'datetime'
  | 'url'
  | 'checks' // choose several of a fixed list
  | 'lines' // one entry per line
  | 'refs' // several references
  | 'capabilities';

export type Field = {
  name: string;
  label: string;
  kind: FieldKind;
  /** Empty input is saved as null (the field may be "Not publicly disclosed"). */
  nullable?: boolean;
  /** Needs a value before saving (client hint; the server decides). */
  required?: boolean;
  options?: readonly Option[];
  ref?: RefKind;
  help?: string;
  /** Shown only in the "Source and verification" group. */
  group?: 'main' | 'source';
  /** Starting value for a NEW record. */
  initial?: string | boolean;
};

const opts = (values: readonly string[], label?: (v: string) => string): Option[] =>
  values.map((v) => ({ value: v, label: label ? label(v) : v }));
const human = (v: string) => v.charAt(0) + v.slice(1).toLowerCase().replace(/[_-]/g, ' ');
const kebabHuman = (v: string) => (v.charAt(0).toUpperCase() + v.slice(1)).replace(/-/g, ' ');

/** Fields every factual record carries. `collectedAt` and `isDemo` are server-owned. */
const TRISTATE: Option[] = [
  { value: '', label: 'Not publicly disclosed' },
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
];

const SOURCE_FIELDS: Field[] = [
  {
    name: 'sourceUrl',
    label: 'Source URL',
    kind: 'url',
    nullable: true,
    group: 'source',
    help: 'The page this value was read from. Required unless the status is Unverified or Not publicly disclosed.',
  },
  {
    name: 'verificationStatus',
    label: 'Verification status',
    kind: 'select',
    required: true,
    group: 'source',
    options: opts(
      VERIFICATION_STATUSES,
      (v) => verificationLabel[v as keyof typeof verificationLabel],
    ),
    initial: 'UNVERIFIED',
  },
  {
    name: 'verifiedAt',
    label: 'Verified at',
    kind: 'datetime',
    nullable: true,
    group: 'source',
    help: 'When you read the source. Required for officially verified and independently evaluated records.',
  },
  {
    name: 'dataType',
    label: 'Data type',
    kind: 'text',
    nullable: true,
    group: 'source',
    help: 'Optional note, e.g. "pricing page" or "model card".',
  },
];

const f = (field: Field): Field => ({ group: 'main', ...field });

export const ENTITY_FIELDS: Record<string, Field[]> = {
  providers: [
    f({
      name: 'slug',
      label: 'Slug',
      kind: 'text',
      required: true,
      help: 'Lowercase, hyphenated. Cannot be changed later.',
    }),
    f({ name: 'name', label: 'Name', kind: 'text', required: true }),
    f({
      name: 'monogram',
      label: 'Monogram',
      kind: 'text',
      nullable: true,
      help: '1-2 characters shown when there is no logo.',
    }),
    f({
      name: 'description',
      label: 'Description',
      kind: 'textarea',
      required: true,
      help: 'In your own words.',
    }),
    f({ name: 'officialWebsite', label: 'Official website', kind: 'url', nullable: true }),
    f({ name: 'logoUrl', label: 'Logo URL', kind: 'url', nullable: true }),
    f({ name: 'headquarters', label: 'Headquarters', kind: 'text', nullable: true }),
    f({
      name: 'orgType',
      label: 'Organisation type',
      kind: 'select',
      required: true,
      initial: 'COMPANY',
      options: opts(
        ['COMPANY', 'NONPROFIT', 'ACADEMIC', 'RESEARCH_LAB', 'OPEN_SOURCE', 'GOVERNMENT', 'OTHER'],
        human,
      ),
    }),
    f({ name: 'isListed', label: 'Listed in the directory', kind: 'boolean', initial: true }),
    ...SOURCE_FIELDS,
  ],
  models: [
    f({
      name: 'slug',
      label: 'Slug',
      kind: 'text',
      required: true,
      help: 'Cannot be changed later.',
    }),
    f({ name: 'provider', label: 'Provider', kind: 'ref', ref: 'providers', required: true }),
    f({ name: 'name', label: 'Name', kind: 'text', required: true }),
    f({ name: 'family', label: 'Family', kind: 'text', required: true }),
    f({ name: 'version', label: 'Version', kind: 'text', nullable: true }),
    f({ name: 'description', label: 'Description', kind: 'textarea', required: true }),
    f({
      name: 'categories',
      label: 'Categories',
      kind: 'checks',
      required: true,
      options: opts(CATEGORIES, kebabHuman),
    }),
    f({ name: 'releaseDate', label: 'Release date', kind: 'date', required: true }),
    f({ name: 'contextWindow', label: 'Context window (tokens)', kind: 'integer', nullable: true }),
    f({ name: 'maxOutputTokens', label: 'Max output tokens', kind: 'integer', nullable: true }),
    f({ name: 'openWeights', label: 'Open weights', kind: 'boolean', initial: false }),
    f({
      name: 'availability',
      label: 'Availability',
      kind: 'select',
      required: true,
      options: opts(AVAILABILITIES, human),
      initial: 'CLOUD_API',
    }),
    f({
      name: 'deployment',
      label: 'Deployment',
      kind: 'checks',
      options: opts(DEPLOYMENTS, kebabHuman),
    }),
    f({
      name: 'pricingKind',
      label: 'Pricing kind',
      kind: 'select',
      required: true,
      options: opts(PRICING_KINDS, kebabHuman),
      initial: 'unknown',
    }),
    f({
      name: 'inputModalities',
      label: 'Input modalities',
      kind: 'checks',
      options: opts(MODALITIES, kebabHuman),
    }),
    f({
      name: 'outputModalities',
      label: 'Output modalities',
      kind: 'checks',
      options: opts(MODALITIES, kebabHuman),
    }),
    f({
      name: 'officialDocumentation',
      label: 'Official documentation URL',
      kind: 'url',
      nullable: true,
    }),
    f({ name: 'knowledgeCutoff', label: 'Knowledge cutoff', kind: 'text', nullable: true }),
    f({ name: 'architecture', label: 'Architecture', kind: 'text', nullable: true }),
    f({ name: 'trainingInfo', label: 'Training information', kind: 'textarea', nullable: true }),
    f({ name: 'apiAvailability', label: 'API availability', kind: 'text', nullable: true }),
    f({
      name: 'structuredOutput',
      label: 'Structured output',
      kind: 'tristate',
      nullable: true,
      options: TRISTATE,
    }),
    f({
      name: 'streaming',
      label: 'Streaming',
      kind: 'tristate',
      nullable: true,
      options: TRISTATE,
    }),
    f({
      name: 'toolCalling',
      label: 'Tool calling',
      kind: 'tristate',
      nullable: true,
      options: TRISTATE,
    }),
    f({
      name: 'functionCalling',
      label: 'Function calling',
      kind: 'tristate',
      nullable: true,
      options: TRISTATE,
    }),
    f({ name: 'purpose', label: 'Purpose', kind: 'textarea', nullable: true }),
    f({ name: 'useCases', label: 'Use cases', kind: 'lines', help: 'One per line.' }),
    f({ name: 'notableFeatures', label: 'Notable features', kind: 'lines', help: 'One per line.' }),
    f({ name: 'limitations', label: 'Limitations', kind: 'lines', help: 'One per line.' }),
    f({ name: 'capabilities', label: 'Capabilities', kind: 'capabilities' }),
    ...SOURCE_FIELDS,
  ],
  benchmarks: [
    f({
      name: 'slug',
      label: 'Slug',
      kind: 'text',
      required: true,
      help: 'Cannot be changed later.',
    }),
    f({ name: 'name', label: 'Name', kind: 'text', required: true }),
    f({
      name: 'category',
      label: 'Category',
      kind: 'select',
      required: true,
      options: opts(BENCHMARK_CATEGORIES, kebabHuman),
      initial: 'reasoning',
    }),
    f({ name: 'description', label: 'Description', kind: 'textarea', required: true }),
    f({ name: 'methodologyUrl', label: 'Methodology URL', kind: 'url', nullable: true }),
    f({ name: 'version', label: 'Version', kind: 'text', nullable: true }),
    ...SOURCE_FIELDS,
  ],
  'benchmark-results': [
    f({ name: 'model', label: 'Model', kind: 'ref', ref: 'models', required: true }),
    f({ name: 'benchmark', label: 'Benchmark', kind: 'ref', ref: 'benchmarks', required: true }),
    f({ name: 'score', label: 'Score', kind: 'number', required: true }),
    f({
      name: 'scoreUnit',
      label: 'Score unit',
      kind: 'text',
      required: true,
      help: 'e.g. %, Elo, pass@1.',
    }),
    f({ name: 'evaluationDate', label: 'Evaluation date', kind: 'date', required: true }),
    f({ name: 'modelVersion', label: 'Model version evaluated', kind: 'text', required: true }),
    f({ name: 'benchmarkVersion', label: 'Benchmark version', kind: 'text', nullable: true }),
    f({
      name: 'evaluationType',
      label: 'Evaluation type',
      kind: 'select',
      required: true,
      options: opts(['INDEPENDENT', 'PROVIDER_REPORTED', 'COMMUNITY'], human),
      initial: 'PROVIDER_REPORTED',
    }),
    f({ name: 'methodologyNotes', label: 'Methodology notes', kind: 'textarea', nullable: true }),
    ...SOURCE_FIELDS,
  ],
  pricing: [
    f({ name: 'model', label: 'Model', kind: 'ref', ref: 'models', required: true }),
    f({
      name: 'pricingType',
      label: 'Price type',
      kind: 'select',
      required: true,
      options: opts(
        [
          'INPUT',
          'OUTPUT',
          'CACHED_INPUT',
          'BATCH_INPUT',
          'BATCH_OUTPUT',
          'IMAGE',
          'AUDIO',
          'OTHER',
        ],
        human,
      ),
      initial: 'INPUT',
    }),
    f({
      name: 'price',
      label: 'Price',
      kind: 'number',
      nullable: true,
      help: 'Leave empty when not publicly disclosed. Never enter 0 as a stand-in.',
    }),
    f({
      name: 'currency',
      label: 'Currency',
      kind: 'text',
      required: true,
      initial: 'USD',
      help: 'ISO 4217 code.',
    }),
    f({ name: 'unit', label: 'Unit', kind: 'text', required: true, initial: 'per 1M tokens' }),
    f({ name: 'effectiveFrom', label: 'Effective from', kind: 'date', required: true }),
    f({ name: 'effectiveTo', label: 'Effective to', kind: 'date', nullable: true }),
    f({ name: 'isCurrent', label: 'Current price', kind: 'boolean', initial: true }),
    ...SOURCE_FIELDS,
  ],
  releases: [
    f({ name: 'provider', label: 'Provider', kind: 'ref', ref: 'providers', required: true }),
    f({ name: 'model', label: 'Model', kind: 'ref', ref: 'models', nullable: true }),
    f({
      name: 'kind',
      label: 'Kind',
      kind: 'select',
      required: true,
      options: opts(RELEASE_KINDS, human),
      initial: 'MAJOR',
    }),
    f({ name: 'releaseDate', label: 'Release date', kind: 'date', required: true }),
    f({ name: 'title', label: 'Title', kind: 'text', required: true }),
    f({ name: 'description', label: 'Description', kind: 'textarea', required: true }),
    f({ name: 'announcementUrl', label: 'Announcement URL', kind: 'url', nullable: true }),
    f({ name: 'docsUrl', label: 'Documentation URL', kind: 'url', nullable: true }),
    ...SOURCE_FIELDS,
  ],
  news: [
    f({ name: 'title', label: 'Title', kind: 'text', required: true }),
    f({
      name: 'summary',
      label: 'Summary',
      kind: 'textarea',
      required: true,
      help: 'In your own words; mark it AI-written below if a model wrote it.',
    }),
    f({ name: 'publisher', label: 'Publisher', kind: 'text', required: true }),
    f({
      name: 'articleUrl',
      label: 'Article URL',
      kind: 'url',
      required: true,
      help: 'The identity of the story. Cannot be changed later.',
    }),
    f({ name: 'publicationDate', label: 'Date and time (UTC)', kind: 'datetime', required: true }),
    f({
      name: 'dateIsUpdated',
      label: 'Date is an "updated" date',
      kind: 'boolean',
      initial: false,
      help: 'Tick when the page shows no publication date, only an update date.',
    }),
    f({
      name: 'category',
      label: 'Category',
      kind: 'select',
      required: true,
      options: opts(NEWS_CATEGORIES, human),
      initial: 'MODEL_RELEASES',
    }),
    f({ name: 'isOfficial', label: 'Official announcement', kind: 'boolean', initial: false }),
    f({ name: 'isAiSummary', label: 'Summary is AI-written', kind: 'boolean', initial: true }),
    f({ name: 'provider', label: 'Provider', kind: 'ref', ref: 'providers', nullable: true }),
    f({ name: 'models', label: 'Related models', kind: 'refs', ref: 'models' }),
    ...SOURCE_FIELDS,
  ],
  publications: [
    f({ name: 'provider', label: 'Provider', kind: 'ref', ref: 'providers', required: true }),
    f({ name: 'title', label: 'Title', kind: 'text', required: true }),
    f({ name: 'url', label: 'URL', kind: 'url', required: true }),
    f({ name: 'publishedAt', label: 'Published', kind: 'date', required: true }),
    f({ name: 'venue', label: 'Venue', kind: 'text', nullable: true }),
    ...SOURCE_FIELDS,
  ],
};

export const CAPABILITY_OPTIONS = opts(CAPABILITIES, kebabHuman);
export const CAPABILITY_AVAILABILITY = opts(
  ['AVAILABLE', 'LIMITED', 'PREVIEW', 'NOT_AVAILABLE'],
  human,
);

/** Form state: every field is plain text, a boolean, or a list of strings. */
export type FormValue = string | boolean | string[] | CapabilityRow[];
export type CapabilityRow = { name: string; availability: string; documentationUrl: string };
export type FormValues = Record<string, FormValue>;

/** ISO date-time -> the `YYYY-MM-DDTHH:mm` an <input type="datetime-local"> needs (UTC). */
export const isoToLocalInput = (iso: string | null | undefined): string =>
  iso ? iso.slice(0, 16) : '';

/** `YYYY-MM-DDTHH:mm` (UTC, as shown) -> ISO date-time. */
export const localInputToIso = (v: string): string | null => {
  if (!v) return null;
  const d = new Date(`${v}:00.000Z`);
  return Number.isNaN(d.getTime()) ? v : d.toISOString();
};

const emptyFor = (field: Field): FormValue => {
  if (field.initial !== undefined) return field.initial;
  switch (field.kind) {
    case 'boolean':
      return false;
    case 'checks':
    case 'lines':
    case 'refs':
      return [];
    case 'capabilities':
      return [];
    default:
      return '';
  }
};

/** Form values for a new record (defaults) or for an existing record read from the API. */
export function initialValues(fields: Field[], record: Record<string, unknown> | null): FormValues {
  const out: FormValues = {};
  for (const field of fields) {
    const raw = record?.[field.name];
    if (raw === undefined || (raw === null && !record)) {
      out[field.name] = emptyFor(field);
      continue;
    }
    switch (field.kind) {
      case 'boolean':
        out[field.name] = raw === true;
        break;
      case 'tristate':
        out[field.name] = raw === true ? 'true' : raw === false ? 'false' : '';
        break;
      case 'checks':
      case 'lines':
      case 'refs':
        out[field.name] = Array.isArray(raw) ? raw.map(String) : [];
        break;
      case 'capabilities':
        out[field.name] = Array.isArray(raw)
          ? (raw as Record<string, unknown>[]).map((c) => ({
              name: String(c.name ?? ''),
              availability: String(c.availability ?? 'AVAILABLE'),
              documentationUrl: c.documentationUrl ? String(c.documentationUrl) : '',
            }))
          : [];
        break;
      case 'datetime':
        out[field.name] = isoToLocalInput(raw as string | null);
        break;
      case 'date':
        // A news date may be a full timestamp; the editor works with the day.
        out[field.name] = raw === null ? '' : String(raw).slice(0, 10);
        break;
      default:
        out[field.name] = raw === null ? '' : String(raw);
    }
  }
  return out;
}

export type PayloadResult =
  { ok: true; record: Record<string, unknown> } | { ok: false; errors: Record<string, string> };

/**
 * Form values -> the record JSON the API expects. Empty text becomes null for nullable fields,
 * numbers are parsed strictly (a typo is an error, never a silent 0), lists drop blank entries.
 * Anything this cannot decide is left to the server's schema, which has the last word.
 */
export function buildPayload(fields: Field[], values: FormValues): PayloadResult {
  const record: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  for (const field of fields) {
    const v = values[field.name];
    switch (field.kind) {
      case 'boolean':
        record[field.name] = v === true;
        break;
      case 'tristate':
        record[field.name] = v === 'true' ? true : v === 'false' ? false : null;
        break;
      case 'checks':
      case 'refs':
        record[field.name] = Array.isArray(v) ? v : [];
        break;
      case 'lines':
        record[field.name] = (Array.isArray(v) ? (v as string[]) : [])
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      case 'capabilities':
        record[field.name] = (Array.isArray(v) ? (v as CapabilityRow[]) : [])
          .filter((c) => c.name)
          .map((c) => ({
            name: c.name,
            availability: c.availability || 'AVAILABLE',
            documentationUrl: c.documentationUrl.trim() || null,
          }));
        break;
      case 'number':
      case 'integer': {
        const text = String(v ?? '').trim();
        if (text === '') {
          record[field.name] = null;
          if (field.required) errors[field.name] = `${field.label} is required.`;
          break;
        }
        const n = Number(text);
        if (!Number.isFinite(n)) errors[field.name] = `${field.label} must be a number.`;
        else if (field.kind === 'integer' && !Number.isInteger(n))
          errors[field.name] = `${field.label} must be a whole number.`;
        else record[field.name] = n;
        break;
      }
      case 'datetime': {
        const iso = localInputToIso(String(v ?? ''));
        record[field.name] = iso;
        break;
      }
      default: {
        const text = String(v ?? '').trim();
        if (text === '') {
          if (field.required) errors[field.name] = `${field.label} is required.`;
          record[field.name] = field.nullable ? null : text;
        } else record[field.name] = text;
      }
    }
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, record };
}

/** Maps the server's `issues[].path` onto the field that owns it (`capabilities.0.name` -> capabilities). */
export function fieldOfPath(path: string): string {
  return path.split('.')[0] ?? '';
}
