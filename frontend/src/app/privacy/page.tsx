import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Политика конфиденциальности',
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-serif text-text-primary mb-6">
        Политика конфиденциальности
      </h1>
      <div className="prose prose-invert text-text-secondary text-sm leading-relaxed space-y-4">
        <p>
          Оператор: [Наименование ИП / ООО], Кыргызская Республика.
        </p>
        <p>
          Мы собираем персональные данные (имя, номер телефона, email, фото) исключительно
          для целей записи на услуги и работы сервиса «Виртуальное зеркало».
        </p>
        <p>
          Фотографии для ИИ-примерки хранятся не более 7 дней, результаты генерации —
          не более 14 дней, после чего автоматически удаляются.
        </p>
        <p>
          Пользователь вправе запросить удаление своих данных в любой момент через
          раздел «Профиль» в личном кабинете.
        </p>
        <p className="text-xs text-text-secondary/60">
          Последнее обновление: октябрь 2026 г.
        </p>
      </div>
    </div>
  );
}
