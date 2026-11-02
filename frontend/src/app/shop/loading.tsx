import { ProductCardSkeleton } from '../../components/shop/ProductCard';

/** Скелетон каталога, пока сервер загружает товары. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-screen px-4 pb-24 pt-10 sm:px-6 lg:px-10" aria-busy="true">
      <div className="h-16 w-64 animate-pulse rounded bg-bg-elevated-2" />
      <div className="mt-4 h-4 w-96 max-w-full animate-pulse rounded bg-bg-elevated-2" />
      <div className="mt-10 h-12 animate-pulse rounded-sm bg-bg-elevated-2" />
      <div className="mt-12 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
