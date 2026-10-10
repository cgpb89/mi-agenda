import { vi } from 'vitest';
import { applyTestEnv, loadTestDbConfig } from '../support/test-db-guard';

// Refuses to continue unless a separate, allow-listed test DB is configured.
applyTestEnv(loadTestDbConfig());

vi.mock('next/headers', () => import('../support/next-mocks'));
vi.mock('next/cache', () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
