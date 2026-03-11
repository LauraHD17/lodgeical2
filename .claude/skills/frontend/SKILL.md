---
name: frontend
description: Lodge-ical frontend development — React 19 SPA with Vite, TanStack Query, Tailwind CSS, Radix UI, Phosphor Icons. Use when building React components, creating admin pages, writing query/mutation hooks, styling with design tokens, or adding MSW mock data.
user-invocable: true
disable-model-invocation: false
---

# Lodge-ical Frontend

Codebase-specific patterns for the Lodge-ical React SPA. For full architecture docs see `CLAUDE.md` and `src/CLAUDE.md`. This skill focuses on actionable checklists and copy-paste patterns.

## New Admin Page Checklist

Every new admin page requires changes in exactly these files:

1. **Create page** — `src/pages/admin/{PageName}.jsx`
   - Default export, function component
   - UPPERCASE h1: `font-heading text-[24px] sm:text-[32px] text-text-primary uppercase`
   - Get property context: `const { propertyId } = useProperty()`

2. **Add route** — `src/config/routes.js`
   ```js
   { path: '/page-name', pageName: 'PageName', permission: PERMISSIONS.MANAGE_XXX, isPublic: false }
   // Optional: navHidden: true, navLabel: 'Display Name'
   ```

3. **Register in App.jsx** — `src/App.jsx`
   - Add lazy import: `const PageName = lazy(() => import('@/pages/admin/PageName'))`
   - Add to `pageMap`: `PageName,`

4. **Add query keys** (if data-fetching) — `src/config/queryKeys.js`
   ```js
   entityName: {
     all: ['entityName'],
     list: (propertyId, filters) => ['entityName', 'list', propertyId, filters],
     detail: (id) => ['entityName', 'detail', id],
   },
   ```

5. **Add permission** (if new) — `src/lib/auth/permissions.js`
   - Add constant and update `ROLE_PERMISSIONS` for owner/manager/staff

6. **Add mock data** — `src/mocks/db.js` + `src/mocks/handlers.js`
   - Export fixture array from `db.js` using `daysFromNow()` for relative dates
   - Add GET/POST/PATCH/DELETE handlers in `handlers.js`

## Import Order

```js
// 1. React
import { useState, useMemo, useCallback } from 'react'

// 2. Third-party
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { Plus, MagnifyingGlass } from '@phosphor-icons/react'

// 3. Internal libs
import { supabase } from '@/lib/supabaseClient'
import { useProperty } from '@/lib/property/useProperty'
import { cn, dollars } from '@/lib/utils'
import { queryKeys } from '@/config/queryKeys'

// 4. Components
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DataTable } from '@/components/shared/DataTable'

// 5. Hooks
import { useReservations } from '@/hooks/useReservations'
```

Always use `@/` path alias. Never relative imports.

## Query Hook Pattern

```js
function useEntityList(filters) {
  const { propertyId } = useProperty()
  return useQuery({
    queryKey: queryKeys.entity.list(propertyId, filters),
    queryFn: async () => {
      if (!propertyId) return []
      const { data, error } = await supabase
        .from('table_name')
        .select('*')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!propertyId,
  })
}
```

Rules:
- `queryKey` from `src/config/queryKeys.js` factory — never inline
- `enabled: !!propertyId` guard on all property-scoped queries
- Return `data ?? []` for lists

## Mutation Pattern (Edge Function)

```js
function useCreateEntity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input) => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/function-name`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify(input),
        }
      )
      const json = await res.json()
      if (!res.ok) throw json
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entity.all })
    },
  })
}
```

## Mutation Pattern (Direct Supabase)

For simple CRUD without edge function logic:

```js
const { error } = await supabase
  .from('table_name')
  .upsert({ ...values, property_id: propertyId })
if (error) { addToast({ message: error.message, variant: 'error' }); return }
queryClient.invalidateQueries({ queryKey: queryKeys.entity.all })
addToast({ message: 'Saved', variant: 'success' })
```

## Form Pattern (React Hook Form + Zod)

```js
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1, 'Name required'),
  email: z.string().email('Valid email required'),
  amount_cents: z.coerce.number().min(0),
  notes: z.string().optional(),
})

