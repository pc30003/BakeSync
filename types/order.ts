export type OrderChannel =
  | "ECOMMERCE"
  | "WHOLESALE"
  | "EVENT_BOOKING"
  | "SUBSCRIPTION"
  | "POS"
  | "MANUAL";

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "IN_PRODUCTION"
  | "READY"
  | "FULFILLED"
  | "CANCELLED";

export interface OrderLineItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  notes: string | null;
}

export interface Order {
  id: string;
  bakeryId: string;
  externalId: string | null;     // ID from source system (Shopify, Square, etc.)
  channel: OrderChannel;
  status: OrderStatus;
  customerName: string | null;
  customerEmail: string | null;
  fulfilmentDate: Date;          // The date the order must be ready by
  lineItems: OrderLineItem[];
  totalValue: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderSummary {
  totalOrders: number;
  totalValue: number;
  byChannel: Record<OrderChannel, number>;
  byStatus: Record<OrderStatus, number>;
  fulfilmentDate: Date;
}

export type CreateOrderInput = Omit<
  Order,
  "id" | "bakeryId" | "createdAt" | "updatedAt"
>;

export type UpdateOrderInput = Partial<
  Omit<Order, "id" | "bakeryId" | "createdAt" | "updatedAt">
>;
