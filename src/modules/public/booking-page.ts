import 'server-only';
import { getDb } from '@/lib/db/client';
import { cloudName, imageUrl } from '@/lib/cloudinary';
import { isCloudinaryConfigured } from '@/lib/env';
import {
  GLASS_TEMPLATES,
  readPageContent,
  type PageContent,
} from '@/modules/businesses/page-content';
import { readPhotos } from '@/modules/businesses/photos';

/**
 * Data for the PUBLIC booking page. Only fields that are meant to be public
 * are selected — never customers, appointments, emails of staff, internal
 * notes or policy internals beyond what the customer must see.
 */
export type TemplateKey = 'barber' | 'wellness' | 'consult' | 'fitness' | 'services';

export interface PublicPage {
  tenantId: string;
  /** Display language: the visitor's explicit choice, else the business's page language. */
  locale: Locale;
  slug: string;
  name: string;
  timezone: string;
  currency: string;
  country: string;
  template: TemplateKey;
  /** Glass style chosen in the editor (on templates that support it). */
  glass: boolean;
  published: boolean;
  profile: {
    displayName: string;
    tagline: string | null;
    description: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    hoursLines: string[];
    content: PageContent;
  };
  policy: {
    requireEmail: boolean;
    policyText: string | null;
    cancellationWindowMin: number;
    minNoticeMin: number;
  };
  services: {
    id: string;
    name: string;
    description: string | null;
    durationMin: number;
    priceMinor: number;
    staffIds: string[];
  }[];
  staff: { id: string; name: string; title: string | null; bio: string | null }[];
  /** Business photos in display order (first = cover). Empty when none or uploads are off. */
  photos: PublicPhoto[];
}

export interface PublicPhoto {
  id: string;
  src: string;
  srcSet: string;
  /** Small, heavily blurred version for the glass-style page backdrop. */
  blurSrc: string;
  width: number;
  height: number;
}

const PHOTO_WIDTHS = [640, 1200, 1800];

function publicPhotos(raw: unknown): PublicPhoto[] {
  const photos = readPhotos(raw);
  if (!photos.length || !isCloudinaryConfigured()) return [];
  const cloud = cloudName();
  return photos.map((p) => ({
    id: p.id,
    src: imageUrl(cloud, p.publicId, p.version, { width: 1200 }),
    srcSet: PHOTO_WIDTHS.map(
      (w) => `${imageUrl(cloud, p.publicId, p.version, { width: w })} ${w}w`,
    ).join(', '),
    blurSrc: imageUrl(cloud, p.publicId, p.version, { width: 640, blur: 1200 }),
    width: p.width,
    height: p.height,
  }));
}

export { summarizeHours } from './booking-page-pure';
import { summarizeHours } from './booking-page-pure';
import { DEFAULT_LOCALE, type Locale, toLocale } from '@/i18n/config';
import { getChosenLocale } from '@/i18n/server';

export async function loadPublicPage(
  slug: string,
  opts: { allowDraftFor?: string } = {},
): Promise<PublicPage | null> {
  if (!/^[a-z0-9-]{1,48}$/.test(slug)) return null;
  const db = getDb();
  const t = await db.tenant.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      timezone: true,
      currency: true,
      country: true,
      locale: true,
      status: true,
      profile: true,
      policy: {
        select: {
          requireEmail: true,
          policyText: true,
          cancellationWindowMin: true,
          minNoticeMin: true,
        },
      },
    },
  });
  if (!t || !t.profile || !t.policy) return null;
  if (t.status !== 'ACTIVE' && t.status !== 'TRIAL') return null;
  const published = t.profile.pageStatus === 'PUBLISHED';
  if (!published) {
    // Draft preview only for members of this tenant.
    if (!opts.allowDraftFor) return null;
    const m = await db.membership.findFirst({
      where: { tenantId: t.id, userId: opts.allowDraftFor, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!m) return null;
  }

  const [services, staff, rules] = await Promise.all([
    db.service.findMany({
      where: { tenantId: t.id, isActive: true, isOnline: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
        durationMin: true,
        priceMinor: true,
        staff: { where: { staff: { isActive: true } }, select: { staffId: true } },
      },
    }),
    db.staff.findMany({
      where: {
        tenantId: t.id,
        isActive: true,
        services: { some: { service: { isActive: true, isOnline: true } } },
      },
      orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }],
      select: { id: true, displayName: true, title: true, bio: true },
    }),
    db.availabilityRule.findMany({
      where: { tenantId: t.id, staffId: null },
      select: { dayOfWeek: true, startMin: true, endMin: true },
    }),
  ]);

  const locale = (await getChosenLocale()) ?? toLocale(t.locale) ?? DEFAULT_LOCALE;
  const content = readPageContent(t.profile.pageContent);

  return {
    tenantId: t.id,
    locale,
    slug: t.slug,
    name: t.name,
    timezone: t.timezone,
    currency: t.currency,
    country: t.country,
    template: t.profile.template.toLowerCase() as TemplateKey,
    glass: GLASS_TEMPLATES.includes(t.profile.template) && content.style === 'glass',
    published,
    profile: {
      displayName: t.profile.displayName,
      tagline: t.profile.tagline,
      description: t.profile.description,
      phone: t.profile.phone,
      email: t.profile.email,
      address: t.profile.address,
      hoursLines: t.profile.hoursNote
        ? t.profile.hoursNote
            .split(/\n|·/)
            .map((s) => s.trim())
            .filter(Boolean)
        : summarizeHours(rules, locale),
      content,
    },
    policy: t.policy,
    services: services
      .map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        durationMin: s.durationMin,
        priceMinor: s.priceMinor,
        staffIds: s.staff.map((x) => x.staffId),
      }))
      .filter((s) => s.staffIds.length > 0),
    staff: staff.map((s) => ({ id: s.id, name: s.displayName, title: s.title, bio: s.bio })),
    photos: publicPhotos(t.profile.photos),
  };
}
