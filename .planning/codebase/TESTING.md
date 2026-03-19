# Testing Patterns

**Analysis Date:** 2026-03-19

## Test Framework

**Runner:** None configured.

No test framework is installed or configured in this project. There are no `jest.config.*`, `vitest.config.*`, or `playwright.config.*` files. No `.test.ts`, `.test.tsx`, `.spec.ts`, or `.spec.tsx` files exist anywhere in the codebase.

**`playwright`** is listed as a dependency in `package.json` at version `^1.55.0`, but no Playwright configuration or test files exist. The dependency appears unused.

**Run Commands:**
```bash
# No test command exists in package.json scripts
# Available scripts:
npm run dev       # Development server
npm run build     # Production build
npm start         # Production start
npm run check     # TypeScript type checking only (tsc)
npm run db:push   # Push schema changes
```

## Type Checking as Substitute

The only automated quality verification is TypeScript type checking via `npm run check` (`tsc --noEmit`).

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noEmit": true
  },
  "exclude": ["**/*.test.ts"]
}
```

The `exclude` pattern `**/*.test.ts` in `tsconfig.json` anticipates future test files but none exist yet.

## Test File Organization

**Location:** Not established — no test files exist.

**Naming:** Not established.

**Structure:** Not established.

## data-testid Attributes

Despite no tests existing, 270 `data-testid` attributes are present across the frontend codebase. This indicates preparation for future UI testing. The naming pattern follows:

```
data-testid="[element-type]-[descriptor]"
```

**Examples found:**
- `data-testid="input-chat-message"` — `client/src/components/AIChat.tsx`
- `data-testid="button-ai-search"` — `client/src/components/AISearchBubble.tsx`
- `data-testid="input-ai-search"` — `client/src/components/AISearchBubble.tsx`
- `data-testid="button-ai-search-submit"` — `client/src/components/AISearchBubble.tsx`
- `data-testid="button-back-to-portal"` — `client/src/components/CRMLayout.tsx`
- `data-testid="input-phone"` — `client/src/pages/UserManagement.tsx`

The `[element-type]-[descriptor]` naming convention is consistent and selector-friendly for Playwright/Cypress.

## Mocking

Not applicable — no tests exist.

## Fixtures and Factories

Not applicable — no tests exist.

## Coverage

**Requirements:** None enforced.

**Coverage tooling:** Not configured.

## Current Quality Safeguards (Non-Test)

In the absence of tests, quality is maintained through:

1. **TypeScript strict mode** — catches type mismatches, null/undefined errors at compile time
2. **Zod schema validation** — runtime validation of all API request bodies via `insertSchema.parse(req.body)` or `schema.safeParse(req.body)`
3. **Drizzle ORM type safety** — query results typed against `shared/schema.ts` definitions
4. **React Hook Form + Zod** — frontend form validation prevents malformed submissions

## Recommended Test Setup (When Adding Tests)

Based on the stack (React 18, Vite, Express, TypeScript, Playwright already installed), the natural choices would be:

**Unit/Integration:**
- Vitest — Vite-native, no config needed for basic setup
- Config file: `vitest.config.ts` at project root
- Test location: co-located `*.test.ts` / `*.test.tsx` alongside source files

**E2E:**
- Playwright — already installed at `playwright ^1.55.0`
- Config file: `playwright.config.ts` at project root
- Test location: `tests/` or `e2e/` directory
- `data-testid` selectors already in place — use `page.getByTestId('input-ai-search')`

**Example Playwright test structure using existing data-testids:**
```typescript
// e2e/ai-search.spec.ts
import { test, expect } from '@playwright/test';

test('AI search returns results', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('button-ai-search').click();
  await page.getByTestId('input-ai-search').fill('2 bed flat in Brixton');
  await page.getByTestId('button-ai-search-submit').click();
  await expect(page.getByTestId('button-property-result-1')).toBeVisible();
});
```

## Test Coverage Gaps (Priority Order)

**High Priority — No coverage at all:**
- Authentication flow (`server/auth.ts`) — password hashing, session management, login/logout
- `shared/schema.ts` Zod schema validation — insert schemas, custom schemas
- `server/storage.ts` — 2399-line data access layer with all CRUD operations
- Financial calculations — `server/financeRoutes.ts`, `server/accountingRoutes.ts`
- `client/src/lib/queryClient.ts` — `apiRequest()` helper used everywhere

**Medium Priority:**
- `server/crmRoutes.ts` — 16,766 lines, highest complexity/risk file in the codebase
- Role/permission checks — `requireAgent` middleware and clearance-gated routes
- Tenancy onboarding workflow — multi-step process in `server/tenancyOnboardingRoutes.ts`

**Low Priority:**
- Public-facing pages (EstateAgentHome, PropertyListingsPage) — mostly display logic
- CRMLayout navigation — covered by data-testids but low business logic risk

---

*Testing analysis: 2026-03-19*
