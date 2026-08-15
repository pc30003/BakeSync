# BakeSync — Product & Codebase Context

This steering file is always included in every Kiro session for this workspace.
It gives the AI complete context on what BakeSync is, how it is built, and the
conventions to follow when making changes.

---

## What BakeSync Is

BakeSync is an **autonomous, agentic AI platform** for commercial bakeries and
pastry kitchens. Its core purpose is to eliminate the manual cognitive overhead
of production planning and inventory management so bakers can focus on craft.

The system continuously monitors incoming demand across all sales channels,
reasons over complex constraints (multi-stage baking schedules, perishable shelf
lives, oven capacity, staff shifts), and takes proactive action — generating
production schedules, flagging ingredient shortfalls, and dispatching procurement
recommendations — without waiting for human instruction.

---

## Deployment Model

BakeSync is a **Progressive Web App (PWA)** built with Next.js 14 (App Router).

- Installable from the browser on any device — no app store required
- Offline-resilient: critical data cached via Workbox / next-pwa
- Push notifications via Web Push API (VAPID) for real-time agent alerts
- Theme colour: `#D97706` (amber). Background: `#FFFBEB` (warm cream)

---

## User Roles & Primary Interfaces

| Role | Primary device | Key responsibilities |
|---|---|---|
| `HEAD_BAKER` | Desktop / large tablet | Review AI schedules, manage recipes, view analytics, approve/override agent decisions |
| `FLOOR_STAFF` | Wall-mounted tablet / mobile | Check shift checklists, tick off prep steps, log real-time wastage |
| `PURCHASING_MANAGER` | Mobile / desktop | Receive procurement recommendations, one-click approve supplier orders, track deliveries |

Role is stored on the `User` model and enforced in:
- `app/page.tsx` — redirects to role-specific dashboard on login
- `components/layout/nav-config.ts` — filters nav items per role
- API routes — `requireAuth(["HEAD_BAKER"])` guards mutating endpoints

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14, App Router, TypeScript |
| Styling | Tailwind CSS with BakeSync design tokens in `tailwind.config.ts` |
| Database | PostgreSQL via **Prisma 5** ORM |
| Auth | **NextAuth v5** (JWT strategy) — credentials + Google OAuth |
| State / data fetching | **TanStack Query** (client), Next.js server components (server) |
| PWA | **next-pwa** + Workbox + custom SW at `public/sw-custom.js` |
| Charts | Recharts |
| Validation | Zod |
| Client state | Zustand (for future global state needs) |

---

## Project Structure

```
BakeSync/
├── app/
│   ├── (auth)/              # Login page — unauthenticated route group
│   ├── (dashboard)/         # All authenticated pages — wraps AppShell
│   │   └── dashboard/
│   │       ├── head-baker/      # HEAD_BAKER role dashboard
│   │       ├── floor-staff/     # FLOOR_STAFF role dashboard
│   │       ├── purchasing/      # PURCHASING_MANAGER role dashboard
│   │       ├── orders/          # Shared orders table
│   │       ├── inventory/       # Shared stock levels table
│   │       ├── schedule/        # 3-day production schedule view
│   │       ├── recipes/         # Recipe card library
│   │       ├── analytics/       # KPI + wastage analytics
│   │       ├── alerts/          # Agent alert inbox
│   │       ├── wastage/         # Wastage logging form
│   │       └── suppliers/       # Supplier directory
│   └── api/                 # Next.js route handlers
│       ├── auth/[...nextauth]/
│       ├── orders/
│       ├── recipes/
│       ├── inventory/        # + /deduct, /wastage sub-routes
│       ├── schedules/        # + /[id]/batches/[batchId]/checklist
│       ├── procurement/      # + /[id]/approve
│       ├── alerts/
│       ├── analytics/
│       └── suppliers/
├── components/
│   ├── auth/                # LoginForm
│   ├── layout/              # AppShell, Sidebar, TopBar, nav-config
│   ├── floor/               # FloorShiftChecklist, WastageLogForm
│   ├── purchasing/          # ProcurementApproveButton
│   └── ui/                  # Shared primitives (Button, Card, Badge, StatCard, etc.)
├── lib/
│   ├── db.ts                # Prisma client singleton
│   ├── auth.ts              # NextAuth config + JWT callbacks
│   ├── api-helpers.ts       # ok/created/error/notFound/requireAuth
│   ├── utils.ts             # cn, formatGrams, formatCurrency, formatDate, color helpers
│   └── push-notifications.ts # Browser-side VAPID push helpers
├── prisma/
│   ├── schema.prisma        # Full DB schema
│   └── seed.ts              # Demo bakery seed data
├── types/                   # Shared TypeScript interfaces (index.ts re-exports all)
│   ├── user.ts, order.ts, recipe.ts, inventory.ts
│   ├── schedule.ts, analytics.ts, agent.ts
└── public/
    ├── manifest.json        # PWA manifest
    ├── sw-custom.js         # Custom SW: push + background sync
    └── icons/               # PWA icons (see README inside for generation)
```

---

## Core Domain Concepts

### Ingredient stock & FEFO
- All ingredient quantities are stored **in grams** internally (display units vary)
- `IngredientLot` tracks lot codes and expiry dates
- The `@@index([ingredientId, expiryDate])` on `IngredientLot` enforces
  **First-Expiry, First-Out** ordering when consuming stock
