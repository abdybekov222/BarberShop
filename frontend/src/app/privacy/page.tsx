import type { Metadata } from 'next';
import { getServerI18n } from '../../i18n/server';
import type { Lang } from '../../i18n/dictionaries';

const COPY: Record<Lang, { title: string; operator: string; collection: string; retention: string; rights: string; updated: string }> = {
  ru: {
    title: 'Политика конфиденциальности',
    operator: 'Оператор: [Наименование ИП / ООО], Кыргызская Республика.',
    collection: 'Мы собираем персональные данные (имя, номер телефона, email и фото) только для записи на услуги и работы сервиса «Виртуальное зеркало».',
    retention: 'Фотографии для ИИ-примерки хранятся не более 7 дней, результаты генерации — не более 14 дней, после чего автоматически удаляются.',
    rights: 'Вы можете запросить удаление своих данных в любой момент в разделе «Профиль» личного кабинета.',
    updated: 'Последнее обновление: октябрь 2026 г.',
  },
  ky: {
    title: 'Купуялык саясаты',
    operator: 'Оператор: [Жеке ишкердин / ЖЧКнын аталышы], Кыргыз Республикасы.',
    collection: 'Биз жеке маалыматтарды (аты-жөнү, телефон номери, email жана сүрөт) кызматтарга жазылуу жана «Виртуалдык күзгү» кызматын иштетүү үчүн гана чогултабыз.',
    retention: 'ЖИ-сынамык үчүн жүктөлгөн сүрөттөр 7 күндөн ашык эмес, түзүлгөн натыйжалар 14 күндөн ашык эмес сакталат. Андан кийин алар автоматтык түрдө өчүрүлөт.',
    rights: 'Маалыматтарыңызды каалаган убакта жеке кабинеттеги «Профиль» бөлүмүнөн өчүрүүнү сурансаңыз болот.',
    updated: 'Акыркы жаңыртуу: 2026-жылдын октябры.',
  },
  en: {
    title: 'Privacy policy',
    operator: 'Operator: [Individual business / LLC name], Kyrgyz Republic.',
    collection: 'We collect personal data (name, phone number, email, and photos) only to manage service bookings and operate the Virtual Mirror service.',
    retention: 'Photos uploaded for AI try-ons are kept for no more than 7 days, and generated results for no more than 14 days. They are then deleted automatically.',
    rights: 'You can request deletion of your data at any time from the Profile section of your account.',
    updated: 'Last updated: October 2026.',
  },
};

export function generateMetadata(): Metadata {
  return { title: COPY[getServerI18n().lang].title };
}

export default function PrivacyPage() {
  const c = COPY[getServerI18n().lang];
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-6 font-serif text-3xl text-text-primary">{c.title}</h1>
      <div className="prose prose-invert space-y-4 text-sm leading-relaxed text-text-secondary">
        <p>{c.operator}</p>
        <p>{c.collection}</p>
        <p>{c.retention}</p>
        <p>{c.rights}</p>
        <p className="text-xs text-text-secondary/60">{c.updated}</p>
      </div>
    </div>
  );
}
