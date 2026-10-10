import Link from 'next/link';
import type { ComponentProps } from 'react';
import styles from './Button.module.scss';

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
  ...rest
}: CommonProps & ComponentProps<'button'>) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size, pill, block }, className)}
      {...rest}
    />
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
