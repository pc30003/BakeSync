import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { OrderStatus, OrderChannel } from "@/types";

export const metadata: Metadata = { title: "Orders" };

const statusVariant: Record<OrderStatus, string> = {
  PENDING:      "warning",
  CONFIRMED:    "info",
  IN_PRODUCTION:"secondary",
  READY:        "success",
  FULFILLED:    "outline",
  CANCELLED:    "danger",
};

const channelLabel: Record<OrderChannel, string> = {
  ECOMMERCE:     "E-commerce",
  WHOLESALE:     "Wholesale",
  EVENT_BOOKING: "Event",
  SUBSCRIPTION:  "Subscription",
  POS:           "POS",
  MANUAL:        "Manual",
};

export default async function OrdersPage() {
  const session = await auth();
  const orders  = await db.order.findMany({
    where:   { bakeryId: session!.user.bakeryId },
    include: { lineItems: true },
    orderBy: { fulfilmentDate: "asc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description={`${orders.length} orders found`}
      />

      <Card>
        <CardContent className="p-0">
          {orders.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              No orders yet. Orders from connected sales channels will appear here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Customer</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Channel</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fulfilment</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Value</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium">{order.customerName ?? "—"}</p>
                        {order.customerEmail && (
                          <p className="text-xs text-muted-foreground">{order.customerEmail}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {channelLabel[order.channel as OrderChannel]}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(order.fulfilmentDate)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatCurrency(Number(order.totalValue))}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant[order.status as OrderStatus] as any}>
                          {order.status.replace("_", " ")}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
