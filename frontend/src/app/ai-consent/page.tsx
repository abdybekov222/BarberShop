import type { Metadata } from 'next';
import { getServerI18n } from '../../i18n/server';
import type { Lang } from '../../i18n/dictionaries';

const COPY: Record<Lang, { title: string; documents: string; version: string; operator: string; purpose: string; data: string; parties: string; retention: string; rights: string; age: string }> = {
  ru: {
    title: 'Согласие на обработку фото для ИИ-примерки', documents: 'Документы', version: 'Версия 2026-11-01', operator: 'Оператор', purpose: 'Цель', data: 'Данные', parties: 'Третьи лица', retention: 'Срок хранения', rights: 'Ваши права', age: 'Подтверждаю, что мне исполнилось 18 лет и на фото изображён я.',
  },
  ky: {
    title: 'ЖИ-сынамык үчүн сүрөттү иштетүүгө макулдук', documents: 'Документтер', version: '2026-11-01 версиясы', operator: 'Оператор', purpose: 'Максаты', data: 'Маалыматтар', parties: 'Үчүнчү тараптар', retention: 'Сактоо мөөнөтү', rights: 'Сиздин укуктарыңыз', age: 'Мен 18 жашка толгонумду жана сүрөттө өзүм тартылганымды ырастайм.',
  },
  en: {
    title: 'Consent to photo processing for AI try-ons', documents: 'Documents', version: 'Version 2026-11-01', operator: 'Operator', purpose: 'Purpose', data: 'Data', parties: 'Third parties', retention: 'Retention period', rights: 'Your rights', age: 'I confirm that I am at least 18 years old and that the photo shows me.',
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const { lang } = await getServerI18n();
  return { title: COPY[lang].title };
}

/** Consent text for AI try-ons. Keep the version aligned with AI_CONSENT_VERSION on the API. */
export default async function AiConsentPage() {
  const { lang } = await getServerI18n();
  const c = COPY[lang];
  const name = '[Наименование ИП / ООО]';
  const content: Record<Lang, { operator: string; purpose: string; data: string; parties: string; retention: string; rights: string }> = {
    ru: {
      operator: `${name}, г. Бишкек, Кыргызская Республика.`,
      purpose: 'Виртуальная примерка причёсок и бороды в сервисе «Виртуальное зеркало».',
      data: 'Фотография лица, загруженная пользователем, и результат её обработки.',
      parties: 'ИИ-провайдер, выполняющий генерацию изображения. Обработка может происходить за пределами Кыргызской Республики. Провайдер не хранит фотографии и не использует их для обучения моделей.',
      retention: 'Исходное фото хранится 7 дней, результат — 14 дней, затем файлы удаляются автоматически.',
      rights: 'Вы можете в любой момент удалить фото и результаты, отозвать согласие и удалить аккаунт в личном кабинете.',
    },
    ky: {
      operator: `${name}, Бишкек шаары, Кыргыз Республикасы.`,
      purpose: '«Виртуалдык күзгү» кызматында чач жасалгаларын жана сакалды виртуалдык түрдө сынап көрүү.',
      data: 'Колдонуучу жүктөгөн беттин сүрөтү жана аны иштетүүнүн натыйжасы.',
      parties: 'Сүрөттү түзүүчү ЖИ-провайдер. Иштетүү Кыргыз Республикасынын аймагынан тышкары жүргүзүлүшү мүмкүн. Провайдер сүрөттөрдү сактабайт жана моделдерди үйрөтүү үчүн колдонбойт.',
      retention: 'Баштапкы сүрөт 7 күн, натыйжа 14 күн сакталат, андан кийин файлдар автоматтык түрдө өчүрүлөт.',
      rights: 'Сүрөттөрдү жана натыйжаларды каалаган убакта өчүрүп, макулдукту кайтарып алып, жеке кабинеттен аккаунтту өчүрө аласыз.',
    },
    en: {
      operator: `${name}, Bishkek, Kyrgyz Republic.`,
      purpose: 'Virtual try-ons of hairstyles and beards through the Virtual Mirror service.',
      data: 'The face photo uploaded by the user and the result of processing that photo.',
      parties: 'The AI provider that generates the image. Processing may take place outside the Kyrgyz Republic. The provider does not store photos or use them to train models.',
      retention: 'The original photo is kept for 7 days and the result for 14 days; files are then deleted automatically.',
      rights: 'You can delete your photos and results, withdraw consent, and delete your account from your account page at any time.',
    },
  };
  const d = content[lang];
  const rows = [[c.operator, d.operator], [c.purpose, d.purpose], [c.data, d.data], [c.parties, d.parties], [c.retention, d.retention], [c.rights, d.rights]];
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <p className="eyebrow mb-5">{c.documents}</p>
      <h1 className="mb-2 font-serif text-4xl text-text-primary sm:text-5xl">{c.title}</h1>
      <p className="mb-8 text-xs text-text-secondary/60">{c.version}</p>
      <section lang={lang} className="space-y-3 text-sm leading-relaxed text-text-secondary">
        {rows.map(([label, value]) => <p key={label}><b className="text-text-primary">{label}:</b> {value}</p>)}
        <p>{c.age}</p>
      </section>
    </div>
  );
}
