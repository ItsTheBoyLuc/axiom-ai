import { formatTokens } from '@/lib/format';
import { NOT_DISCLOSED } from '@/lib/verification';
import { deploymentLabel, modalityLabel, type ModelDetail } from '@/types/model';
import { ProfileSection } from './profile-section';

/** One spec row. Values are monospace; a missing value is always "Not publicly disclosed". */
function Spec({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="border-line border-b py-3">
      <dt className="t-eyebrow">{label}</dt>
      <dd className="mt-1 text-sm">
        {value === null ? (
          <span className="text-fg-2">{NOT_DISCLOSED}</span>
        ) : (
          <span className="text-fg font-mono">{value}</span>
        )}
      </dd>
    </div>
  );
}

const yesNo = (v: boolean | null) => (v === null ? null : v ? 'Yes' : 'No');
const tokens = (n: number | null) => (n === null ? null : `${formatTokens(n)} tokens`);

export function Specifications({ model }: { model: ModelDetail }) {
  const s = model.specs;
  const list = (xs: string[]) => (xs.length ? xs.join(', ') : null);
  return (
    <ProfileSection id="specifications" title="Technical specifications" demo={model.isDemo}>
      <dl className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
        <Spec label="Context window" value={tokens(model.contextWindow)} />
        <Spec label="Max output" value={tokens(s.maxOutputTokens)} />
        <Spec
          label="Input modalities"
          value={list(s.inputModalities.map((m) => modalityLabel[m]))}
        />
        <Spec
          label="Output modalities"
          value={list(s.outputModalities.map((m) => modalityLabel[m]))}
        />
        <Spec label="Tool calling" value={yesNo(s.toolCalling)} />
        <Spec label="Structured output" value={yesNo(s.structuredOutput)} />
        <Spec label="Function calling" value={yesNo(s.functionCalling)} />
        <Spec label="Streaming" value={yesNo(s.streaming)} />
        <Spec label="Knowledge cutoff" value={s.knowledgeCutoff} />
        <Spec label="Training information" value={s.trainingInfo} />
        <Spec
          label="Architecture"
          value={s.architecture === NOT_DISCLOSED ? null : s.architecture}
        />
        <Spec
          label="Deployment options"
          value={list(model.deployment.map((d) => deploymentLabel[d]))}
        />
        <Spec label="API availability" value={s.apiAvailability} />
      </dl>
    </ProfileSection>
  );
}
