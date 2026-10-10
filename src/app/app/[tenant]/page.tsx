import { redirect } from 'next/navigation';

export default async function TenantIndex({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  redirect(`/app/${tenant}/overview`);
}
