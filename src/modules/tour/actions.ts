'use server';

import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import { requireUser } from '@/lib/auth/authorize';
import { getDb } from '@/lib/db/client';
import { runAction, type ActionResult } from '@/lib/errors';
import { enforceRateLimit } from '@/lib/rate-limit';
import { parseInput } from '@/lib/validation';
import { TOUR_IDS, readTourProgress } from './steps';

const schema = z.object({
  tour: z.enum(TOUR_IDS),
  step: z.number().int().min(0).max(100),
  done: z.boolean(),
});

/** Remember where the user is in a guided tour (resumes on any device). */
export async function saveTourProgressAction(raw: unknown): Promise<ActionResult<undefined>> {
  return runAction('saveTourProgress', async () => {
    const user = await requireUser();
    await enforceRateLimit('dashboardWriteByUser', user.userId);
    const input = parseInput(schema, raw);
    const db = getDb();
    const row = await db.user.findUniqueOrThrow({
      where: { id: user.userId },
      select: { tourProgress: true },
    });
    const progress = readTourProgress(row.tourProgress);
    progress[input.tour] = { step: input.step, done: input.done };
    await db.user.update({
      where: { id: user.userId },
      data: { tourProgress: progress as unknown as Prisma.InputJsonValue },
    });
    return undefined;
  });
}
