'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { spring } from '@/lib/motion';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:brightness-110 shadow-[0_8px_24px_-10px_var(--accent)]',
  secondary: 'border border-line-strong bg-elevated text-fg hover:border-fg-2/50',
  ghost: 'text-fg-2 hover:text-fg hover:bg-elevated',
};
const sizes: Record<Size, string> = {
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

type Common = {
  variant?: Variant;
  size?: Size;
  arrow?: boolean;
  className?: string;
  children: React.ReactNode;
};

function classes({ variant = 'primary', size = 'md', className = '' }: Common) {
  return `group inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-[background,border-color,color,filter] duration-200 ${variants[variant]} ${sizes[size]} ${className}`;
}

const Arrow = () => (
  <ArrowRight
    size={16}
    aria-hidden
    className="transition-transform duration-200 group-hover:translate-x-0.5"
  />
);

/** Link styled as a button. Hover: arrow nudge. Pressed: scale down. */
export function ButtonLink({ href, ...p }: Common & { href: string }) {
  return (
    <motion.span whileTap={{ scale: 0.97 }} transition={spring.snappy} className="inline-flex">
      <Link href={href} className={classes(p)}>
        {p.children}
        {p.arrow && <Arrow />}
      </Link>
    </motion.span>
  );
}

export function Button({
  onClick,
  type = 'button',
  disabled,
  'aria-label': ariaLabel,
  ...p
}: Common & {
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  'aria-label'?: string;
}) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      whileTap={{ scale: 0.97 }}
      transition={spring.snappy}
      className={`${classes(p)} disabled:pointer-events-none disabled:opacity-50`}
    >
      {p.children}
      {p.arrow && <Arrow />}
    </motion.button>
  );
}