- Alert levels: `OK → LOW → CRITICAL → OUT_OF_STOCK`
- Stock deductions are transactional (`db.$transaction`) — they update both
  `StockDeduction` log and `Ingredient.stockGrams` atomically

### Production scheduling
- A `ProductionSchedule` is unique on `(bakeryId, scheduleDate, shiftType)`
- Schedules are auto-generated by the AI agent (`AgentAction` of type
  `GENERATE_SCHEDULE`) and must be approved by a HEAD_BAKER before being live
- `ProductionBatch` has a `scaleFactor` — how many multiples of the base recipe
  to produce. Ingredient deductions multiply `RecipeIngredient.quantityGrams ×
  scaleFactor × (1 + wastageBufferPercent/100)`
- `ChecklistItem` rows are the step-by-step prep list shown to FLOOR_STAFF

### Agentic engine
- `AgentAction` records every autonomous decision the system makes
- `AgentAlert` is the user-facing notification layer (severity: INFO / WARNING /
  CRITICAL)
- The agent worker (not yet implemented — stub in `POST /api/schedules`) should
  be triggered via a background job queue (e.g. BullMQ or Inngest)
- Agent decisions that `requiresApproval = true` must be approved by HEAD_BAKER
  before taking effect

### Procurement
- `ProcurementRecommendation` is generated when `stockGrams < reorderThresholdGrams`
  relative to upcoming production demand
- Urgency levels: `LOW → MEDIUM → HIGH → CRITICAL`
- One-click approval is via `POST /api/procurement/[id]/approve`

---

## API Conventions

All API routes follow a consistent response envelope:

```ts
// Success
{ success: true, data: T }

// Error
{ success: false, error: string }

// Validation error (422)
{ success: false, error: "Validation error", issues: ZodIssue[] }
```

HTTP status codes:
- `200` GET success, `201` POST created, `204` DELETE no content
- `401` unauthenticated, `403` wrong role, `404` not found
- `409` conflict (e.g. insufficient stock), `422` validation error, `500` server error

Role guards use `requireAuth(roles?)` from `lib/api-helpers.ts`.
All write endpoints verify the resource `bakeryId` matches `session.user.bakeryId`
before mutating (multi-tenancy isolation).

---

## UI / Component Conventions

- **Server components by default** — only add `"use client"` when the component
  needs browser APIs, event handlers, or React hooks
- **Tailwind only** — no inline styles, no CSS modules
- Touch targets must be at minimum 44×44 px — use the `.tap-target` utility class
  (`min-h-[44px] min-w-[44px]`) on all interactive elements used by floor staff
- Use `cn()` from `lib/utils.ts` for conditional class merging (clsx + tailwind-merge)
- Prefer the shared primitives in `components/ui/` before reaching for Radix or
  building custom. Add new primitives to `components/ui/` when they'll be reused
  across 2+ pages
- Loading states use `Skeleton` / `CardSkeleton` from `components/ui/loading-skeleton.tsx`
- Empty states use `EmptyState` from `components/ui/empty-state.tsx`
- Page titles use `PageHeader` from `components/ui/page-header.tsx`

---

## Design Tokens (BakeSync Brand)

| Token | Value | Use |
|---|---|---|
| Primary | `#D97706` amber | Buttons, active nav, accents |
| Primary light | `#FEF3C7` | Alert backgrounds, highlights |
| Brown | `#78350F` | Dark text on light backgrounds |
| Cream | `#FFFBEB` | Page background |
| Sage | `#4B7C59` | Success states, accent |
| Destructive | `hsl(0 84% 60%)` | Errors, CRITICAL alerts |

---

## Getting Started (after Node.js is installed)

```bash
# 1. Install dependencies
npm install

# 2. Copy environment variables
cp .env.example .env
# Fill in DATABASE_URL, NEXTAUTH_SECRET, OPENAI_API_KEY, VAPID keys

# 3. Generate Prisma client and run migrations
npm run db:generate
npm run db:migrate

# 4. Seed with demo data
npm run db:seed

# 5. Generate PWA icons (requires logo SVG)
npx pwa-asset-generator ./logo.svg ./public/icons --manifest ./public/manifest.json

# 6. Start dev server
npm run dev
```

---

## What Is Not Yet Built (Next Priorities)

1. **Agent worker** — the actual AI scheduling engine behind `AgentAction`.
   Recommend: OpenAI function calling or LangChain agent with a BullMQ/Inngest
   job queue. Entry point stub is in `POST /api/schedules`.

2. **Omnichannel order ingestion** — webhooks from Shopify, Square POS, etc.
   Env vars are pre-configured in `.env.example`.

3. **Demand forecasting** — `DemandForecast` type is defined; ML model TBD.

4. **Push subscription persistence** — `POST /api/push/subscribe` route needs
   to be created to store Web Push subscription objects in the database.

5. **Recipe ingredient editing** — the recipe detail page needs a full CRUD UI
   for ingredients and stages (type definitions and API routes are ready).

6. **Oven capacity visualiser** — Gantt-style timeline showing `OvenCapacityBlock`
   alongside scheduled batches (data model is ready).

7. **PWA icons** — placeholder SVGs need to be generated (see `public/icons/README.md`).
