import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Specs assert on the English source text, so they run with an empty
// Portuguese dictionary: every t() call falls back to English whatever the
// configured language. src/frontend/i18n specs unmock it to test the real one.
vi.mock('./src/frontend/i18n/locales/pt-BR', () => ({ ptBR: {} }));
