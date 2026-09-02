"use client";

import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, Cell as BarCell,
} from "recharts";

interface StockSlice { name: string; value: number; color: string; }
interface WasteBar   { name: string; grams: number; }

/**
 * Stock health donut — a visual breakdown of ingredient alert levels.
 * Colours match the app's alert semantics (green/amber/orange/red).
 */
export function StockHealthDonut({ data }: { data: StockSlice[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
        No tracked ingredients yet.
      </div>
    );
  }

  return (
    <div className="relative h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data.filter((d) => d.value > 0)}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={58}
            outerRadius={85}
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.filter((d) => d.value > 0).map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [`${value} item${value !== 1 ? "s" : ""}`, name]}
            contentStyle={{
              borderRadius: "0.625rem",
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--card))",
              color: "hsl(var(--foreground))",
              fontSize: "12px",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* Centre total */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-2xl font-bold text-foreground">{total}</span>
        <span className="text-[11px] text-muted-foreground">ingredients</span>
      </div>
    </div>
  );
}

/**
 * Top wasted ingredients — horizontal bar chart (grams over the last 30 days).
 */
export function TopWasteBars({ data }: { data: WasteBar[] }) {
  if (data.length === 0) {
    return (
      <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
        No wastage recorded in the last 30 days.
      </div>
    );
  }

  const maxLen = Math.max(...data.map((d) => d.name.length));

  return (
    <div className="h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={Math.min(140, Math.max(80, maxLen * 6.5))}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
            formatter={(value: number) => [
              value >= 1000 ? `${(value / 1000).toFixed(2)} kg` : `${value} g`,
              "Wasted",
            ]}
            contentStyle={{
              borderRadius: "0.625rem",
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--card))",
              color: "hsl(var(--foreground))",
              fontSize: "12px",
            }}
          />
          <Bar dataKey="grams" radius={[0, 6, 6, 0]} maxBarSize={22}>
            {data.map((_, i) => (
              <BarCell key={i} fill="#D97706" fillOpacity={1 - i * 0.14} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