const { register, handleSubmit, formState: { errors }, reset } = useForm({
  resolver: zodResolver(schema),
  defaultValues: { name: '', email: '', amount_cents: 0, notes: '' },
})
```

## UI Primitives (reuse these, don't reinvent)

| Component | Import | Key Props |
|-----------|--------|-----------|
| `Button` | `@/components/ui/Button` | `variant` (primary/secondary/destructive/ghost), `size` (sm/md/lg), `loading` |
| `Input` | `@/components/ui/Input` | Standard input + `label`, `error` |
| `Select` | `@/components/ui/Select` | Radix-based, `label`, `options`, `value`, `onValueChange` |
| `Modal` | `@/components/ui/Modal` | `open`, `onClose`, `title` |
| `Drawer` | `@/components/ui/Drawer` | `open`, `onClose`, `title`, 480px side panel |
| `ConfirmDialog` | `@/components/ui/ConfirmDialog` | `open`, `onConfirm`, `onCancel`, `variant` (danger) |
| `HelpTip` | `@/components/ui/HelpTip` | `text` — inline "?" tooltip for jargon |
| `DataTable` | `@/components/shared/DataTable` | `columns`, `data`, `loading`, `onRowClick`, `emptyState` |
| `StatusChip` | `@/components/shared/StatusChip` | `status`, `type` (reservation/payment/inquiry) |
| `FolderCard` | `@/components/shared/FolderCard` | `tabColor` (hex), dashboard card shells |
| `Price` | `@/components/shared/Price` | `cents` — IBM Plex Mono currency display |
| `ErrorState` | `@/components/shared/ErrorState` | Error fallback with retry |

## Typical Admin Page Structure

```jsx
export default function PageName() {
  const { propertyId } = useProperty()
  const { data, isLoading } = useEntityList()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selected, setSelected] = useState(null)

  return (
    <div className="flex flex-col gap-10">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-[24px] sm:text-[32px] text-text-primary uppercase">
          Page Title
        </h1>
        <Button onClick={() => { setSelected(null); setDrawerOpen(true) }}>
          <Plus size={16} weight="bold" /> Add New
        </Button>
      </div>

      {/* Filter bar (optional) */}
      <div className="flex items-center gap-3">
        <Input placeholder="Search..." />
      </div>

      {/* Data table */}
      <DataTable
        columns={columns}
        data={data ?? []}
        loading={isLoading}
        onRowClick={(row) => { setSelected(row); setDrawerOpen(true) }}
      />

      {/* Side drawer */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}
        title={selected ? 'Edit Item' : 'New Item'}>
        {/* Form content */}
      </Drawer>
    </div>
  )
}
```

## Phosphor Icon Weights

- **Navigation/sidebar**: `weight="fill" size={14}`
- **Empty states**: `weight="fill" size={28}`
- **Action buttons** (Plus, Check, X): `weight="bold"`
- **Status indicators**: `weight="fill"`
- Never use `weight="light"` or `weight="regular"`
- `CloudDrizzle` does not exist — use `CloudFog`

## Styling Rules

- **Design tokens only** — never raw hex. Use `bg-surface`, `text-text-primary`, `border-border`.
- **Zero shadows** — depth via borders and surface color tiers: `bg-background` < `bg-surface` < `bg-surface-raised`.
- **Typography**: `font-heading` (Syne) for h1/h2, `font-body` (IBM Plex Sans) for text, `font-mono` (IBM Plex Mono) for numbers/prices/dates/IDs.
- **Buttons**: `rounded-none`, `tracking-[-0.01em]`, `active:scale-[0.98]`, min 44px height.
- **Inputs**: 44px height, `border-[1.5px]`, `rounded-[6px]`, labels above (never floating).

## MSW Mock Data Pattern

In `src/mocks/db.js`:
```js
export const MOCK_ENTITIES = [
  {
    id: 'entity-001',
    property_id: PROPERTY_ID,
    name: 'Example',
    created_at: daysFromNow(-5) + 'T10:00:00Z',
  },
]
```

In `src/mocks/handlers.js`:
```js
http.get(`${BASE}/rest/v1/table_name`, ({ request }) =>
  pgRespond(request, MOCK_ENTITIES),
),
http.post(`${BASE}/rest/v1/table_name`, () =>
  HttpResponse.json({}, { status: 201 }),
),
http.patch(`${BASE}/rest/v1/table_name`, () =>
  new HttpResponse(null, { status: 204 }),
),
```

## Forbidden

- No hardcoded hex colors (use design tokens)
- No payment math in frontend (server-side via Edge Functions)
- No class components
- No inline query keys (use `queryKeys.js` factory)
- No hardcoded route paths (use `routes.js`)
- No unapproved packages
- No `VITE_` env vars with secrets
- No TypeScript in frontend (use JSDoc if needed)
- No `weight="light"` or `weight="regular"` on Phosphor icons
