import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RecipeDetailActions } from "@/components/recipes/recipe-detail-actions";
import { formatGrams, formatDuration, getAlertColor, cn } from "@/lib/utils";
import {
  ArrowLeft, Flame, Clock, Package,
  ChevronRight, AlertTriangle, CheckCircle,
} from "lucide-react";

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: { id: string } }
): Promise<Metadata> {
  const session = await auth();
  const recipe  = await db.recipe.findFirst({
    where: { id: params.id, bakeryId: session!.user.bakeryId },
    select: { name: true },
  });
  return { title: recipe?.name ?? "Recipe" };
}

// ─── Stage type labels & colours ──────────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  MIX:          "Mix",
  AUTOLYSE:     "Autolyse",
  BULK_FERMENT: "Bulk Ferment",
  SHAPE:        "Shape",
  PROOF:        "Proof",
  RETARD:       "Retard",
  BAKE:         "Bake",
  COOL:         "Cool",
  FINISH:       "Finish",
  PACK:         "Pack",
};

const STAGE_COLORS: Record<string, string> = {
  MIX:          "bg-blue-50 text-blue-700 border-blue-200",
  AUTOLYSE:     "bg-cyan-50 text-cyan-700 border-cyan-200",
  BULK_FERMENT: "bg-purple-50 text-purple-700 border-purple-200",
  SHAPE:        "bg-indigo-50 text-indigo-700 border-indigo-200",
  PROOF:        "bg-violet-50 text-violet-700 border-violet-200",
  RETARD:       "bg-sky-50 text-sky-700 border-sky-200",
  BAKE:         "bg-amber-50 text-amber-700 border-amber-200",
  COOL:         "bg-teal-50 text-teal-700 border-teal-200",
  FINISH:       "bg-pink-50 text-pink-700 border-pink-200",
  PACK:         "bg-gray-50 text-gray-700 border-gray-200",
};

