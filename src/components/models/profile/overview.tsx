import { Tag } from '@/components/ui/badges';
import { NOT_DISCLOSED } from '@/lib/verification';
import {
  capabilityLabel,
  modalityLabel,
  type CapabilityAvailability,
  type ModelDetail,
} from '@/types/model';
import { ProfileSection } from './profile-section';

const availabilityText: Record<CapabilityAvailability, string> = {
  AVAILABLE: 'Available',
  LIMITED: 'Limited',
  PREVIEW: 'Preview',
  NOT_AVAILABLE: 'Not available',
};

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="t-eyebrow mb-3">{title}</h3>
      {items.length ? (
        <ul className="text-fg-2 marker:text-muted list-disc space-y-1.5 pl-5 text-sm">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      ) : (
        <p className="text-fg-2 text-sm">{NOT_DISCLOSED}</p>
      )}
    </div>
  );
}

/** Neutral, factual overview: purpose, use cases, capabilities, modalities, features, limits. */
export function Overview({ model }: { model: ModelDetail }) {
  const o = model.overview;
  return (
    <ProfileSection id="overview" title="Overview" demo={model.isDemo}>
      <p className="text-fg-2 max-w-3xl">{o.purpose}</p>

      <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2">
        <List title="Use cases" items={o.useCases} />
        <List title="Notable features" items={o.notableFeatures} />
        <List title="Known limitations" items={o.limitations} />

        <div>
          <h3 className="t-eyebrow mb-3">Capabilities</h3>
          {model.capabilityAvailability.length ? (
            <ul className="space-y-1.5 text-sm">
              {model.capabilityAvailability.map((c) => (
                <li key={c.capability} className="flex items-center justify-between gap-3">
                  <span className="text-fg-2">{capabilityLabel[c.capability]}</span>
                  <span className="text-muted text-xs">{availabilityText[c.availability]}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-fg-2 text-sm">No listed capabilities for this model type.</p>
          )}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <h3 className="t-eyebrow mb-3">Input modalities</h3>
          <div className="flex flex-wrap gap-1.5">
            {model.specs.inputModalities.map((m) => (
              <Tag key={m}>{modalityLabel[m]}</Tag>
            ))}
          </div>
        </div>
        <div>
          <h3 className="t-eyebrow mb-3">Output modalities</h3>
          <div className="flex flex-wrap gap-1.5">
            {model.specs.outputModalities.map((m) => (
              <Tag key={m}>{modalityLabel[m]}</Tag>
            ))}
          </div>
        </div>
      </div>
    </ProfileSection>
  );
}
