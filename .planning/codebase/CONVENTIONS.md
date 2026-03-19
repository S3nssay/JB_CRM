# Coding Conventions

**Analysis Date:** 2026-03-19

## Naming Patterns

**Files:**
- React page components: PascalCase, e.g. `LandlordDirectory.tsx`, `CRMDashboard.tsx`
- React feature components: PascalCase, e.g. `CRMLayout.tsx`, `BulkPropertyOperations.tsx`
- Hooks: kebab-case with `use-` prefix, e.g. `use-auth.tsx`, `use-toast.ts`, `use-mobile.tsx`
- Backend route files: camelCase with `Routes` suffix, e.g. `crmRoutes.ts`, `financeRoutes.ts`
- Backend service files: camelCase with `Service` suffix, e.g. `emailService.ts`, `paymentService.ts`
- Utility/lib files: camelCase, e.g. `queryClient.ts`, `utils.ts`

**Functions:**
- React components: PascalCase — `export default function CRMDashboard()`
- Event handlers: camelCase with verb prefix — `handleActivity`, `toggleLandlord`, `resetActivityTimer`
- Async route handlers: inline anonymous async functions on router calls
- Utility functions: camelCase verbs — `formatCurrency`, `formatPence`, `hashPassword`, `comparePasswords`
- Middleware: camelCase constants — `const requireAgent = (req, res, next) => ...`

**Variables:**
- Standard variables: camelCase — `searchTerm`, `expandedLandlords`, `currentDay`
- Constants/config objects: camelCase — `statusConfig`, `urgencyColor`, `STEP_LABELS` (UPPER_SNAKE for module-level domain constants)
- Module-level domain constants: UPPER_SNAKE_CASE — `SESSION_TIMEOUT`, `LAST_ACTIVITY_KEY`, `SECURITY_CLEARANCE_LEVELS`

**Types/Interfaces:**
- Interfaces: PascalCase with descriptive name — `DirectoryLandlord`, `DirectoryProperty`, `CRMLayoutProps`
- Props interfaces: PascalCase with `Props` suffix — `CRMLayoutProps`, `ProtectedRouteProps`, `BulkPropertyOperationsProps`
- Type aliases: PascalCase — `AuthContextType`, `UnauthorizedBehavior`
- Drizzle-inferred types: exported from `shared/schema.ts` as PascalCase — `User`, `Landlord`, `Tenant`
- Insert schemas: `Insert` prefix — `InsertUser`, `InsertLandlord`, `InsertProperty`

## Code Style

**Formatting:**
- No Prettier or ESLint config file detected — formatting is unenforced at tooling level
- Single quotes for string literals in most files; some files use double quotes (inconsistency present)
- Trailing commas in multi-line arrays/objects (inconsistent)
- 2-space indentation throughout

**Linting:**
- No ESLint config detected — TypeScript strict mode is the primary safety net
- TypeScript: `strict: true` in `tsconfig.json`

**TypeScript:**
- Strict mode enabled — all code must satisfy `tsc` via `npm run check`
- `any` used occasionally in route handlers: `req: any`, `res: any`; accepted pattern for Express routes
- Generic typing used for API requests: `apiRequest<T>(url, method, data)`
- Drizzle types inferred from schema using `$inferSelect` / `$inferInsert` via drizzle-zod

## Import Organization

**Order (observed pattern in page files):**
1. React core imports — `import { useState, useEffect } from 'react'`
2. Routing — `import { useLocation, Link } from 'wouter'`
3. Data fetching — `import { useQuery, useMutation } from '@tanstack/react-query'`
4. UI primitives — `import { Card, CardContent, ... } from '@/components/ui/card'`
5. Icons — `import { Building2, Users, ... } from 'lucide-react'`
6. Local hooks — `import { useToast } from '@/hooks/use-toast'`
7. Local components — `import { PropertyCard } from '@/components/PropertyCard'`
8. Utilities — `import { apiRequest, queryClient } from '@/lib/queryClient'`
9. Shared types — `import { ... } from '@shared/schema'`

**Path Aliases:**
- `@/*` maps to `client/src/` — used for all client-side imports
- `@shared/*` maps to `shared/` — used for schema types and shared utilities
- No relative paths like `../../` — always use aliases

## Error Handling

**Backend routes — standard try/catch pattern:**
```typescript
router.get('/resource', async (req, res) => {
  try {
    const result = await storage.getResource(id);
    if (!result) return res.status(404).json({ error: 'Resource not found' });
    res.json(result);
  } catch (error) {
    console.error('Error fetching resource:', error);
    res.status(500).json({ error: 'Failed to fetch resource' });
  }
});
```

**Zod validation errors — handled explicitly:**
```typescript
if (error instanceof z.ZodError) {
  return res.status(400).json({ error: 'Invalid data', details: error.errors });
}
```

