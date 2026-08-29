"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExportCsvButtonProps {
  filename: string;
  headers: string[];
  rows: (string | number)[][];
  label?: string;
}

/**
 * Exports tabular data to a CSV file, generated entirely client-side.
 * No server round-trip, no dependencies. Safe and self-contained.
 */
export function ExportCsvButton({ filename, headers, rows, label = "Export CSV" }: ExportCsvButtonProps) {
  function handleExport() {
    // Escape CSV values (wrap in quotes, double internal quotes)
    const escape = (val: string | number) => {
      const s = String(val ?? "");
      return `"${s.replace(/"/g, '""')}"`;
    };

    const csv = [
      headers.map(escape).join(","),
      ...rows.map((row) => row.map(escape).join(",")),
    ].join("\n");

    // Prepend BOM so Excel opens UTF-8 correctly
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleExport}
      leftIcon={<Download className="w-3.5 h-3.5" />}
      disabled={rows.length === 0}
    >
      {label}
    </Button>
  );
}
