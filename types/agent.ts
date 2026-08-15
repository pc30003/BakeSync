export type AgentActionType =
  | "GENERATE_SCHEDULE"
  | "FLAG_SHORTFALL"
  | "PROCUREMENT_RECOMMENDATION"
  | "DEMAND_FORECAST"
  | "WASTE_ALERT"
  | "EXPIRY_ALERT"
  | "SCHEDULE_OVERRIDE";

export type AgentActionStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "DISMISSED";

export interface AgentAction {
  id: string;
  bakeryId: string;
  type: AgentActionType;
  status: AgentActionStatus;
  summary: string;
  details: Record<string, unknown>;  // structured payload varies by type
  requiresApproval: boolean;
  approvedBy: string | null;
  approvedAt: Date | null;
  dismissedBy: string | null;
  dismissedAt: Date | null;
  triggeredAt: Date;
  completedAt: Date | null;
  errorMessage: string | null;
}

export interface AgentAlert {
  id: string;
  bakeryId: string;
  type: "SHORTFALL" | "EXPIRY" | "OVERPRODUCTION" | "DELAY" | "PROCUREMENT";
  severity: "INFO" | "WARNING" | "CRITICAL";
  title: string;
  message: string;
  relatedEntityId: string | null;
  relatedEntityType: string | null;
  isRead: boolean;
  isDismissed: boolean;
  createdAt: Date;
}

export interface AgentContext {
  bakeryId: string;
  currentDate: Date;
  pendingOrders: number;
  criticalStockItems: number;
  expiringWithin24h: number;
  pendingProcurements: number;
  scheduledBatches: number;
  lastRunAt: Date | null;
}
