import type { ReactNode } from 'react';
import type { PublicPage } from '@/modules/public/booking-page';
import s from './Templates.module.scss';

/**
 * Five page templates over ONE booking engine. Templates only differ in
 * layout, type and copy; every one embeds the same <BookingFlow /> passed in
 * as `flow`. All text is business-provided and rendered as plain text.
 */
export interface TemplateProps {
  page: PublicPage;
  flow: ReactNode;
}

function price(minor: number, currency: string) {
  if (minor === 0) return 'Free';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: minor % 100 ? 2 : 0,
  }).format(minor / 100);
}

function Lines({ lines }: { lines: (string | null | undefined)[] }) {
  const clean = lines.filter((l): l is string => Boolean(l && l.trim()));
  return (
    <>
      {clean.map((l, i) => (
        <span key={i}>
          {l}
          {i < clean.length - 1 ? <br /> : null}
        </span>
      ))}
    </>
  );
}

// ── 1. Barber & hair ─────────────────────────────────────────────────────────
export function BarberTemplate({ page, flow }: TemplateProps) {
  const p = page.profile;
  const c = p.content;
  const words = p.displayName.split(/\s+/);
  return (
    <div className={s.barber}>
      <div className={s.bHead}>
        <span className={s.bLogo}>{words[0]}</span>
        <nav className={s.bNav} aria-label="Page">
          {page.staff.length ? <a href="#team">{c.notesTitle ? 'Team' : 'Barbers'}</a> : null}
          <a href="#visit">Visit</a>
          <a href="#book" className={s.bBook}>
            Book
          </a>
        </nav>
      </div>
      <div className={s.bHero}>
        <div className={s.bHeroText}>
          {c.eyebrow || p.tagline ? (
            <span className={`${s.mono} ${s.bEyebrow}`}>{c.eyebrow ?? p.tagline}</span>
          ) : null}
          <h1 className={s.bH1}>{c.headline ?? p.displayName}</h1>
          {(c.intro ?? p.description) ? (
            <p className={s.bLead}>{c.intro ?? p.description}</p>
          ) : null}
        </div>
        <div className={s.bPhoto} aria-hidden="true" />
      </div>
      <div id="book" className={s.bBookRow}>
        <div className={s.bCol}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h2 className={s.bH2}>SERVICES</h2>
            {page.services.map((x) => (
              <div key={x.id} className={s.bSvc}>
                <span className={s.bSvcName}>{x.name}</span>
                <span className={`${s.mono} ${s.bSvcDur}`}>{x.durationMin} MIN</span>
                <span className={s.bDots} />
                <span className={s.bPrice}>{price(x.priceMinor, page.currency)}</span>
              </div>
            ))}
          </div>
          {page.staff.length ? (
            <div id="team" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h2 className={s.bH2} style={{ margin: 0 }}>
                {c.notesTitle?.toUpperCase() ?? 'BARBERS'}
              </h2>
              <div className={s.bTeam}>
                {page.staff.map((m) => (
                  <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div className={s.bPortrait} aria-hidden="true" />
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{m.name}</span>
                    {m.title ? (
                      <span style={{ fontSize: 12, color: '#b0a393', marginTop: -6 }}>
                        {m.title}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <div className={s.sticky}>{flow}</div>
      </div>
      <div id="visit" className={s.bVisit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className={s.bVisitTitle}>VISIT</span>
          <span className={s.bVisitText}>
            <Lines lines={[p.address, p.phone]} />
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className={s.bVisitTitle}>HOURS</span>
          <span className={s.bVisitText}>
            <Lines lines={p.hoursLines} />
          </span>
        </div>
        <div className={s.bGallery} aria-hidden="true">
          <div />
          <div />
        </div>
      </div>
    </div>
  );
}

// ── 2. Beauty & wellness ─────────────────────────────────────────────────────
export function WellnessTemplate({ page, flow }: TemplateProps) {
  const p = page.profile;
  const c = p.content;
  const headline = c.headline ?? 'A quieter hour, set aside for you.';
  const comma = headline.indexOf(',');
  const highlights =
    c.highlights && c.highlights.length
      ? c.highlights
      : page.services
          .slice(0, 3)
          .map((x) => ({ title: x.name, body: x.description ?? `${x.durationMin} minutes` }));
  return (
    <div className={s.wellness}>
      <div className={s.wHead}>
        <span className={s.wLogo}>{p.displayName}</span>
        {p.tagline ? <span className={s.wTag}>{p.tagline}</span> : null}
      </div>
      <div className={s.wHero}>
        <h1 className={s.wH1}>
          {comma > 0 ? (
            <>
              {headline.slice(0, comma + 1)} <em>{headline.slice(comma + 1).trim()}</em>
            </>
          ) : (
            headline
          )}
        </h1>
        <a href="#book" className={s.wCta}>
          {c.ctaLabel ?? 'Book a treatment'}
        </a>
        <div className={s.wArch} aria-hidden="true" />
      </div>
      {highlights.length ? (
        <div className={s.wCats}>
          {highlights.map((h) => (
            <div key={h.title} className={s.wCat}>
              <span>{h.title}</span>
              <span>{h.body}</span>
            </div>
          ))}
        </div>
      ) : null}
      <div id="book" className={s.wBook}>
        <div>{flow}</div>
      </div>
      <div className={s.wInfo}>
        {c.notes?.length || page.policy.policyText ? (
          <div>
            <span className={s.wInfoTitle}>{c.notesTitle ?? 'Before your visit'}</span>
            <span className={s.wInfoText}>
              <Lines lines={c.notes?.length ? c.notes : [page.policy.policyText]} />
            </span>
          </div>
        ) : null}
        <div>
          <span className={s.wInfoTitle}>Find us</span>
          <span className={s.wInfoText}>
            <Lines lines={[p.address, ...p.hoursLines, p.email, p.phone]} />
          </span>
        </div>
      </div>
    </div>
  );
}

// ── 3. Health & consultation ─────────────────────────────────────────────────
export function ConsultTemplate({ page, flow }: TemplateProps) {
  const p = page.profile;
  const c = p.content;
  const cards =
    c.highlights && c.highlights.length
      ? c.highlights
      : [
          ...(p.address ? [{ title: 'In person', body: p.address }] : []),
          ...(p.hoursLines[0] ? [{ title: 'Hours', body: p.hoursLines[0] }] : []),
          ...(p.phone ? [{ title: 'Phone', body: p.phone }] : []),
        ];
  const policy = c.notes?.length
    ? c.notes
    : [page.policy.policyText, 'We ask only for contact details when you book.'];
  return (
    <div className={s.consult}>
      <div className={s.cTop}>
        <div className={s.cBrand}>
          <span className={s.cTile} aria-hidden="true">
            {p.displayName.charAt(0).toUpperCase()}
          </span>
          <span>{p.displayName}</span>
        </div>
        <span className={s.cContact}>{[p.phone, p.hoursLines[0]].filter(Boolean).join(' · ')}</span>
      </div>
      <div className={s.cMain}>
        <div className={s.cCol}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h1 className={s.cH1}>{c.headline ?? 'Book a consultation'}</h1>
            {(c.intro ?? p.description) ? (
              <p className={s.cLead}>{c.intro ?? p.description}</p>
            ) : null}
          </div>
          {cards.length ? (
            <div className={s.cCards}>
              {cards.map((x) => (
                <div key={x.title} className={s.cCard}>
                  <span>{x.title}</span>
                  <span>{x.body}</span>
                </div>
              ))}
            </div>
          ) : null}
          {page.staff.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>Practitioners</h2>
              {page.staff.map((m) => (
                <div key={m.id} className={s.cPerson}>
                  <div className={s.cAvatar} aria-hidden="true" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontWeight: 700 }}>{m.name}</span>
                    {m.title ? (
                      <span style={{ fontSize: 14, color: '#3d4d63' }}>{m.title}</span>
                    ) : null}
                    {m.bio ? <span style={{ fontSize: 13, color: '#5a6a80' }}>{m.bio}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <div className={s.cPolicy}>
            <h2>{c.notesTitle ?? 'Appointment policies'}</h2>
            <span>
              <Lines lines={policy} />
            </span>
          </div>
        </div>
        <div id="book" className={s.sticky}>
          {flow}
        </div>
      </div>
    </div>
  );
}

// ── 4. Fitness & coaching ────────────────────────────────────────────────────
export function FitnessTemplate({ page, flow }: TemplateProps) {
  const p = page.profile;
  const c = p.content;
  const words = p.displayName.split(/\s+/);
  const headline = (c.headline ?? 'Train with intent.').trim();
  const lastSpace = headline.lastIndexOf(' ');
  return (
    <div className={s.fitness}>
      <div className={s.fHead}>
        <span className={s.fLogo}>
          {words[0]}
          {words.length > 1 ? (
            <>
              <span>/</span>
              {words.slice(1).join(' ')}
            </>
          ) : null}
        </span>
        <a href="#book" className={s.fCta}>
          {c.ctaLabel ?? 'Book a session'}
        </a>
      </div>
      <div className={s.fHero}>
        <h1 className={s.fH1}>
          {lastSpace > 0 ? (
            <>
              {headline.slice(0, lastSpace)}
              <br />
              <span>{headline.slice(lastSpace + 1)}</span>
            </>
          ) : (
            <span>{headline}</span>
          )}
        </h1>
        <div className={s.fMeta}>
          {(c.intro ?? p.description) ? <p>{c.intro ?? p.description}</p> : <span />}
          <span className={s.mono}>{[p.address, p.hoursLines[0]].filter(Boolean).join(' · ')}</span>
        </div>
      </div>
      <div className={s.fBand} aria-hidden="true" />
      <div id="book" className={s.fBook}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {page.services.map((x, i) => (
            <div key={x.id} className={s.fSession}>
              <span className={`${s.mono} ${s.fNum}`}>{String(i + 1).padStart(2, '0')}</span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className={s.fName}>{x.name}</span>
                <span className={s.fSub}>
                  {x.durationMin} min{x.description ? ` · ${x.description}` : ''}
                </span>
              </span>
              <span className={s.fPrice}>{price(x.priceMinor, page.currency)}</span>
            </div>
          ))}
          {page.staff.length ? (
            <div className={s.fCoaches}>
              {page.staff.map((m) => (
                <div key={m.id}>
                  <div className={s.fCoachImg} aria-hidden="true" />
                  <span className={s.fName} style={{ fontSize: 22 }}>
                    {m.name}
                  </span>
                  {m.title ? (
                    <span className={s.fSub} style={{ marginTop: -4 }}>
                      {m.title}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className={s.sticky}>{flow}</div>
      </div>
    </div>
  );
}

// ── 5. General services ──────────────────────────────────────────────────────
export function ServicesTemplate({ page, flow }: TemplateProps) {
  const p = page.profile;
  const c = p.content;
  return (
    <div className={s.services}>
      <div className={s.sBento}>
        <div className={s.sIntro}>
          <div className={s.sBrand}>
            <i aria-hidden="true" />
            <span>{p.displayName}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h1 className={s.sH1}>{c.headline ?? p.tagline ?? 'Book an appointment.'}</h1>
            {(c.intro ?? p.description) ? (
              <p className={s.sLead}>{c.intro ?? p.description}</p>
            ) : null}
          </div>
        </div>
        <div className={s.sPhoto} aria-hidden="true" />
        <div className={s.sContact}>
          <span className={s.sContactLabel}>Contact</span>
          {p.address ? (
            <span style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.35 }}>{p.address}</span>
          ) : null}
          <span style={{ fontSize: 15, lineHeight: 1.7, color: '#d1d3d6' }}>
            <Lines lines={[p.phone, p.email, ...p.hoursLines]} />
          </span>
          <div className={s.sMap} aria-hidden="true" />
        </div>
      </div>
      <div className={s.sRow}>
        <div className={s.sCatalog}>
          {page.services.map((x) => (
            <div key={x.id} className={s.sCard}>
              <span className={s.sDur}>{x.durationMin} min</span>
              <span className={s.sName}>{x.name}</span>
              <span className={s.sDesc}>{x.description}</span>
              <span className={s.sFrom}>
                {x.priceMinor === 0 ? 'Free' : `From ${price(x.priceMinor, page.currency)}`}
              </span>
            </div>
          ))}
        </div>
        <div id="book" className={s.sticky}>
          {flow}
        </div>
      </div>
    </div>
  );
}

export const TEMPLATES = {
  barber: BarberTemplate,
  wellness: WellnessTemplate,
  consult: ConsultTemplate,
  fitness: FitnessTemplate,
  services: ServicesTemplate,
} as const;

export const templateStyles = s;
