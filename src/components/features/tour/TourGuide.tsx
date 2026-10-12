'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { saveTourProgressAction } from '@/modules/tour/actions';
import type { TourId, TourStep } from '@/modules/tour/steps';
import { useI18n } from '@/i18n/client';
import styles from './TourGuide.module.scss';

const PAD = 6; // space around the highlighted element
const GAP = 14; // between element and card
const CARD_W = 340;
const EDGE = 16;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function visibleRect(el: Element): Rect | null {
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0 || r.right <= 0 || r.left >= window.innerWidth) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/**
 * Guided setup tour across dashboard pages. Each step lives on a page; when
 * you're elsewhere the card offers to take you there. The highlighted element
 * stays usable (the dimming doesn't block clicks). Progress is saved per user.
 */
export function TourGuide({
  tour,
  steps,
  slug,
  initialStep,
  onClose,
}: {
  tour: TourId;
  steps: TourStep[];
  slug: string;
  initialStep: number;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const tt = t.app.tour;
  const router = useRouter();
  const pathname = usePathname();
  const [index, setIndex] = useState(() => Math.min(initialStep, steps.length - 1));
  const [rect, setRect] = useState<Rect | null>(null);
  const [cardH, setCardH] = useState(200);
  const [vw, setVw] = useState(() => (typeof window === 'undefined' ? 1024 : window.innerWidth));
  const cardRef = useRef<HTMLDivElement>(null);

  const step = steps[index]!;
  const href = step.page ? `/app/${slug}/${step.page}` : null;
  const onPage = !href || pathname === href || pathname.startsWith(`${href}/`);
  const last = index === steps.length - 1;
  const [title, body] = tt.steps[step.id] ?? [step.id, ''];
  const pageName = step.page ? (t.app.nav[step.page as keyof typeof t.app.nav] ?? step.page) : '';

  const save = useCallback(
    (stepIndex: number, done: boolean) => {
      void saveTourProgressAction({ tour, step: stepIndex, done });
    },
    [tour],
  );

  // Remember the current step so the tour resumes where the user left it.
  useEffect(() => {
    save(index, false);
  }, [index, save]);

  // Find and follow the highlighted element (it may render a moment after navigation).
  useEffect(() => {
    if (!onPage || !step.target) {
      const id = setTimeout(() => setRect(null), 0);
      return () => clearTimeout(id);
    }
    let el: Element | null = null;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const measure = () => setRect(el ? visibleRect(el) : null);
    const look = () => {
      el = document.querySelector(`[data-tour="${step.target}"]`);
      const r = el ? visibleRect(el) : null;
      if (el && r) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        timer = setTimeout(measure, 350);
      } else if (tries++ < 30) {
        timer = setTimeout(look, 100);
      } else {
        setRect(null); // not on screen (e.g. sidebar closed on mobile): centered card
      }
    };
    look();
    const onMove = () => {
      setVw(window.innerWidth);
      measure();
    };
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [onPage, step.target, pathname]);

  const highlighted = rect !== null;
  // Keep focus on the card for keyboard and screen-reader users.
  useLayoutEffect(() => {
    cardRef.current?.focus({ preventScroll: true });
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
  }, [index, onPage, highlighted]);

  function finish() {
    save(index, true);
    onClose();
  }

  const mobile = vw < 640;
  let pos: React.CSSProperties | undefined;
  if (rect && !mobile) {
    const below = rect.top + rect.height + PAD + GAP;
    const top =
      below + cardH < window.innerHeight - EDGE
        ? below
        : Math.max(EDGE, rect.top - PAD - GAP - cardH);
    const left = Math.min(Math.max(EDGE, rect.left), window.innerWidth - CARD_W - EDGE);
    pos = { top, left };
  }

  return createPortal(
    <div className={styles.root}>
      {rect ? (
        <div
          className={styles.spot}
          aria-hidden="true"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
          }}
        />
      ) : (
        <div className={styles.backdrop} aria-hidden="true" />
      )}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="false"
        aria-label={tt.label}
        aria-describedby="tour-body"
        tabIndex={-1}
        className={[styles.card, !pos && styles.center, mobile && styles.sheet]
          .filter(Boolean)
          .join(' ')}
        style={pos}
        onKeyDown={(e) => {
          if (e.key === 'Escape') finish();
        }}
      >
        <div className={styles.head}>
          <span className={styles.count}>{tt.stepOf({ n: index + 1, total: steps.length })}</span>
          <button type="button" className={styles.skip} onClick={finish}>
            {last ? tt.finish : tt.skip}
          </button>
        </div>
        <h2 className={styles.title}>{title}</h2>
        <p id="tour-body" className={styles.body}>
          {body}
        </p>
        <div className={styles.dots} aria-hidden="true">
          {steps.map((s, i) => (
            <span key={s.id} className={i === index ? styles.dotOn : undefined} />
          ))}
        </div>
        <div className={styles.actions}>
          {index > 0 ? (
            <button type="button" className={styles.back} onClick={() => setIndex(index - 1)}>
              {tt.back}
            </button>
          ) : (
            <span />
          )}
          {!onPage && href ? (
            <button type="button" className={styles.primary} onClick={() => router.push(href)}>
              {tt.goTo({ page: pageName })}
            </button>
          ) : last ? (
            <button type="button" className={styles.primary} onClick={finish}>
              {tt.finish}
            </button>
          ) : (
            <button type="button" className={styles.primary} onClick={() => setIndex(index + 1)}>
              {tt.next}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
