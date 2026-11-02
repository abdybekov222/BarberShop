import type { Lang } from '../../i18n/dictionaries';

/** Тексты страницы «О нас» на трёх языках. */
export const ABOUT_COPY: Record<
  Lang,
  {
    title: string;
    lead: string;
    startTitle: string;
    start: [string, string];
    timeline: { year: string; text: string }[];
    beliefTitle: string;
    principles: { title: string; text: string }[];
    photoAlts: [string, string, string, string, string];
    team: string;
    profiles: string;
    exp: string;
    visit: string;
    hours: string;
  }
> = {
  ru: {
    title: 'О нас',
    lead: 'BARS — небольшой барбершоп в центре Бишкека. Три мастера, три кресла и правило, которое мы не нарушаем с первого дня: гость уходит с той стрижкой, о которой договорились.',
    startTitle: 'Как всё началось',
    start: [
      'Азамат десять лет стриг в чужих салонах и устал от потока: двадцать минут на человека, следующий уже ждёт в дверях. В 2019 году он снял помещение на Московской и поставил одно кресло.',
      'Название придумали за вечер. Барс — снежный барс с гор, которые видно из окна. Сильный, спокойный и немного упрямый — примерно таким мы видим хорошего мастера.',
    ],
    timeline: [
      { year: '2019', text: 'Азамат Карыев открывает кресло на Московской, 123. Одно кресло, кофемашина и запись через Instagram.' },
      { year: '2021', text: 'Второе кресло и первый ученик — Нурбек. Начинаем делать королевское бритьё с горячими полотенцами.' },
      { year: '2023', text: 'В команду приходит Эрлан. Появляется полка с косметикой: клиенты просили продавать то, чем мы укладываем.' },
      { year: '2026', text: 'Запускаем онлайн-запись, магазин и ИИ-примерку, чтобы гость приходил уже с понятной идеей.' },
    ],
    beliefTitle: 'Во что мы верим',
    principles: [
      { title: 'Час на гостя', text: 'Не ставим записи впритык. Есть время спросить, как вы укладываетесь по утрам, и объяснить, почему мы предлагаем именно эту форму.' },
      { title: 'Честная цена', text: 'Цена в прайсе — окончательная. Мытьё головы и укладка уже входят в стрижку, доплат «за длину» и «за сложность» нет.' },
      { title: 'Чистые инструменты', text: 'Ножницы и машинки дезинфицируем после каждого гостя, лезвия опасной бритвы — одноразовые.' },
    ],
    photoAlts: ['Кресло в зале BARS', 'Инструменты мастера', 'Бритьё', 'Оформление бороды', 'Фейд'],
    team: 'Команда',
    profiles: 'Профили мастеров',
    exp: 'стаж, лет',
    visit: 'Заходите знакомиться',
    hours: 'Пн–Сб 10:00–20:00',
  },
  ky: {
    title: 'Биз жөнүндө',
    lead: 'BARS — Бишкектин борборундагы чакан барбершоп. Үч чебер, үч кресло жана биринчи күндөн бузбаган эреже: конок макулдашкан чач тарач менен кетет.',
    startTitle: 'Баары кантип башталды',
    start: [
      'Азамат он жыл башка салондордо иштеп, агымдан чарчады: бир кишиге жыйырма мүнөт, кийинкиси эшикте күтүп турат. 2019‑жылы ал Московская көчөсүнөн жай ижарага алып, бир кресло койду.',
      'Атын бир кечте ойлоп таптык. Барс — терезеден көрүнгөн тоолордун илбирси. Күчтүү, токтоо жана бир аз өжөр — жакшы чеберди биз ушундай элестетебиз.',
    ],
    timeline: [
      { year: '2019', text: 'Азамат Карыев Московская, 123 дарегинде кресло ачат. Бир кресло, кофе машина жана Instagram аркылуу жазылуу.' },
      { year: '2021', text: 'Экинчи кресло жана биринчи шакирт — Нурбек. Ысык сүлгү менен падышалык кырынууну баштайбыз.' },
      { year: '2023', text: 'Командага Эрлан келет. Косметика текчеси пайда болот: кардарлар биз колдонгон каражаттарды сатууну суранышты.' },
      { year: '2026', text: 'Онлайн‑жазылууну, дүкөндү жана ИИ‑сынамыкты ишке киргизебиз — конок даяр идея менен келиши үчүн.' },
    ],
    beliefTitle: 'Эмнеге ишенебиз',
    principles: [
      { title: 'Конокко бир саат', text: 'Жазылууларды тыгыз койбойбуз. Эртең менен чачыңызды кантип жасаарыңызды сурап, эмне үчүн дал ушул форманы сунуштаганыбызды түшүндүрүүгө убакыт бар.' },
      { title: 'Адилет баа', text: 'Прайстагы баа — акыркы. Чач жуу жана жасалгалоо чач тарачка кирет, «узундук» же «татаалдык» үчүн кошумча акы жок.' },
      { title: 'Таза аспаптар', text: 'Кайчы жана машинкаларды ар бир коноктон кийин дезинфекциялайбыз, устара мизи — бир жолку.' },
    ],
    photoAlts: ['BARS залындагы кресло', 'Чебердин аспаптары', 'Кырынуу', 'Сакал жасалгалоо', 'Фейд'],
    team: 'Команда',
    profiles: 'Чеберлердин профилдери',
    exp: 'тажрыйба, жыл',
    visit: 'Таанышууга келиңиз',
    hours: 'Дш–Иш 10:00–20:00',
  },
  en: {
    title: 'About us',
    lead: 'BARS is a small barbershop in central Bishkek. Three barbers, three chairs and one rule we have kept since day one: you leave with exactly the cut we agreed on.',
    startTitle: 'How it started',
    start: [
      'Azamat spent ten years cutting hair in other salons and got tired of the conveyor: twenty minutes per client, the next one already waiting at the door. In 2019 he rented a room on Moskovskaya street and put in a single chair.',
      'We came up with the name in one evening. Bars is the snow leopard of the mountains you can see from our window — strong, calm and a little stubborn. That is how we see a good barber.',
    ],
    timeline: [
      { year: '2019', text: 'Azamat Karyev opens a chair at Moskovskaya 123. One chair, a coffee machine and bookings via Instagram.' },
      { year: '2021', text: 'A second chair and the first apprentice, Nurbek. We start doing royal shaves with hot towels.' },
      { year: '2023', text: 'Erlan joins the team. A grooming shelf appears: clients asked us to sell what we style them with.' },
      { year: '2026', text: 'We launch online booking, the shop and the AI try-on so guests arrive with a clear idea.' },
    ],
    beliefTitle: 'What we believe in',
    principles: [
      { title: 'An hour per guest', text: 'We never book back-to-back. There is time to ask how you style your hair in the morning and explain why we suggest this shape.' },
      { title: 'Honest price', text: 'The price on the menu is final. Wash and styling are included, no extra charges for length or complexity.' },
      { title: 'Clean tools', text: 'Scissors and clippers are disinfected after every guest, straight-razor blades are single-use.' },
    ],
    photoAlts: ['Chair at BARS', 'Barber tools', 'Shave', 'Beard grooming', 'Fade'],
    team: 'Team',
    profiles: 'Barber profiles',
    exp: 'years of experience',
    visit: 'Come say hello',
    hours: 'Mon–Sat 10:00–20:00',
  },
};
