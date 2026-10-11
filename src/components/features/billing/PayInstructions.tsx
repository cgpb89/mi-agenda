import { buttonClass } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { Messages } from '@/i18n/messages';
import type { PlatformSettings } from '@/modules/platform/settings';

/** Payment reference owners put in the SINPE description, e.g. TEMPO-BARBERIA-DEL-NORTE. */
export function paymentReference(slug: string): string {
  return `TEMPO-${slug.toUpperCase()}`;
}

function whatsappLink(phone: string, text: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}

/** "How to pay" (SINPE Móvil + where to send the receipt). Billing page and closed screen. */
export function PayInstructions({
  t,
  settings,
  slug,
  business,
}: {
  t: Messages['app']['billingPage'];
  settings: PlatformSettings;
  slug: string;
  business: string;
}) {
  const ref = paymentReference(slug);
  const hasSinpe = Boolean(settings.sinpePhone);
  const hasContact = Boolean(settings.supportWhatsapp || settings.supportEmail);
  const text = t.whatsappText({ business, ref });
  return (
    <Card title={t.howToPay}>
      {hasSinpe ? (
        <>
          <span>{t.sinpeTo}</span>
          <span style={{ fontSize: 20, fontWeight: 700 }}>
            {settings.sinpePhone}
            {settings.sinpeName ? (
              <span style={{ fontSize: 15, fontWeight: 500, color: '#5d564b' }}>
                {' '}
                · {settings.sinpeName}
              </span>
            ) : null}
          </span>
          <span>{t.reference}</span>
          <code
            style={{
              alignSelf: 'flex-start',
              fontFamily: 'var(--font-mono), monospace',
              fontSize: 15,
              background: '#f4f0e8',
              borderRadius: 8,
              padding: '6px 10px',
            }}
          >
            {ref}
          </code>
          {settings.paymentNote ? (
            <span style={{ fontSize: 14, color: '#5d564b', whiteSpace: 'pre-line' }}>
              {settings.paymentNote}
            </span>
          ) : null}
          <span style={{ fontSize: 14, color: '#5d564b' }}>{t.afterPaying}</span>
        </>
      ) : (
        <span style={{ color: '#5d564b' }}>{t.notConfigured}</span>
      )}
      {hasContact ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {settings.supportWhatsapp ? (
            <a
              className={buttonClass({ variant: 'primary' })}
              href={whatsappLink(settings.supportWhatsapp, text)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.whatsapp}
            </a>
          ) : null}
          {settings.supportEmail ? (
            <a
              className={buttonClass({
                variant: settings.supportWhatsapp ? 'secondary' : 'primary',
              })}
              href={`mailto:${settings.supportEmail}?subject=${encodeURIComponent(ref)}&body=${encodeURIComponent(text)}`}
            >
              {t.email}
            </a>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
