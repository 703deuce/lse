export type CampaignScheduleType = "manual" | "weekly" | "biweekly" | "monthly";

export type MapsCampaignRow = {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  default_grid_size: number;
  default_radius_meters: number;
  schedule_type: CampaignScheduleType;
  schedule_day: number | null;
  schedule_timezone: string | null;
  next_scheduled_at: string | null;
  schedule_enabled: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};
