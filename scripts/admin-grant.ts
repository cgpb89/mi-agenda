/**
 * Platform-admin bootstrap (CLI only — there is no default admin account).
 *
 *   npm run admin:grant -- --email you@company.com            # grant
 *   npm run admin:grant -- --email you@company.com --revoke   # revoke
 *
 * The user must already exist (sign up normally first). Uses DIRECT_URL.
 * The change is audited and the user's sessions are revoked so the new role
 * takes effect on next sign-in.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const args = process.argv.slice(2);
const emailArg = args[args.indexOf('--email') + 1];
const revoke = args.includes('--revoke');
if (!args.includes('--email') || !emailArg) {
  console.error('Usage: npm run admin:grant -- --email you@company.com [--revoke]');
  process.exit(1);
}
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error('Set DIRECT_URL (or DATABASE_URL).');
  process.exit(1);
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url, max: 1 }, { schema: 'app' }),
});

async function main() {
  const email = emailArg!.normalize('NFKC').trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    console.error('No user with that email. Sign up first, then run this again.');
    process.exit(1);
  }
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { platformRole: revoke ? 'NONE' : 'ADMIN' } }),
    db.session.deleteMany({ where: { userId: user.id } }),
    db.auditLog.create({
      data: {
        actorUserId: null,
        actorType: 'system',
        action: 'platform.admin_granted',
        targetType: 'user',
        targetId: user.id,
        metadata: { revoked: revoke, via: 'cli' },
      },
    }),
  ]);
  console.log(
    `${revoke ? 'Revoked' : 'Granted'} platform admin for ${email}. Their sessions were signed out.`,
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