**Frontend queries — throw on error, display via toast:**
```typescript
const { data = [] } = useQuery({
  queryKey: ['/api/crm/resource'],
  queryFn: async () => {
    const res = await fetch('/api/crm/resource', { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch resource');
    return res.json();
  }
});
```

**Frontend mutations — `onError` with toast:**
```typescript
const mutation = useMutation({
  mutationFn: async (data) => apiRequest('/api/crm/resource', 'POST', data),
  onSuccess: () => { toast({ title: 'Success', description: '...' }); },
  onError: (error: Error) => { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
});
```

**Global API helper — throws on non-ok response:**
`apiRequest()` in `client/src/lib/queryClient.ts` calls `throwIfResNotOk()` which throws `new Error(\`${res.status}: ${text}\`)`.

## Logging

**Backend:** `console.error()` for caught errors in route handlers — 500+ occurrences across backend files. No structured logging library.

**Pattern:**
```typescript
console.error('Error fetching invoices:', error);
console.log('Contact column migration note:', err.message);
```

**Frontend:** No frontend logging; errors surfaced via toast notifications only.

## Comments

**When to Comment:**
- Section dividers in large route files: `// ==========================================`
- Brief intent comments for non-obvious logic: `// Debounce activity updates to prevent performance issues`
- TODO comments for deferred work (sparse, 3 found in codebase)
- Migration notices: `// Ensure valuation workflow columns exist on contact table`

**JSDoc/TSDoc:** Not used — TypeScript types serve as documentation.

## Form Design

**Validated forms use React Hook Form + Zod:**
```typescript
const formSchema = z.object({
  propertyId: z.string().min(1, 'Property required'),
  category: z.enum(['plumbing', 'electrical', ...]),
});

const form = useForm({
  resolver: zodResolver(formSchema),
  defaultValues: { propertyId: '', category: 'routine' }
});
```

**Form fields use shadcn/ui `Form*` components:**
```tsx
<FormField
  control={form.control}
  name="category"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Category</FormLabel>
      <FormControl><Input {...field} /></FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

**Submission via `form.handleSubmit(onSubmit)` calling a mutation.**

## Component Design

**Page components:**
- One `export default function` per file (PascalCase matching filename)
- Internal sub-components defined above the main export or as named functions within the file
- State at top of component body; queries below state declarations
- Inline sub-components acceptable for small render helpers (e.g. `StatsCard` in `CRMDashboard.tsx`)

**Shared components:**
- Props typed via `interface ComponentNameProps`
- Exported as named exports for non-page components: `export function ProtectedRoute()`
- Default export for CRMLayout: `export default function CRMLayout()`

**Loading states:**
- `<Loader2 className="animate-spin" />` from lucide-react is the universal loading indicator
- Pattern: `if (isLoading) return <div>...<Loader2 /></div>`

## Schema Validation Pattern (Backend)

**Request body validation:**
```typescript
// Using Drizzle-zod generated insert schemas
const data = insertInvoiceSchema.parse(req.body);
// OR safeParse for non-throwing validation
const result = registerSchema.safeParse(req.body);
if (!result.success) return res.status(400).json({ error: '...', details: result.error.format() });
```

**Schema source:** All insert schemas generated from `shared/schema.ts` via `createInsertSchema()` from `drizzle-zod`. Custom schemas (e.g. `loginSchema`, `registerSchema`) also defined in `shared/schema.ts`.

## Authentication Middleware Pattern

```typescript
const requireAgent = (req: any, res: any, next: any) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.role !== 'admin' && req.user.role !== 'agent') {
    return res.status(403).json({ error: 'Not authorized' });
  }
  next();
};
```

Applied as: `financeRouter.get('/invoices', requireAgent, async (req, res) => { ... })`

## React Query Conventions

**Query keys:** URL strings matching the API endpoint — `['/api/crm/landlords/directory']`

**Default config** (from `client/src/lib/queryClient.ts`):
- `staleTime: Infinity` — no automatic background refetching
- `refetchOnWindowFocus: false`
- `retry: false`

**Data defaults:** `const { data: items = [] } = useQuery(...)` — default empty array avoids null checks.

**Invalidation after mutations:**
```typescript
queryClient.invalidateQueries({ queryKey: ['/api/crm/resource'] });
```

## Styling Conventions

**Tailwind classes:**
- Responsive: `md:`, `lg:` prefixes
- Brand colors inline: `bg-[#791E75]`, `text-[#F8B324]` (purple and gold)
- Utility function `cn()` from `client/src/lib/utils.ts` merges conditional classes: `cn('base-class', condition && 'conditional-class')`

**shadcn/ui components** used for all UI primitives — never raw HTML `<button>`, `<input>`, etc. in CRM pages.

---

*Convention analysis: 2026-03-19*
