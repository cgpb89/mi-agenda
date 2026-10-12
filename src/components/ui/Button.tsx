import Link from 'next/link';
import type { ComponentProps } from 'react';
import styles from './Button.module.scss';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'dangerSolid' | 'accent' | 'link';

interface CommonProps {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  pill?: boolean;
  block?: boolean;
}

export function buttonClass(
  { variant = 'secondary', size = 'md', pill, block }: CommonProps = {},
  extra?: string,
) {
  return [
    styles.btn,
    styles[variant],
    size === 'sm' && styles.sm,
    size === 'lg' && styles.lg,
    pill && styles.pill,
    block && styles.block,
    extra,
  ]
    .filter(Boolean)
    .join(' ');
}

export function Button({
  variant,
  size,
  pill,
  block,
  className,
  type = 'button',
  loading,
  disabled,
  children,
  ...rest
}: CommonProps &
  ComponentProps<'button'> & {
    /** Shows a spinner, disables the button and marks it busy while an action runs. */
    loading?: boolean;
  }) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size, pill, block }, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  pill,
  block,
  className,
  ...rest
}: CommonProps & ComponentProps<typeof Link>) {
  return <Link className={buttonClass({ variant, size, pill, block }, className)} {...rest} />;
}
