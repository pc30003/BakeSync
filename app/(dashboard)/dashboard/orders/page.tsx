import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatCurrency } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ExportCsvButton } from "@/components/ui/export-csv-button";
import type { OrderStatus, OrderChannel } from "@/types";

export const metadata: Metadata = { title: "Orders" };

export const revalidate = 2;

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
  const bakeryId = session!.user.bakeryId;
  const [bakery, orders] = await Promise.all([
    db.bakery.findUnique({ where: { id: bakeryId }, select: { currency: true } }),
    db.order.findMany({
      where:   { bakeryId },
      include: { lineItems: true },
      orderBy: { fulfilmentDate: "asc" },
      take: 50,
    }),
  ]);
  const currency = bakery?.currency ?? "USD";

  // Build CSV export data
  const csvRows = orders.map((o) => [
    o.customerName ?? "",
    o.customerEmail ?? "",
    channelLabel[o.channel as OrderChannel] ?? o.channel,
    o.status,
    formatDate(o.fulfilmentDate),
    Number(o.totalValue),
    o.lineItems.map((li) => `${li.quantity}x ${li.productName}`).join("; "),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description={`${orders.length} orders found`}
        actions={
          <ExportCsvButton
            filename="orders"
            headers={["Customer", "Email", "Channel", "Status", "Fulfilment Date", "Value", "Items"]}
            rows={csvRows}
          />
        }
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
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Received</th>
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
                      <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell whitespace-nowrap">
                        {formatDistanceToNow(order.createdAt, { addSuffix: true })}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(order.fulfilmentDate)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatCurrency(Number(order.totalValue), currency)}
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
