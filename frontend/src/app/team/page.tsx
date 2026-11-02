import type { Metadata } from 'next';
import { PageHeader } from '../../components/PageHeader';
import { PHOTOS } from '../../lib/brand';
import { TeamGrid, type TeamMaster } from './TeamGrid';
import { getServerI18n } from '../../i18n/server';

export function generateMetadata(): Metadata {
  const { t } = getServerI18n();
  return { title: t('pg.team.title'), description: t('pg.team.lead') };
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function getMasters(): Promise<TeamMaster[]> {
  try {
    const res = await fetch(`${API}/api/masters`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function TeamPage() {
  const masters = await getMasters();
  const { t } = getServerI18n();
  return (
    <>
      <PageHeader eyebrow={t('pg.team.eyebrow')} title={t('pg.team.title')} photo={PHOTOS.shave}>
        {t('pg.team.lead')}
      </PageHeader>
      <div className="mx-auto max-w-screen px-4 sm:px-6 lg:px-10 py-14">
        <TeamGrid masters={masters} />
      </div>
    </>
  );
}
