'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { announceSessionChange } from '@/components/account/session-provider';
import { Button } from '@/components/ui/button';
import { MIN_PASSWORD_LENGTH, passwordIssueText, passwordIssues } from '@/lib/auth/credentials';

const field =
  'h-11 w-full rounded-lg border border-line-strong bg-elevated px-3 text-sm text-fg outline-none focus-visible:outline-2 focus-visible:outline-offset-2';

type Issue = { path: string; message: string };

/**
 * Creates an account. The password rules are shown as you type (the same function the server
 * uses, so what you see is what is enforced) and the server has the last word: its field-level
 * answers are shown next to the controls. Credentials go in a JSON POST body, never in a URL.
 */
export function SignUpForm({ next }: { next: string }) {
  const router = useRouter();
  const id = useId();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const issues = passwordIssues(password, email);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setTouched(true);
    if (issues.length > 0) return;
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      const res = await fetch('/api/v1/auth/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password, name: name || undefined, next: next || undefined }),
      });
      const json = (await res.json().catch(() => null)) as {
        data?: { next: string };
        error?: { code: string; message: string; details?: { issues?: Issue[] } };
      } | null;
      if (res.ok && json?.data) {
        announceSessionChange();
        router.replace(json.data.next);
        router.refresh();
        return;
      }
      if (res.status === 409)
        setErrors({ email: 'An account with this email already exists. Sign in instead.' });
      else if (res.status === 429)
        setFormError('Too many sign-ups from this address. Try again later.');
      else if (res.status === 400 && json?.error?.details?.issues) {
        const byField: Record<string, string> = {};
        for (const i of json.error.details.issues) byField[i.path || 'form'] ??= i.message;
        setErrors(byField);
      } else if (res.status === 400) setErrors({ email: 'Enter a valid email address.' });
      else setFormError('Sign-up is unavailable right now. Try again in a moment.');
    } catch {
      setFormError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  const passwordMessage =
    errors.password || (touched && issues.length ? passwordIssueText[issues[0]!] : null);

  return (
    <form onSubmit={submit} noValidate className="space-y-5" aria-busy={busy}>
      <div>
        <label htmlFor={`${id}-name`} className="text-fg text-sm font-medium">
          Name <span className="text-muted font-normal">(optional)</span>
        </label>
        <input
          id={`${id}-name`}
          name="name"
          autoComplete="name"
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`${field} mt-1.5`}
        />
      </div>
      <div>
        <label htmlFor={`${id}-email`} className="text-fg text-sm font-medium">
          Email
        </label>
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setErrors((cur) => ({ ...cur, email: '' }));
          }}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? `${id}-email-err` : undefined}
          className={`${field} mt-1.5`}
        />
        {errors.email && (
          <p id={`${id}-email-err`} role="alert" className="text-danger mt-1 text-xs">
            {errors.email}
          </p>
        )}
      </div>
      <div>
        <label htmlFor={`${id}-password`} className="text-fg text-sm font-medium">
          Password
        </label>
        <div className="relative mt-1.5">
          <input
            id={`${id}-password`}
            name="password"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setErrors((cur) => ({ ...cur, password: '' }));
            }}
            onBlur={() => password && setTouched(true)}
            aria-invalid={passwordMessage ? true : undefined}
            aria-describedby={`${id}-password-help`}
            className={`${field} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-pressed={show}
            aria-label="Show password"
            className="text-fg-2 hover:text-fg absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center"
          >
            {show ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
          </button>
        </div>
        <p id={`${id}-password-help`} className="text-muted mt-1 text-xs">
          At least {MIN_PASSWORD_LENGTH} characters. A few random words make a strong password.
        </p>
        {passwordMessage && (
          <p role="alert" className="text-danger mt-1 text-xs">
            {passwordMessage}
          </p>
        )}
      </div>
      {formError && (
        <p
          role="alert"
          className="border-danger/40 bg-danger/5 text-fg rounded-lg border px-3 py-2 text-sm"
        >
          {formError}
        </p>
      )}
      <Button type="submit" disabled={busy || !email || !password} className="w-full">
        {busy ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  );
}