const CATEGORY_COLORS: Record<string, string> = {
  BREAD:        "bg-amber-100 text-amber-800",
  PASTRY:       "bg-pink-100 text-pink-800",
  CAKE:         "bg-purple-100 text-purple-800",
  BISCUIT:      "bg-orange-100 text-orange-800",
  VIENNOISERIE: "bg-yellow-100 text-yellow-800",
  SAVOURY:      "bg-green-100 text-green-800",
  OTHER:        "bg-gray-100 text-gray-700",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function RecipeDetailPage(
  { params }: { params: { id: string } }
) {
  const session  = await auth();
  const bakeryId = session!.user.bakeryId;
  const isHeadBaker = session!.user.role === "HEAD_BAKER";

  const recipe = await db.recipe.findFirst({
    where: { id: params.id, bakeryId, isActive: true },
    include: {
      ingredients: {
        include: {
          ingredient: {
            select: {
              id:                     true,
              name:                   true,
              unit:                   true,
              category:               true,
              stockGrams:             true,
              alertLevel:             true,
              reorderThresholdGrams:  true,
              criticalThresholdGrams: true,
            },
          },
        },
        orderBy: [{ isOptional: "asc" }],
      },
      stages: { orderBy: { order: "asc" } },
    },
  });

  if (!recipe) notFound();

  // Derived stats
  const totalMins  = recipe.stages.reduce((s, st) => s + st.durationMinutes, 0);
  const activeMins = recipe.stages
    .filter((s) => !["RETARD", "BULK_FERMENT", "PROOF", "COOL"].includes(s.type))
    .reduce((s, st) => s + st.durationMinutes, 0);
  const ovenMins   = recipe.stages
    .filter((s) => s.requiresOven)
    .reduce((s, st) => s + st.durationMinutes, 0);
  const hasShortfalls = recipe.ingredients.some(
    (i) => i.ingredient.alertLevel === "CRITICAL" || i.ingredient.alertLevel === "OUT_OF_STOCK"
  );

  // Total ingredient weight for baker's percentage display
  const flourGrams = recipe.ingredients
    .filter((i) => i.ingredient.category === "FLOUR" || i.ingredient.category === "GRAIN")
    .reduce((s, i) => s + Number(i.quantityGrams), 0);

  return (
    <div className="space-y-6 max-w-4xl">

      {/* ── Back link + header ────────────────────────────────────────────── */}
      <div>
        <Link
          href="/dashboard/recipes"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          Back to Recipe Library
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground">{recipe.name}</h1>
              <span className={cn(
                "text-xs font-semibold px-2.5 py-1 rounded-full",
                CATEGORY_COLORS[recipe.category] ?? "bg-gray-100 text-gray-700"
              )}>
                {recipe.category}
              </span>
            </div>
            {recipe.description && (
              <p className="mt-1.5 text-sm text-muted-foreground max-w-xl">
                {recipe.description}
              </p>
            )}
          </div>

          {isHeadBaker && (
            <RecipeDetailActions
              recipe={{
                id:                   recipe.id,
                name:                 recipe.name,
                category:             recipe.category,
                description:          recipe.description,
                yieldQuantity:        recipe.yieldQuantity,
                yieldUnit:            recipe.yieldUnit,
                wastageBufferPercent: Number(recipe.wastageBufferPercent),
                shelfLifeHours:       recipe.shelfLifeHours,
                ingredients:          recipe.ingredients.map((i) => ({
                  ingredientId:  i.ingredientId,
                  quantityGrams: Number(i.quantityGrams),
                  displayUnit:   i.displayUnit,
                  isOptional:    i.isOptional,
                  notes:         i.notes,
                })),
                stages: recipe.stages.map((s) => ({
                  order:           s.order,
                  type:            s.type,
                  name:            s.name,
                  durationMinutes: s.durationMinutes,
                  requiresOven:    s.requiresOven,
                  ovenTempCelsius: s.ovenTempCelsius,
                  notes:           s.notes,
                })),
              }}
            />
          )}
        </div>
      </div>

      {/* ── Stock alert banner ────────────────────────────────────────────── */}
      {hasShortfalls && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm" role="alert">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-semibold">Stock alert</p>
            <p className="text-xs mt-0.5 text-red-600">
              One or more ingredients in this recipe are critically low or out of stock.
              The agent will flag a procurement recommendation before the next scheduled run.
            </p>
          </div>
        </div>
      )}

      {/* ── Key stats row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label:  "Yield",
            value:  `${recipe.yieldQuantity} ${recipe.yieldUnit}`,
            sub:    "per base batch",
            icon:   <Package className="w-4 h-4" />,
            color:  "bg-amber-50 text-amber-700",
          },
          {
            label:  "Total time",
            value:  formatDuration(totalMins),
            sub:    `${formatDuration(activeMins)} active`,
            icon:   <Clock className="w-4 h-4" />,
            color:  "bg-blue-50 text-blue-700",
          },
          {
            label:  "Oven time",
            value:  ovenMins > 0 ? formatDuration(ovenMins) : "None",
            sub:    ovenMins > 0 ? "requires oven" : "no oven needed",
            icon:   <Flame className="w-4 h-4" />,
            color:  ovenMins > 0 ? "bg-orange-50 text-orange-700" : "bg-muted text-muted-foreground",
          },
          {
            label:  "Shelf life",
            value:  `${recipe.shelfLifeHours}h`,
            sub:    `${Number(recipe.wastageBufferPercent)}% wastage buffer`,
            icon:   <CheckCircle className="w-4 h-4" />,
            color:  "bg-green-50 text-green-700",
          },
        ].map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", stat.color)}>
              {stat.icon}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-sm font-bold text-foreground leading-tight">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground">{stat.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Ingredients ───────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                Ingredients
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  per {recipe.yieldQuantity} {recipe.yieldUnit}
                </span>
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                {recipe.ingredients.length} items
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border" role="list">
              {recipe.ingredients.map((ing) => {
                const stock      = Number(ing.ingredient.stockGrams);
                const needed     = Number(ing.quantityGrams);
                const alert      = ing.ingredient.alertLevel;
                const sufficient = stock >= needed;

                return (
                  <li key={ing.ingredientId} className="px-5 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      {/* Name + status */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium truncate">
                            {ing.ingredient.name}
                          </p>
                          {ing.isOptional && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              optional
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <p className="text-xs text-muted-foreground">
                            {ing.ingredient.category.toLowerCase()}
                          </p>
                          {/* Stock vs needed indicator */}
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded border",
                            sufficient
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          )}>
                            {sufficient ? "In stock" : "Shortfall"}
                          </span>
                          {alert !== "OK" && (
                            <span className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded border",
                              getAlertColor(alert)
                            )}>
                              {alert.replace("_", " ")}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quantity */}
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-foreground">
                          {formatGrams(needed)}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatGrams(stock)} in stock
                        </p>
                      </div>
                    </div>

                    {/* Baker's percentage — only shown when there's flour */}
                    {flourGrams > 0 && !ing.isOptional && (
                      <div className="mt-2">
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                          <span>Baker's %</span>
                          <span>{((needed / flourGrams) * 100).toFixed(1)}%</span>
                        </div>
                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary/40 rounded-full"
                            style={{ width: `${Math.min(100, (needed / flourGrams) * 100)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {ing.notes && (
                      <p className="mt-1.5 text-xs text-muted-foreground italic">
                        {ing.notes}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        {/* ── Baking stages ─────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Baking Stages</CardTitle>
              <span className="text-xs text-muted-foreground">
                {recipe.stages.length} stages · {formatDuration(totalMins)} total
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ol className="relative" aria-label="Baking stages timeline">
              {recipe.stages.map((stage, idx) => {
                const isLast = idx === recipe.stages.length - 1;
                return (
                  <li key={stage.id} className="flex gap-0">
                    {/* Timeline spine */}
                    <div className="flex flex-col items-center pl-5 pt-3.5 pb-0 w-10 shrink-0">
                      <div className={cn(
                        "w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold shrink-0 z-10",
                        stage.requiresOven
                          ? "border-amber-400 bg-amber-50 text-amber-700"
                          : "border-primary/30 bg-primary/5 text-primary"
                      )}>
                        {idx + 1}
                      </div>
                      {!isLast && (
                        <div className="w-px flex-1 bg-border mt-1 mb-0 min-h-[24px]" aria-hidden="true" />
                      )}
                    </div>

                    {/* Stage content */}
                    <div className={cn("flex-1 px-4 py-3.5", !isLast && "pb-2")}>
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground">{stage.name}</p>
                          <span className={cn(
                            "text-[10px] font-medium px-1.5 py-0.5 rounded border",
                            STAGE_COLORS[stage.type] ?? "bg-gray-50 text-gray-700 border-gray-200"
                          )}>
                            {STAGE_LABELS[stage.type] ?? stage.type}
                          </span>
                          {stage.requiresOven && (
                            <span className="flex items-center gap-0.5 text-[10px] text-amber-600">
                              <Flame className="w-3 h-3" aria-hidden="true" />
                              {stage.ovenTempCelsius ? `${stage.ovenTempCelsius}°C` : "Oven"}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground font-medium shrink-0">
                          {formatDuration(stage.durationMinutes)}
                        </span>
                      </div>
                      {stage.notes && (
                        <p className="mt-1 text-xs text-muted-foreground">{stage.notes}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>

            {/* Timeline total */}
            <div className="px-5 py-3 border-t border-border flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Wall-clock time (including proofing / retard)
              </span>
              <span className="font-semibold">{formatDuration(totalMins)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Scaling calculator ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Batch Scaling Reference</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-5 py-2.5 text-left font-medium text-muted-foreground">Scale</th>
                  <th className="px-5 py-2.5 text-left font-medium text-muted-foreground">Yield</th>
                  {recipe.ingredients.slice(0, 4).map((ing) => (
                    <th key={ing.ingredientId} className="px-5 py-2.5 text-right font-medium text-muted-foreground whitespace-nowrap">
                      {ing.ingredient.name}
                    </th>
                  ))}
                  {recipe.ingredients.length > 4 && (
                    <th className="px-5 py-2.5 text-right font-medium text-muted-foreground">
                      +{recipe.ingredients.length - 4} more
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[0.5, 1, 2, 3, 5].map((scale) => (
                  <tr key={scale} className={cn(
                    "hover:bg-muted/30 transition-colors",
                    scale === 1 && "bg-amber-50/50 font-medium"
                  )}>
                    <td className="px-5 py-2.5">
                      {scale === 1 ? (
                        <span className="inline-flex items-center gap-1">
                          ×{scale}
                          <span className="text-[10px] text-amber-600 font-normal">(base)</span>
                        </span>
                      ) : `×${scale}`}
                    </td>
                    <td className="px-5 py-2.5 text-muted-foreground">
                      {Math.round(recipe.yieldQuantity * scale)} {recipe.yieldUnit}
                    </td>
                    {recipe.ingredients.slice(0, 4).map((ing) => (
                      <td key={ing.ingredientId} className="px-5 py-2.5 text-right tabular-nums">
                        {formatGrams(Number(ing.quantityGrams) * scale)}
                      </td>
                    ))}
                    {recipe.ingredients.length > 4 && (
                      <td className="px-5 py-2.5 text-right text-muted-foreground">—</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Recent production ────────────────────────────────────────────── */}
      <RecentBatches recipeId={recipe.id} bakeryId={bakeryId} />
    </div>
  );
}

// ─── Recent batches sub-component (server) ────────────────────────────────────

async function RecentBatches({ recipeId, bakeryId }: { recipeId: string; bakeryId: string }) {
  const batches = await db.productionBatch.findMany({
    where: {
      recipeId,
      schedule: { bakeryId },
    },
    include: {
      schedule: { select: { scheduleDate: true, shiftType: true } },
    },
    orderBy: { plannedStartTime: "desc" },
    take: 6,
  });

  if (batches.length === 0) return null;

  const statusColor: Record<string, string> = {
    COMPLETED:   "bg-green-100 text-green-800",
    IN_PROGRESS: "bg-blue-100 text-blue-800",
    SCHEDULED:   "bg-amber-100 text-amber-800",
    CANCELLED:   "bg-gray-100 text-gray-700",
    BLOCKED:     "bg-red-100 text-red-800",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Production Runs</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border" role="list">
          {batches.map((batch) => (
            <li key={batch.id} className="flex items-center justify-between px-5 py-3 gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {batch.schedule.shiftType.charAt(0) + batch.schedule.shiftType.slice(1).toLowerCase()} shift
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" })
                    .format(batch.schedule.scheduleDate)}
                  {" · "}
                  {batch.quantity} units
                  {" · "}
                  ×{Number(batch.scaleFactor)} scale
                </p>
              </div>
              <span className={cn(
                "text-xs font-medium px-2 py-1 rounded-full shrink-0",
                statusColor[batch.status] ?? "bg-muted text-muted-foreground"
              )}>
                {batch.status.replace("_", " ")}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
