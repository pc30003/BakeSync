# BakeSync — Developer Memo & Portfolio Document
# Written by the original developer for future reference and AI context.
# Pass this to any AI assistant to get full context on the app.

---

## Overview

BakeSync is an autonomous, agentic AI platform for commercial bakeries. It was built as a competition entry and placed 2nd overall. The app is fully deployed, working, and production-grade. It was built entirely using Kiro (AI coding assistant by Amazon) alongside the developer's own design decisions, architecture choices, and problem-solving.

**Live URL:** https://bakesync-demo.vercel.app
**GitHub:** https://github.com/pc30003/BakeSync
**Demo password (all accounts):** demo1234
**Demo logins:**
- Head Baker: head@artisanloaf.com
- Floor Staff: floor@artisanloaf.com
- Purchasing Manager: purchasing@artisanloaf.com

---

## The Problem It Solves

A head baker manually solves a complex daily puzzle: what to bake, how much, when to start each multi-stage recipe, whether there's enough oven capacity and stock, and whether perishable ingredients will expire. This lives entirely in one person's head or spreadsheets. Consequences:
- Ingredient waste (perishables spoil)
- Stockouts (blocked production when ingredients run out)
- Reactive purchasing (too late given supplier lead times)
- Demand blindness (orders across multiple channels, no single view)
- Knowledge concentration risk (one sick day disrupts operations)

---

## The Solution — Agentic Loop: Sense → Reason → Act

BakeSync operates on a continuous three-stage cycle:

**1. SENSE:** A proactive monitor runs on a schedule (Vercel Cron, 2am UTC daily reset + hourly monitor) and reads the full bakery state — stock levels, ingredient lot expiry dates, and upcoming orders.

**2. REASON:** The snapshot is passed to OpenAI GPT-4o via structured function calling (not a chatbot — real function calling with a typed JSON schema). The model reasons over hard constraints: oven capacity, multi-stage baking timelines, FEFO stock rules, shelf life. Returns a typed, validated production plan.

**3. ACT:** The plan is written to the database: production schedules, step-by-step prep checklists, transactional stock deductions, procurement recommendations, and user-facing alerts. Decisions with business risk (production schedules) require human approval before going live.

---

## Why It's Truly Agentic

- Acts on its **own schedule**, unprompted — nobody clicks "check stock"
- **Decides** what matters — which problems to flag, which actions to take
- **Self-corrects** — retries failed actions, auto-resolves alerts when the problem is fixed (restock an ingredient → its shortfall alert clears; generate a schedule → the "no schedule" warning resolves)
- **Human-in-the-loop** for high-stakes decisions — agent proposes, human approves

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router), TypeScript end-to-end |
| AI | OpenAI GPT-4o, structured function calling, temperature 0.2 |
| Database | PostgreSQL via Prisma 5 ORM |
| Auth | NextAuth v5, JWT strategy, role-based access control |
| Data fetching | TanStack Query (client) + Next.js server components (server) |
| PWA | next-pwa + Workbox, installable, offline-resilient, Web Push |
| Charts | Recharts |
| Validation | Zod |
| Deployment | Vercel (serverless, Vercel Cron for scheduled jobs) |
| AI tooling | Built with Kiro (Amazon AI coding assistant) |

---

## Architecture

- **Multi-tenant:** every record scoped by `bakeryId`; every write verifies ownership before mutating
- **Role-based access control:** `HEAD_BAKER`, `FLOOR_STAFF`, `PURCHASING_MANAGER` — enforced server-side on every sensitive endpoint
- **Atomic stock mutations:** all deductions/restores wrapped in `db.$transaction()` — no partial state
- **PWA:** installable on any device, offline-resilient, push notifications via VAPID
- **Demo:** daily reset at 2am UTC via Vercel Cron keeps data fresh for judges

---

## User Roles & Interfaces

### Head Baker (desktop/tablet)
- Reviews and approves AI-generated production schedules
- Manages recipes
- Views analytics and agent activity
- Overrides agent decisions
- Completes and archives finished production runs

### Floor Staff (wall-mounted tablet/mobile)
- Touch-optimised step-by-step prep checklists
- Ticks off steps in sequential order
- Each tick deducts ingredients from stock in real time
- Logs wastage (experience-based estimation)

### Purchasing Manager (mobile/desktop)
- Receives demand-aware AI procurement recommendations
- One-click approval restocks instantly and clears related alerts
- Views supplier directory

