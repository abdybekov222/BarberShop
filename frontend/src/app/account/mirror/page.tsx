'use client';

import { useAuth } from '../../../lib/auth-context';
import { useI18n } from '../../../i18n/I18nProvider';
import { MirrorWizard } from './MirrorWizard';

export default function MirrorPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  if (!user) return null;

  return (
    <div className="max-w-3xl">
      <h1 className="mb-2 font-serif text-4xl text-text-primary sm:text-5xl">{t('mr.title')}</h1>
      <p className="mb-8 text-text-secondary">{t('mr.lead')}</p>
      <MirrorWizard />
    </div>
  );
}
