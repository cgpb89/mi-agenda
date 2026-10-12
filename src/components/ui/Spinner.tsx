import styles from './Spinner.module.scss';

/** Small inline loading indicator. Decorative: pair it with visible text or aria-busy. */
export function Spinner({ size = 14 }: { size?: number }) {
  return (
    <span className={styles.spinner} style={{ width: size, height: size }} aria-hidden="true" />
  );
}