---

## Key Features (all built, working, deployed)

### 1. Agent Command Center
Live operations dashboard with:
- Dynamic status header that changes with system state ("All systems nominal" vs "N issues need attention")
- Live ticking clock (proves real-time, not a recording)
- Animated metric tiles: critical alerts, warnings, actions today, failures
- Inline "fix it here" action buttons on every alert (Order now / View inventory / Generate schedule)
- Severity spine on alert cards (bold color-coded left border)
- Pulsing status indicator

### 2. Proactive Monitoring
- Runs automatically on a schedule (Vercel Cron)
- Detects: critical/out-of-stock ingredients, imminent expiry, demand gaps (orders due with no schedule)
- Auto-resolves alerts when problem is fixed
- Self-healing: retries failed agent actions up to 3 times
- Never logs no-op "all healthy" runs (keeps feed high-signal)

### 3. AI Production Scheduling
- OpenAI GPT-4o via structured function calling
- Reasons over: oven capacity, recipe timing, multi-stage baking, FEFO stock rules, shelf life
- Live streaming reasoning log (judges watch the AI think in real time)
- **Deterministic low-stock guardrail:** after AI proposes a plan, the code clamps each batch's scaleFactor/quantity to what real ingredient stock can actually cover — the AI proposes, the code enforces. Never schedules more than physically exists.
- Human approval required before schedule goes live
- AI reasoning notes attached to every schedule

### 4. Production Lifecycle (Complete & Archive)
- "Complete & archive run" button appears only when ALL checklist steps are done
- On close: run is snapshotted into a dedicated `ProductionRunHistory` table (denormalized — survives resets), live schedule row is deleted (freeing the slot for the next run)
- History stacks — multiple completed runs pile up as a permanent auditable record
- Consumed stock stays deducted (irreversible — ingredients were really used)
- Floor staff view clears automatically after close
- Slot is freed so the same shift can be run again

### 5. Autonomous Procurement
- Demand-aware AI recommendations (not just stock threshold alerts)
- Perishability-aware reasoning: orders perishables (dairy, fruit) in smaller frequent batches; allows larger buffers for stable goods (flour, sugar)
- One-click approval instantly restocks and clears related shortfall alerts
- Idempotency guard: prevents double-ordering within 10 minutes
- "Last restocked" column on inventory ticks live in real time (seconds-level)

### 6. FEFO-Aware Stock Management
- Ingredient lots tracked with expiry dates
- Monitor flags lots nearing expiry (within 3 days) so staff use them first
- All stock deductions are precise (grams) and atomic (transactional)
- Stock can go negative by design (deduct/restore symmetric — no phantom stock)
- Alert levels: OK → LOW → CRITICAL → OUT_OF_STOCK

### 7. Real-Time Inventory
- Live stock bars per ingredient
- Alert-level badges
- "Last restocked" live-ticking relative time (seconds → minutes → hours)
- Reflects every restock path: manual approval OR autonomous AI order
- Grouped by alert level (OUT_OF_STOCK first)

