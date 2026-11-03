import type { Metadata } from 'next';
import { getServerI18n } from '../../i18n/server';
import type { Lang } from '../../i18n/dictionaries';

const COPY: Record<Lang, { title: string; documents: string; operator: string; booking: string; booking1: string; booking2: string; mirror: string; mirror1: string; mirror2: string; account: string; account1: string; updated: string }> = {
  ru: {
    title: 'Условия использования', documents: 'Документы', operator: 'Оператор сайта: [Наименование ИП / ООО], Кыргызская Республика, г. Бишкек.',
    booking: 'Онлайн-запись', booking1: 'Запись создаётся в статусе «Ожидает подтверждения» и подтверждается администратором по телефону или в мессенджере. Цены указаны в сомах (KGS) и фиксируются в момент записи.',
    booking2: 'Отменить запись онлайн можно не позднее чем за 3 часа до визита (срок может быть изменён салоном). Позже — по телефону. При неявке без предупреждения салон вправе ограничить онлайн-запись.',
    mirror: 'Виртуальное зеркало', mirror1: 'Каждому аккаунту доступно 3 бесплатные ИИ-примерки. Попытка списывается только при запуске генерации; проверка фото бесплатна. При сбое генерации попытка возвращается автоматически. Результат является ИИ-визуализацией и может отличаться от реальной стрижки.',
    mirror2: 'Запрещено загружать фото других людей без их согласия, а также изображения несовершеннолетних. Сервис может быть временно недоступен.',
    account: 'Аккаунт', account1: 'Вход — через Google или email. Удалить аккаунт можно в разделе «Профиль»; повторная регистрация не восстанавливает бесплатные ИИ-попытки.', updated: 'Последнее обновление: ноябрь 2026 г.',
  },
  ky: {
    title: 'Колдонуу шарттары', documents: 'Документтер', operator: 'Сайттын оператору: [Жеке ишкердин / ЖЧКнын аталышы], Кыргыз Республикасы, Бишкек шаары.',
    booking: 'Онлайн жазылуу', booking1: 'Жазылуу «Ырастоону күтүп жатат» статусунда түзүлөт жана администратор тарабынан телефон же мессенжер аркылуу ырасталат. Баалар сом (KGS) менен көрсөтүлүп, жазылган учурда бекитилет.',
    booking2: 'Жазылууну визитке чейин кеминде 3 саат калганда сайттан жокко чыгарса болот (салон бул мөөнөттү өзгөртө алат). Андан кеч болсо телефон аркылуу байланышыңыз. Эскертүүсүз келбей калган учурда салон онлайн жазылууну чектей алат.',
    mirror: 'Виртуалдык күзгү', mirror1: 'Ар бир аккаунтка 3 акысыз ЖИ-сынамык берилет. Аракет генерация башталганда гана эсептен алынат; сүрөттү текшерүү акысыз. Генерация ишке ашпай калса, аракет автоматтык түрдө кайтарылат. Натыйжа — ЖИ-визуализация жана чыныгы чач жасалгасынан айырмаланышы мүмкүн.',
    mirror2: 'Башка адамдардын сүрөттөрүн алардын макулдугусуз, ошондой эле жашы жете электердин сүрөттөрүн жүктөөгө тыюу салынат. Кызмат убактылуу иштебей калышы мүмкүн.',
    account: 'Аккаунт', account1: 'Google же email аркылуу кирүүгө болот. Аккаунтту «Профиль» бөлүмүнөн өчүрсө болот; кайра катталганда акысыз ЖИ-аракеттер калыбына келбейт.', updated: 'Акыркы жаңыртуу: 2026-жылдын ноябры.',
  },
  en: {
    title: 'Terms of use', documents: 'Documents', operator: 'Website operator: [Individual business / LLC name], Bishkek, Kyrgyz Republic.',
    booking: 'Online booking', booking1: 'A booking is created with the status “Awaiting confirmation” and confirmed by an administrator by phone or messenger. Prices are shown in Kyrgyz soms (KGS) and fixed when the booking is made.',
    booking2: 'You can cancel online up to 3 hours before your visit (the salon may change this period). After that, contact us by phone. The salon may restrict online booking after an unannounced no-show.',
    mirror: 'Virtual Mirror', mirror1: 'Each account includes 3 free AI try-ons. A try-on is deducted only when generation starts; photo validation is free. If generation fails, the try-on is restored automatically. Results are AI visualizations and may differ from an actual haircut.',
    mirror2: 'Do not upload photos of other people without their consent or photos of minors. The service may be temporarily unavailable.',
    account: 'Account', account1: 'Sign in with Google or email. You can delete your account from the Profile section; registering again does not restore free AI try-ons.', updated: 'Last updated: November 2026.',
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const { lang } = await getServerI18n();
  return { title: COPY[lang].title };
}

export default async function TermsPage() {
  const { lang } = await getServerI18n();
  const c = COPY[lang];
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <p className="eyebrow mb-5">{c.documents}</p>
      <h1 className="mb-6 font-serif text-4xl text-text-primary sm:text-5xl">{c.title}</h1>
      <div className="space-y-4 text-sm leading-relaxed text-text-secondary">
        <p>{c.operator}</p>
        <h2 className="pt-2 text-lg text-text-primary">{c.booking}</h2><p>{c.booking1}</p><p>{c.booking2}</p>
        <h2 className="pt-2 text-lg text-text-primary">{c.mirror}</h2><p>{c.mirror1}</p><p>{c.mirror2}</p>
        <h2 className="pt-2 text-lg text-text-primary">{c.account}</h2><p>{c.account1}</p>
        <p className="text-xs text-text-secondary/60">{c.updated}</p>
      </div>
    </div>
  );
}
