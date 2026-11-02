import { fileURLToPath } from 'node:url';

// Абсолютный путь к конфигу: стили собираются корректно, даже если Next запущен не из apps/web
export default {
  plugins: {
    tailwindcss: { config: fileURLToPath(new URL('./tailwind.config.ts', import.meta.url)) },
    autoprefixer: {},
  },
};
