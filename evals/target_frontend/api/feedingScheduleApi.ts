// Feeding-schedule API client
import { ApiClient } from "../utils/api";
import type {
  TemplatesResponse,
  TemplateResponse,
  TemplateInput,
  GrowFeedingScheduleResponse,
  WeekInput,
  ScheduleSettingsInput,
} from "../types/feedingSchedule";

const apiClient = ApiClient.getInstance();

// ---- Templates ----
export const fetchTemplates = (): Promise<TemplatesResponse> =>
  apiClient.request<TemplatesResponse>("/feeding-schedule-templates");

export const fetchTemplate = (id: string): Promise<TemplateResponse> =>
  apiClient.request<TemplateResponse>(`/feeding-schedule-templates/${id}`);

export const createTemplate = (data: TemplateInput): Promise<TemplateResponse> =>
  apiClient.request<TemplateResponse>("/feeding-schedule-templates", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateTemplate = (
  id: string,
  data: TemplateInput
): Promise<TemplateResponse> =>
  apiClient.request<TemplateResponse>(`/feeding-schedule-templates/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const deleteTemplate = (id: string): Promise<void> =>
  apiClient.request(`/feeding-schedule-templates/${id}`, { method: "DELETE" });

export const cloneTemplate = (id: string): Promise<TemplateResponse> =>
  apiClient.request<TemplateResponse>(`/feeding-schedule-templates/${id}/clone`, {
    method: "POST",
  });

// ---- Per-grow schedule ----
export const fetchGrowFeedingSchedule = (
  growId: string
): Promise<GrowFeedingScheduleResponse> =>
  apiClient.request<GrowFeedingScheduleResponse>(
    `/grows/${growId}/feeding-schedule`
  );

export const applyTemplateToGrow = (
  growId: string,
  templateId: string,
  overwrite = false
): Promise<GrowFeedingScheduleResponse> =>
  apiClient.request<GrowFeedingScheduleResponse>(
    `/grows/${growId}/feeding-schedule/apply`,
    {
      method: "POST",
      body: JSON.stringify({ template_id: templateId, overwrite }),
    }
  );

export const replaceGrowFeedingSchedule = (
  growId: string,
  weeks: WeekInput[]
): Promise<GrowFeedingScheduleResponse> =>
  apiClient.request<GrowFeedingScheduleResponse>(
    `/grows/${growId}/feeding-schedule`,
    {
      method: "PUT",
      body: JSON.stringify({ weeks }),
    }
  );

export const updateGrowScheduleSettings = (
  growId: string,
  settings: ScheduleSettingsInput
): Promise<GrowFeedingScheduleResponse> =>
  apiClient.request<GrowFeedingScheduleResponse>(
    `/grows/${growId}/feeding-schedule/settings`,
    {
      method: "PUT",
      body: JSON.stringify(settings),
    }
  );
