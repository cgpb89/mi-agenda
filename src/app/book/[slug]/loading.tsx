import { PageLoading } from '@/components/ui/PageLoading';
import { getI18n } from '@/i18n/server';

export default async function Loading() {
  const { t } = await getI18n();
  return <PageLoading label={t.common.loading} variant="center" />;
}
