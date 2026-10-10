import { z } from 'zod';
import { DateTime } from 'luxon';
import { getDb } from '@/lib/db/client';
import { getEnv } from '@/lib/env';
import { AppError } from '@/lib/errors';
import { sendMail } from '@/lib/mail';
import { normalizePhone } from '@/lib/phone';
import { enforceRateLimit } from '@/lib/rate-limit';
import { assertSameOrigin, clientIpFrom } from '@/lib/security/request';
import {
  nameSchema,
  optionalEmailSchema,
  optionalTextSchema,
  parseInput,
  uuidSchema,
} from '@/lib/validation';
import { createAppointment } from '@/modules/bookings/engine';
import { LOCAL_DATE_RE } from '@/modules/scheduling/time';
import { errorResponse, ok, readJson } from '@/modules/public/http';

const bodySchema = z.object({
  serviceId: uuidSchema,
  staffId: uuidSchema.nullable(),
  date: z.string().regex(LOCAL_DATE_RE),
  startMin: z.number().int().min(0).max(1439),
  name: nameSchema('name'),
  email: optionalEmailSchema,
  phone: z.string().max(32),
  phoneCountry: z.string().length(2),
  notes: optionalTextSchema(500),
  idempotencyKey: uuidSchema,
  /** Honeypot: real users never fill this hidden field. */
  website: z.string().max(200).optional(),
  /** Client timestamp when the details step was shown (ms). */
  startedAt: z.number().int().optional(),
});

const MIN_FILL_MS = 2_000;

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    assertSameOrigin(request);
    const { slug } = await params;
    const ip = clientIpFrom(request.headers);
    await enforceRateLimit('bookingByIp', ip);
    const body = parseInput(bodySchema, await readJson(request));

    // Bot heuristics: silently-generic rejection (no hint about which check failed).
    if (body.website || (body.startedAt && Date.now() - body.startedAt < MIN_FILL_MS)) {
      throw new AppError('VALIDATION', "We couldn't complete that booking. Please try again.");
    }

    const tenant = await getDb().tenant.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        timezone: true,
        country: true,
        profile: { select: { address: true } },
      },
    });
    if (!tenant) throw new AppError('NOT_FOUND', 'Not found.');
    await enforceRateLimit('bookingByTenant', tenant.id);
    const phone = normalizePhone(body.phone, body.phoneCountry);
    if (phone.ok) await enforceRateLimit('bookingByPhone', tenant.id, phone.e164);

    const created = await createAppointment({
      tenantId: tenant.id,
      mode: 'public',
      serviceId: body.serviceId,
      staffId: body.staffId,
      date: body.date,
      startMin: body.startMin,
      customer: {
        name: body.name,
        phoneRaw: body.phone,
        phoneCountry: body.phoneCountry,
        email: body.email,
      },
      customerNote: body.notes,
      source: 'ONLINE',
      idempotencyKey: body.idempotencyKey,
    });

    const managePath = created.manageToken ? `/book/${slug}/manage/${created.manageToken}` : null;
    let emailed = false;
    if (body.email && managePath && !created.replayed) {
      const when = DateTime.fromJSDate(created.startAt, { zone: tenant.timezone }).toFormat(
        "cccc, LLLL d 'at' h:mm a",
      );
      const res = await sendMail({
        to: body.email,
        subject: `Booked: ${created.serviceName} at ${tenant.name}`,
        text: `You're booked.\n\n${created.serviceName} with ${created.staffName}\n${when} (${tenant.timezone})\n${tenant.profile?.address ?? ''}\nConfirmation ${created.confirmationCode}\n\nView, reschedule or cancel:\n${getEnv().APP_URL}${managePath}\n`,
      });
      emailed = res.sent;
    }

    return ok(
      {
        confirmationCode: created.confirmationCode,
        status: created.status,
        startAt: created.startAt.toISOString(),
        endAt: created.endAt.toISOString(),
        staffName: created.staffName,
        serviceName: created.serviceName,
        durationMin: created.durationMin,
        priceMinor: created.quotedPriceMinor,
        currency: created.currency,
        managePath,
        emailed,
      },
      { status: created.replayed ? 200 : 201 },
    );
  } catch (err) {
    return errorResponse(err, 'public.booking');
  }
}
