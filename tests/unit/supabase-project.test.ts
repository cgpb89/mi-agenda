import { describe, expect, it } from 'vitest';
import { projectRefFromApiUrl, projectRefFromDbUrl } from '@/lib/supabase-project';

describe('Supabase project identification', () => {
  it('reads the ref from the API URL', () => {
    expect(projectRefFromApiUrl('https://abcd1234.supabase.co')).toBe('abcd1234');
    expect(projectRefFromApiUrl('https://example.com')).toBeNull();
    expect(projectRefFromApiUrl(undefined)).toBeNull();
  });

  it('reads the ref from pooler and direct Postgres URLs', () => {
    expect(
      projectRefFromDbUrl(
        'postgresql://tempo_app.abcd1234:pw@aws-0-eu-west-1.pooler.supabase.com:6543/postgres',
      ),
    ).toBe('abcd1234');
    expect(
      projectRefFromDbUrl('postgresql://postgres:pw@db.abcd1234.supabase.co:5432/postgres'),
    ).toBe('abcd1234');
    expect(projectRefFromDbUrl('postgresql://u:pw@localhost:5432/db')).toBeNull();
    expect(projectRefFromDbUrl('not a url')).toBeNull();
  });
});
