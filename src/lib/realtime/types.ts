export type RealtimeResource =
  | { kind: "scan"; scanId: string; organizationId: string; businessId: string }
  | { kind: "job"; jobId: string; organizationId: string; businessId?: string }
  | { kind: "report"; reportId: string; organizationId: string };

export type RealtimeEvent = {
  type: string;
  resource: RealtimeResource;
  payload?: Record<string, unknown>;
  at: string;
};

export type RealtimeTransportName = "supabase" | "sse" | "polling";
