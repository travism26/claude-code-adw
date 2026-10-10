"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchTemplates,
  fetchTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  cloneTemplate,
  fetchGrowFeedingSchedule,
  applyTemplateToGrow,
  replaceGrowFeedingSchedule,
  updateGrowScheduleSettings,
} from "../api/feedingScheduleApi";
import type {
  TemplatesResponse,
  TemplateResponse,
  TemplateInput,
  GrowFeedingScheduleResponse,
  WeekInput,
  ScheduleSettingsInput,
} from "../types/feedingSchedule";

export const feedingKeys = {
  templates: ["feedingTemplates"] as const,
  template: (id: string) => ["feedingTemplates", id] as const,
  growSchedule: (growId: string) => ["growFeedingSchedule", growId] as const,
};

// ---- Templates ----
export const useFeedingTemplates = () =>
  useQuery<TemplatesResponse, Error>({
    queryKey: feedingKeys.templates,
    queryFn: fetchTemplates,
    staleTime: 5 * 60 * 1000,
  });

export const useFeedingTemplate = (id: string | null) =>
  useQuery<TemplateResponse, Error>({
    queryKey: feedingKeys.template(id!),
    queryFn: () => fetchTemplate(id!),
    enabled: !!id,
  });

export const useCreateFeedingTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TemplateInput) => createTemplate(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: feedingKeys.templates }),
  });
};

export const useUpdateFeedingTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TemplateInput }) =>
      updateTemplate(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: feedingKeys.templates }),
  });
};

export const useDeleteFeedingTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: feedingKeys.templates }),
  });
};

export const useCloneFeedingTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cloneTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: feedingKeys.templates }),
  });
};

// ---- Per-grow schedule ----
export const useGrowFeedingSchedule = (growId: string | null) =>
  useQuery<GrowFeedingScheduleResponse, Error>({
    queryKey: feedingKeys.growSchedule(growId!),
    queryFn: () => fetchGrowFeedingSchedule(growId!),
    enabled: !!growId,
  });

export const useApplyTemplateToGrow = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      growId,
      templateId,
      overwrite,
    }: {
      growId: string;
      templateId: string;
      overwrite?: boolean;
    }) => applyTemplateToGrow(growId, templateId, overwrite),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: feedingKeys.growSchedule(v.growId) });
      qc.invalidateQueries({ queryKey: ["feedEvents", v.growId] });
    },
  });
};

export const useReplaceGrowFeedingSchedule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ growId, weeks }: { growId: string; weeks: WeekInput[] }) =>
      replaceGrowFeedingSchedule(growId, weeks),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: feedingKeys.growSchedule(v.growId) });
      qc.invalidateQueries({ queryKey: ["feedEvents", v.growId] });
    },
  });
};

export const useUpdateGrowScheduleSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      growId,
      settings,
    }: {
      growId: string;
      settings: ScheduleSettingsInput;
    }) => updateGrowScheduleSettings(growId, settings),
    onSuccess: (_, v) =>
      qc.invalidateQueries({ queryKey: feedingKeys.growSchedule(v.growId) }),
  });
};
