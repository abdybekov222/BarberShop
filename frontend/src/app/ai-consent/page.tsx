import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Согласие на обработку фото',
};

/**
 * Текст согласия на обработку биометрии для ИИ-примерки (ТЗ §1.5).
 * Версия должна совпадать с AI_CONSENT_VERSION в apps/api/src/ai/ai.constants.ts.
 */
export default function AiConsentPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <p className="eyebrow mb-5">Документы</p>
      <h1 className="text-4xl sm:text-5xl font-serif text-text-primary mb-2">
        Согласие на обработку фото для ИИ-примерки
      </h1>
      <p className="text-xs text-text-secondary/60 mb-8">Версия 2026-11-01</p>

      <section className="text-text-secondary text-sm leading-relaxed space-y-3 mb-10" lang="ru">
        <h2 className="text-lg text-text-primary">Русский</h2>
        <p>
          <b className="text-text-primary">Оператор:</b> [Наименование ИП / ООО], г. Бишкек,
          Кыргызская Республика.
        </p>
        <p>
          <b className="text-text-primary">Цель:</b> виртуальная примерка причёсок и бороды
          («Виртуальное зеркало»).
        </p>
        <p>
          <b className="text-text-primary">Данные:</b> фотография лица, загруженная пользователем, и
          результат её обработки.
        </p>
        <p>
          <b className="text-text-primary">Третьи лица:</b> ИИ-провайдер, выполняющий генерацию
          изображения. Обработка может происходить за пределами Кыргызской Республики. Провайдер
          не хранит фото и не использует их для обучения моделей.
        </p>
        <p>
          <b className="text-text-primary">Срок хранения:</b> исходное фото — 7 дней, результат —
          14 дней, затем удаляются автоматически.
        </p>
        <p>
          <b className="text-text-primary">Ваши права:</b> вы можете в любой момент удалить фото и
          результаты, отозвать согласие и удалить аккаунт в личном кабинете.
        </p>
        <p>Подтверждаю, что мне исполнилось 18 лет и на фото изображён я.</p>
      </section>

      <section className="text-text-secondary text-sm leading-relaxed space-y-3" lang="ky">
        <h2 className="text-lg text-text-primary">Кыргызча</h2>
        <p>
          Мен «Виртуалдык күзгү» кызматы аркылуу чач жасалгаларын виртуалдык түрдө сынап көрүү
          максатында бетимдин сүрөтүн иштетүүгө макулдугумду берем. Сүрөт Кыргыз Республикасынан
          тышкары жайгашкан ИИ-провайдерге берилиши мүмкүн. Баштапкы сүрөт 7 күн, натыйжа 14 күн
          сакталат, андан кийин автоматтык түрдө өчүрүлөт. Макулдукту каалаган убакта жеке
          кабинетте кайтарып алып, маалыматтарды өчүрө алам. Мен 18 жашка толгомун.
        </p>
      </section>
    </div>
  );
}
