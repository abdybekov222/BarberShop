export function StarRating({ value, label }: { value: number; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-0.5 text-gold-500"
      aria-label={`${label} ${value} / 5`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill={i <= Math.round(value) ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.2"
          aria-hidden="true"
        >
          <polygon points="7,1 8.8,5.2 13.4,5.6 10.1,8.5 11.1,13 7,10.5 2.9,13 3.9,8.5 0.6,5.6 5.2,5.2" />
        </svg>
      ))}
      <span className="ml-1 text-xs text-text-secondary">{value}</span>
    </span>
  );
}
