# Contributing to AWE System

Thank you for your interest in contributing! **AWE System** (Academic Writing Evaluator) is an open-source academic project that uses Google Gemini AI to assess student writing against standardised rubrics. It is developed for Sultan Qaboos University's Foundation and Post-Foundation English programmes.

---

## Getting Started

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** 9+ (or compatible package manager)
- **Google Gemini API key** — required for the AI assessment feature
- **Git** for version control

### Setup

1. **Fork** the repository on GitHub and **clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/awe-system.git
   cd awe-system
   ```

2. **Install** dependencies:
   ```bash
   npm install
   ```

3. **Set up environment variables** (copy `.env.example` if available, or create `.env.local`):
   ```
   # No env vars are strictly required — the Gemini API key can be entered
   # in the app's Settings screen and is persisted in localStorage.
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Development

### Code Style

- **TypeScript strict mode** is enabled in `tsconfig.json`
- **ESLint** with the Next.js config (`eslint-config-next`) enforces consistent style
- Components use **Tailwind CSS v4** for styling — avoid inline styles
- Follow the existing naming conventions:
  - Components: PascalCase (e.g. `ErrorBoundary.tsx`)
  - Utilities: camelCase (e.g. `recalculateScores`)
  - Test files: `*.test.ts` or `*.test.tsx` inside `src/__tests__/`

### Useful Commands

| Command | Description |
|---|---|
| `npm run dev` | Start dev server on port 3000 |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest test suite |
| `npx tsc --noEmit` | Type-check without emitting files |
| `npm run db:push` | Push Prisma schema to database |
| `npm run db:generate` | Regenerate Prisma client |

---

## Testing

Tests are written with **Vitest** and should be placed in `src/__tests__/`.

### Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode
npx vitest

# Run a specific test file
npx vitest src/__tests__/scoring-utils.test.ts
```

### Writing Tests

- Import from `vitest`: `describe`, `it`, `expect`, `vi`, etc.
- Use the `@/` path alias for project imports
- Test files should cover the happy path, edge cases, and error conditions
- Pure utility functions (e.g. `scoring-utils.ts`) are the best candidates for unit tests

### Test Structure Example

```ts
import { describe, it, expect } from 'vitest';
import { myFunction } from '@/lib/my-module';

describe('myFunction', () => {
  it('handles normal input', () => {
    expect(myFunction('input')).toBe('expected');
  });

  it('handles edge case: empty input', () => {
    expect(myFunction('')).toBe('');
  });
});
```

---

## Pull Request Process

1. **Create a feature branch** from `main`:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** with appropriate tests and documentation updates.

3. **Ensure quality checks pass** before submitting:
   ```bash
   npm run lint          # ESLint — no errors
   npx tsc --noEmit      # TypeScript type check
   npm test              # All tests pass
   npm run build         # Production build succeeds
   ```

4. **Commit** with clear, conventional commit messages (e.g. `fix: correct score rounding`, `feat: add dark mode toggle`).

5. **Push** your branch and **open a Pull Request** on GitHub with:
   - A clear description of what changed and why
   - Links to any related issues
   - Confirmation that all checks pass

6. A maintainer will review and provide feedback. Be responsive to review comments.

---

## Project Structure

The AWE System follows an extracted component architecture within a Next.js App Router project:

```
src/
├── app/                    # Next.js App Router pages and layouts
│   ├── layout.tsx          # Root layout with providers
│   └── page.tsx            # Main entry point
├── components/
│   ├── layout/             # Layout components (BottomNav, OfflineIndicator, etc.)
│   ├── screens/            # Screen-level components (Welcome, Upload, Results, etc.)
│   └── ui/                 # Reusable UI primitives (Button, Card, Dialog, etc.)
├── lib/
│   ├── store.ts            # Zustand state management (types + store)
│   ├── scoring-utils.ts    # Score calculation & feedback parsing
│   └── ...                 # Other utility modules
├── __tests__/              # Vitest test files
│   └── scoring-utils.test.ts
└── hooks/                  # Custom React hooks
```

---

## Reporting Issues

If you find a bug or have a feature request, please [open an issue](https://github.com/<your-org>/awe-system/issues) on GitHub. Include:

- **Steps to reproduce** the bug
- **Expected behaviour** vs. actual behaviour
- **Screenshots** if applicable
- **Browser/OS** information
- Whether you'd like to work on the fix yourself

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](./LICENSE) file for details.
