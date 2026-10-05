'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ConfirmButton } from '@/components/admin/confirm-button';
import { controlClass } from '@/components/admin/field-input';
import { useTheme, type ThemePreference } from '@/components/layout/theme-provider';
import { MAX_PREFERRED_PROVIDERS, type Preferences } from '@/lib/account/schemas';
import { announceSessionChange } from './session-provider';

type Issue = { path: string; message: string };
type ErrorBody = {
  error?: { code: string; message: string; details?: { issues?: Issue[] } };
} | null;

const issuesText = (body: ErrorBody, fallback: string) =>
  body?.error?.details?.issues?.map((i) => i.message).join(' ') || body?.error?.message || fallback;

const THEME_OPTIONS: { value: ThemePreference; label: string; help: string }[] = [
  { value: 'system', label: 'System', help: 'Follow your device.' },
  { value: 'dark', label: 'Dark', help: 'Always dark.' },
  { value: 'light', label: 'Light', help: 'Always light.' },
];

/** Theme, preferred providers and the personalised home section. Saved to the account. */
export function PreferencesForm({
  initial,
  providers,
}: {
  initial: Preferences;
  providers: { slug: string; name: string }[];
}) {
  const id = useId();
  const { preference, setPreference } = useTheme();
  const [theme, setTheme] = useState<ThemePreference>(initial.theme ?? preference);
  const [chosen, setChosen] = useState<string[]>(initial.preferredProviders);
  const [personalized, setPersonalized] = useState(initial.personalized);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/v1/me/preferences', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme, preferredProviders: chosen, personalized }),
      });
      if (res.ok) {
        setPreference(theme);
        announceSessionChange();
        setMessage({ text: 'Settings saved.', error: false });
      } else {
        setMessage({
          text: issuesText(
            (await res.json().catch(() => null)) as ErrorBody,
            'The settings could not be saved.',
          ),
          error: true,
        });
      }
    } catch {
      setMessage({ text: 'Could not reach the server. Try again.', error: true });
    } finally {
      setBusy(false);
    }
  }

  const toggle = (slug: string) =>
    setChosen((cur) =>
      cur.includes(slug)
        ? cur.filter((s) => s !== slug)
        : cur.length >= MAX_PREFERRED_PROVIDERS
          ? cur
          : [...cur, slug],
    );

  return (
    <form onSubmit={save} className="space-y-8" aria-busy={busy}>
      <fieldset>
        <legend className="text-fg text-sm font-medium">Theme</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {THEME_OPTIONS.map((o) => (
            <label
              key={o.value}
              className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${theme === o.value ? 'border-accent bg-accent/10 text-fg' : 'border-line text-fg-2'}`}
            >
              <input
                type="radio"
                name={`${id}-theme`}
                value={o.value}
                checked={theme === o.value}
                onChange={() => setTheme(o.value)}
                className="accent-accent size-4"
              />
              <span>
                {o.label} <span className="text-muted text-xs">· {o.help}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-fg text-sm font-medium">Preferred providers</legend>
        <p className="text-muted mt-1 text-xs">
          Their latest releases appear in the &ldquo;For you&rdquo; section on the home page. Choose
          up to {MAX_PREFERRED_PROVIDERS}.
        </p>
        <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((p) => (
            <li key={p.slug}>
              <label className="hover:bg-elevated flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-sm">
                <input
                  type="checkbox"
                  checked={chosen.includes(p.slug)}
                  onChange={() => toggle(p.slug)}
                  className="accent-accent size-4"
                />
                <span className="text-fg">{p.name}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <label className="text-fg flex items-start gap-2.5 text-sm font-medium">
        <input
          type="checkbox"
          checked={personalized}
          onChange={(e) => setPersonalized(e.target.checked)}
          className="accent-accent mt-0.5 size-4"
        />
        <span>
          Show the &ldquo;For you&rdquo; section on the home page
          <span className="text-muted block text-xs font-normal">
            Your saved models, recent views and news from your preferred providers.
          </span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save settings'}
        </Button>
        {message && (
          <p
            role={message.error ? 'alert' : 'status'}
            className={`text-sm ${message.error ? 'text-danger' : 'text-fg'}`}
          >
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}

/** Change the password: needs the current one, signs every other device out. */
export function PasswordForm() {
  const id = useId();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/v1/me/password', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (res.ok) {
        setMessage({ text: 'Password changed. Your other devices were signed out.', error: false });
        setCurrent('');
        setNext('');
      } else if (res.status === 429) {
        setMessage({ text: 'Too many attempts. Try again later.', error: true });
      } else {
        setMessage({
          text: issuesText(
            (await res.json().catch(() => null)) as ErrorBody,
            'The password could not be changed.',
          ),
          error: true,
        });
      }
    } catch {
      setMessage({ text: 'Could not reach the server. Try again.', error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-md space-y-4" aria-busy={busy}>
      <div>
        <label htmlFor={`${id}-current`} className="text-fg text-sm font-medium">
          Current password
        </label>
        <input
          id={`${id}-current`}
          type="password"
          autoComplete="current-password"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className={`${controlClass} mt-1.5`}
        />
      </div>
      <div>
        <label htmlFor={`${id}-new`} className="text-fg text-sm font-medium">
          New password
        </label>
        <input
          id={`${id}-new`}
          type="password"
          autoComplete="new-password"
          required
          value={next}
          onChange={(e) => setNext(e.target.value)}
          aria-describedby={`${id}-new-help`}
          className={`${controlClass} mt-1.5`}
        />
        <p id={`${id}-new-help`} className="text-muted mt-1 text-xs">
          At least 12 characters.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy || !current || !next}>
          {busy ? 'Changing…' : 'Change password'}
        </Button>
        {message && (
          <p
            role={message.error ? 'alert' : 'status'}
            className={`text-sm ${message.error ? 'text-danger' : 'text-fg'}`}
          >
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}

/** Permanently deletes the account and everything saved with it (password required). */
export function DeleteAccountForm() {
  const id = useId();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/me', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        announceSessionChange();
        router.replace('/?account=deleted');
        router.refresh();
        return;
      }
      setError(
        issuesText(
          (await res.json().catch(() => null)) as ErrorBody,
          'The account could not be deleted.',
        ),
      );
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md space-y-4">
      <p className="text-fg-2 text-sm">
        This permanently deletes your account, saved models and comparisons, history and settings.
        It cannot be undone.
      </p>
      <div>
        <label htmlFor={`${id}-pw`} className="text-fg text-sm font-medium">
          Your password
        </label>
        <input
          id={`${id}-pw`}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`${controlClass} mt-1.5`}
        />
      </div>
      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
      {password ? (
        <ConfirmButton
          label="Delete my account"
          question="Delete your account for good?"
          onConfirm={remove}
          busy={busy}
        />
      ) : (
        <p className="text-muted text-xs">Enter your password to enable deletion.</p>
      )}
    </div>
  );
}