### 8. Floor Execution
- Step-by-step checklists generated from AI-planned batches
- Sequential enforcement (can't skip steps)
- Each step tick deducts ingredients in real time
- Progress bars update instantly
- "Shift complete" banner when all steps done
- Wastage logging (experience-based estimation, feeds analytics)

### 9. Wastage Logging
- Logs ingredient/product wastage with reason and shift date
- Deducts from stock
- Experience-based estimation (not scientific measurement — baker estimates grams)
- Feeds analytics loop for pattern spotting

### 10. Auditable Reasoning Trail
- Every autonomous decision logged with its reasoning and timestamp
- Two zones: "Needs attention" (open alerts, severity-sorted) and "Agent activity" (history of actions)
- Expandable details show full reasoning JSON
- No black-box decisions

### 11. Analytics
- KPI dashboard (revenue, orders, wastage trends)
- Wastage analytics by ingredient and shift

---

## Key Engineering Decisions & Why

### Deterministic stock guardrail
The AI is told to scale down for low stock, but that's a soft instruction — not guaranteed. So after the AI proposes a schedule, the code deterministically clamps each batch to what stock can physically cover. The AI proposes; the code enforces. Result: negative stock from AI generation is now impossible.

### Stacking Production History (snapshot pattern)
Schedules have a unique constraint: one per (bakery, date, shift). Instead of marking runs "closed" (which caused resurrection bugs — regenerating would flip the closed row back to active), completed runs are snapshotted into a separate `ProductionRunHistory` table (denormalized text, no foreign keys except bakeryId). The live schedule row is then deleted, freeing the slot. History stacks because there's no unique constraint on the history table. The snapshot survives resets because the bakery cascade deletes it cleanly.

### Stable demo user IDs
The daily demo reset deletes and recreates all users. If users get new random IDs each reset, browsers still holding old JWT sessions would have stale user IDs — causing foreign key violations on any write (wastage logs, approvals). Fixed by pinning demo users to stable fixed IDs (user_demo_head, user_demo_floor, user_demo_purchasing) so old sessions still point to valid users after a reset.

### Self-migrate route
Couldn't access the production DATABASE_URL from Vercel's dashboard (it was stored as a secret). Built `/api/admin/migrate` — an idempotent endpoint that runs `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` SQL using the app's own live database connection. The deployed app migrates its own database. Protected by CRON_SECRET.

### Perishability as procurement reasoning
Rather than tracking physical expiry lots (which caused complexity and was meaningless in a daily-reset demo), perishability is a category-based heuristic passed to the AI as context. Dairy/fruit/eggs = "perishable (short shelf life)"; flour/sugar/salt = "stable (long shelf life)." The AI factors this into its reasoning and says things like "order conservatively — perishable item."

### isClosed column (kept, never used)
The `isClosed` boolean column was added to `ProductionSchedule` as part of an earlier approach to archiving. It was superseded by the snapshot pattern but kept in the schema to avoid a destructive migration. It's always false on live rows and harmless.

---

## Database Schema (key models)

- **Bakery** — multi-tenant root, ovenCount, timezone, currency, openingTime/closingTime
- **User** — role (HEAD_BAKER/FLOOR_STAFF/PURCHASING_MANAGER), bakeryId
- **Ingredient** — stockGrams, reorderThresholdGrams, criticalThresholdGrams, alertLevel, costPerKg, supplierId
- **IngredientLot** — lotCode, quantityGrams, expiryDate (FEFO ordering via @@index([ingredientId, expiryDate]))
- **Recipe** — yieldQuantity, wastageBufferPercent, shelfLifeHours, stages, ingredients
- **RecipeIngredient** — quantityGrams (always in grams), displayUnit
- **Order** — channel (POS/ECOMMERCE/WHOLESALE/MANUAL), status, fulfilmentDate, lineItems
- **ProductionSchedule** — scheduleDate (@db.Date), shiftType, isApproved, @@unique([bakeryId, scheduleDate, shiftType])
- **ProductionBatch** — status (SCHEDULED/IN_PROGRESS/COMPLETED), quantity, scaleFactor, ovenSlots
- **ChecklistItem** — order, status (PENDING/IN_PROGRESS/DONE/SKIPPED), completedById, deductions
- **ChecklistDeduction** — ingredientId, deductionGrams (links step to stock deduction)
- **ProductionRunHistory** — denormalized snapshot (recipeName as text, approvedByName as text, no FK to schedule/recipe), stacks (no unique constraint)
- **ProductionRunHistoryBatch** — recipeName, recipeCategory, quantity, scaleFactor (snapshot)
- **AgentAlert** — type (SHORTFALL/EXPIRY/DELAY/PROCUREMENT), severity (INFO/WARNING/CRITICAL), isDismissed, isRead
- **AgentAction** — type, status (PENDING/RUNNING/COMPLETED/FAILED), summary, details (JSON), triggeredAt, completedAt
- **ProcurementRecommendation** — urgency (LOW/MEDIUM/HIGH/CRITICAL), approvedAt, dismissedAt
- **WastageLog** — quantityGrams, reason, shiftDate, loggedById
- **TaskQueue** — MONITOR_BAKERY tasks for background scheduling

---

## API Conventions

All routes follow a consistent response envelope:
```
{ success: true, data: T }           // success
{ success: false, error: string }    // error
{ success: false, error: "Validation error", issues: ZodIssue[] }  // 422
```

HTTP codes: 200 GET, 201 POST created, 204 DELETE, 401 unauth, 403 wrong role, 404 not found, 409 conflict, 422 validation, 500 server error.

Role guards: `requireAuth(roles?)` from `lib/api-helpers.ts`.
Every write verifies `bakeryId` matches `session.user.bakeryId` (multi-tenancy).

---

## Known Limitations (honest)

1. **FEFO is monitoring only** — the agent flags expiring lots, but stock deductions don't consume from individual lots in first-expiry-first-out order. Lot-level deduction is a future build.
2. **Single shift (MORNING hardcoded)** — the schedule page only generates/shows the MORNING shift. Multi-shift is a future build.
3. **Wastage is estimate-based** — nobody measures spilled flour. Bakers estimate based on experience. The value is in trend patterns over time, not precision per entry.
4. **Procurement recommends, doesn't auto-order** — the AI prepares the recommendation, a human clicks approve. One-click, but not fully autonomous. By design (human in the loop for money decisions).
5. **isClosed column** — exists in schema, always false on live rows. Kept to avoid destructive migration. Harmless.

---

## Competition Result

- **Event:** [competition name]
- **Result:** 2nd place overall
- **Category lost to:** Agentic AI for expired medicine management (won on social impact topic, not technical quality)
- **Missed:** Amazon/Kiro partnership award — mentioned Kiro in the submission but didn't provide screenshots/proof of Kiro being used in the development process
- **Lesson for next year:** Pick a problem with obvious social impact. Document the Kiro build process with screenshots. Add a dedicated "Built with Kiro" slide with visual proof for the partnership award.

---

## What to Build Next (Future Development)

1. Omnichannel order ingestion — Shopify/Square webhooks
2. ML demand forecasting
3. Oven capacity visualiser (Gantt timeline — data model already exists)
4. Full recipe CRUD (ingredient/stage editing)
5. Real supplier ordering + delivery tracking
6. Persistent push subscriptions
7. Lot-level FEFO consumption (deductions from actual lots in expiry order)
8. Multi-shift scheduling
9. Production run completion lifecycle improvements

---

## Files & Structure

```
BakeSync/
├── app/
│   ├── (auth)/              # Login, signup
│   ├── (dashboard)/         # All authenticated pages
│   │   └── dashboard/
│   │       ├── alerts/      # Agent command center
│   │       ├── analytics/   # KPI + wastage charts
│   │       ├── floor-staff/ # Kitchen staff shift view
│   │       ├── head-baker/  # Head baker dashboard
│   │       ├── inventory/   # Stock levels
│   │       ├── orders/      # Orders table
│   │       ├── purchasing/  # Procurement recommendations
│   │       ├── recipes/     # Recipe library + detail
│   │       ├── schedule/    # Production schedule + history
│   │       ├── suppliers/   # Supplier directory
│   │       └── wastage/     # Wastage logging form
│   └── api/                 # All API routes
├── components/
│   ├── agent/               # AgentActivityFeed, CommandCenter, AIProcurement
│   ├── auth/                # LoginForm, SignUpForm
│   ├── floor/               # FloorShiftChecklist, ScheduleWatcher
│   ├── layout/              # AppShell, Sidebar, TopBar, nav-config
│   ├── purchasing/          # ProcurementApproveButton
│   ├── schedule/            # AgentLogPanel, ApproveButton, CloseButton
│   └── ui/                  # Shared primitives
├── lib/
│   ├── agent/               # context-builder, planner, schedule-writer, types
│   ├── auth.ts              # NextAuth config
│   ├── db.ts                # Prisma singleton
│   ├── api-helpers.ts       # ok/error/requireAuth helpers
│   ├── stock-actions.ts     # handleStockChange, computeAlertLevel
│   └── utils.ts             # cn, formatGrams, formatCurrency, formatDate
├── prisma/
│   ├── schema.prisma        # Full DB schema
│   └── seed.ts              # Demo data seed
└── types/                   # Shared TypeScript interfaces
```

---

## Developer Notes

- Built solo (with Kiro as AI coding assistant)
- Every architectural decision was made by the developer — Kiro provided implementation
- Key decisions: snapshot pattern for history, stable demo user IDs, deterministic stock guardrail, self-migrate route, perishability heuristic
- The hardest bugs: stale-session FK violations after demo reset, AI ordering guard blocking low/critical items, schedule resurrection bug, stacking history unique-constraint collision
- Competition lesson: topic matters as much as tech for judges. Next year: pick social impact problem, document Kiro usage with screenshots, add dedicated partnership slide.
