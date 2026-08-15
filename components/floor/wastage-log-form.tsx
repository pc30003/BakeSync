"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface Ingredient {
  id: string;
  name: string;
  unit: string;
}

interface WastageLogFormProps {
  ingredients: Ingredient[];
}

const REASONS = [
  "Overproduction",
  "Spoilage",
  "Spillage",
  "Trimming / off-cuts",
  "Failed batch",
  "Expiry",
  "Other",
];

export function WastageLogForm({ ingredients }: WastageLogFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const [form, setForm] = useState({
    ingredientId:  "",
    quantityGrams: "",
    reason:        "",
    shiftDate:     new Date().toISOString().slice(0, 16),
  });

  function handleChange(
    e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setSuccess(false);
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.quantityGrams || !form.reason || !form.shiftDate) return;

    startTransition(async () => {
      const res = await fetch("/api/inventory/wastage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredientId:  form.ingredientId || null,
          quantityGrams: parseFloat(form.quantityGrams),
          reason:        form.reason,
          shiftDate:     new Date(form.shiftDate).toISOString(),
        }),
      });

      if (res.ok) {
        setSuccess(true);
        setForm({
          ingredientId:  "",
          quantityGrams: "",
          reason:        "",
          shiftDate:     new Date().toISOString().slice(0, 16),
        });
        router.refresh();
      } else {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Failed to log wastage. Please try again.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {success && (
        <div role="status" className="px-3 py-2.5 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg">
          Wastage logged successfully.
        </div>
      )}
      {error && (
        <div role="alert" className="px-3 py-2.5 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* Ingredient */}
      <div className="space-y-1.5">
        <label htmlFor="ingredientId" className="text-sm font-medium">
          Ingredient <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <select
          id="ingredientId"
          name="ingredientId"
          value={form.ingredientId}
          onChange={handleChange}
          className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">— Select ingredient —</option>
          {ingredients.map((ing) => (
            <option key={ing.id} value={ing.id}>{ing.name}</option>
          ))}
        </select>
      </div>

      {/* Quantity */}
      <div className="space-y-1.5">
        <label htmlFor="quantityGrams" className="text-sm font-medium">
          Quantity (grams) <span className="text-destructive">*</span>
        </label>
        <input
          id="quantityGrams"
          name="quantityGrams"
          type="number"
          min="0"
          step="1"
          required
          value={form.quantityGrams}
          onChange={handleChange}
          placeholder="e.g. 250"
          className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Reason */}
      <div className="space-y-1.5">
        <label htmlFor="reason" className="text-sm font-medium">
          Reason <span className="text-destructive">*</span>
        </label>
        <select
          id="reason"
          name="reason"
          required
          value={form.reason}
          onChange={handleChange}
          className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">— Select reason —</option>
          {REASONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* Shift date */}
      <div className="space-y-1.5">
        <label htmlFor="shiftDate" className="text-sm font-medium">
          Shift date &amp; time <span className="text-destructive">*</span>
        </label>
        <input
          id="shiftDate"
          name="shiftDate"
          type="datetime-local"
          required
          value={form.shiftDate}
          onChange={handleChange}
          className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <Button type="submit" loading={isPending} className="w-full">
        Log Wastage
      </Button>
    </form>
  );
}
