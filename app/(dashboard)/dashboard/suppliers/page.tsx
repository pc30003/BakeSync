import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, Mail, Phone, Clock } from "lucide-react";

export const metadata: Metadata = { title: "Suppliers" };

export const revalidate = 2;

export default async function SuppliersPage() {
  const session   = await auth();
  const suppliers = await db.supplier.findMany({
    where:   { bakeryId: session!.user.bakeryId, isActive: true },
    include: {
      _count: { select: { ingredients: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers"
        description={`${suppliers.length} active suppliers`}
      />

      {suppliers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No suppliers yet. Add suppliers to link them to ingredients.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {suppliers.map((supplier) => (
            <Card key={supplier.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Truck className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm">{supplier.name}</h3>
                    <Badge variant="outline" className="mt-1">
                      {supplier._count.ingredients} ingredient{supplier._count.ingredients !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-muted-foreground">
                  {supplier.contactEmail && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <a
                        href={`mailto:${supplier.contactEmail}`}
                        className="hover:text-foreground transition-colors truncate"
                      >
                        {supplier.contactEmail}
                      </a>
                    </div>
                  )}
                  {supplier.contactPhone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <a href={`tel:${supplier.contactPhone}`} className="hover:text-foreground transition-colors">
                        {supplier.contactPhone}
                      </a>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>Lead time: {supplier.leadTimeDays} day{supplier.leadTimeDays !== 1 ? "s" : ""}</span>
                  </div>
                </div>

                {supplier.notes && (
                  <p className="text-xs text-muted-foreground border-t border-border pt-2 line-clamp-2">
                    {supplier.notes}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
