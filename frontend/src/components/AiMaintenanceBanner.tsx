import Link from 'next/link';

/**
 * Премиальный баннер при выключенном ИИ-зеркале (kill switch, ТЗ §1.5).
 * Без слов «ошибка» и «лимит бюджета» — только предложение записаться.
 */
export function AiMaintenanceBanner() {
  return (
    <div className="relative overflow-hidden rounded-sm border border-gold-500/30 bg-bg-elevated px-6 py-10 text-center">
      <div className="gold-line w-12 mx-auto mb-6" />
      <p className="font-serif text-2xl text-text-primary mb-3">ИИ-зеркало на техобслуживании</p>
      <p className="text-text-secondary mb-8 max-w-md mx-auto">
        Запишитесь к мастеру вживую — подберём образ на месте.
      </p>
      <Link
        href="/booking"
        className="inline-flex items-center justify-center rounded-sm px-8 h-12 font-semibold bg-gold-500 hover:bg-gold-400 text-black"
      >
        Записаться
      </Link>
    </div>
  );
}
