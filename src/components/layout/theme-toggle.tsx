'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { motion } from 'motion/react';
import { spring } from '@/lib/motion';
import { useSession } from '@/components/account/session-provider';
import { useTheme, type ThemePreference } from './theme-provider';

const options: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'light', label: 'Light', icon: Sun },
];

/** system / dark / light selector, persisted by ThemeProvider. */
export function ThemeToggle() {
  const { preference, resolved, setPreference } = useTheme();
  const session = useSession();
  const Icon = resolved === 'dark' ? Moon : Sun;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label="Change theme"
        className="text-fg-2 hover:bg-elevated hover:text-fg inline-flex size-10 items-center justify-center rounded-lg transition-colors"
      >
        <Icon size={18} aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} asChild>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={spring.snappy}
            className="border-line-strong bg-elevated z-[70] min-w-40 origin-top-right rounded-xl border p-1.5 shadow-[var(--shadow-pop)]"
          >
            <DropdownMenu.RadioGroup
              value={preference}
              onValueChange={(v) => {
                const theme = v as ThemePreference;
                setPreference(theme);
                // Signed in: remember the choice on the account too (best effort, never blocks).
                if (session.status === 'user') void session.updatePreferences({ theme });
              }}
            >
              {options.map(({ value, label, icon: I }) => (
                <DropdownMenu.RadioItem
                  key={value}
                  value={value}
                  className="text-fg-2 data-[highlighted]:bg-card data-[highlighted]:text-fg flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none"
                >
                  <I size={16} aria-hidden />
                  <span className="flex-1">{label}</span>
                  <DropdownMenu.ItemIndicator>
                    <Check size={14} aria-hidden />
                  </DropdownMenu.ItemIndicator>
                </DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
          </motion.div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
