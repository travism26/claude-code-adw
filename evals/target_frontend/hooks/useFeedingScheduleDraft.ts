"use client";

/**
 * Owns the feeding-schedule settings "draft" state for the panel — strength,
 * reservoir, week-counting mode, flower-start, display unit, ppm scale. Each
 * value is a local override that falls back to the server value, plus a
 * commitSettings() that persists the current live values. Extracted into a hook
 * so the panel stays within the architecture's per-component state budget.
 */

import { useState } from "react";
import { useUpdateGrowScheduleSettings } from "./useFeedingSchedule";
import type {
  GrowFeedingSchedule,
  WeekCountingMode,
  ScheduleSettingsInput,
} from "../types/feedingSchedule";

export function useFeedingScheduleDraft(
  growId: string,
  schedule: GrowFeedingSchedule | null
) {
  const settingsMutation = useUpdateGrowScheduleSettings();
  const [strengthOverride, setStrengthOverride] = useState<number | null>(null);
  const [reservoirOverride, setReservoirOverride] = useState<string | null>(null);
  const [modeOverride, setModeOverride] = useState<WeekCountingMode | null>(null);
  const [flowerStartOverride, setFlowerStartOverride] = useState<string | null>(null);
  const [unitOverride, setUnitOverride] = useState<string | null>(null);
  const [ppmScaleOverride, setPpmScaleOverride] = useState<number | null>(null);

  // Live values: local override (while editing the controls) else server value.
  const strengthPct = strengthOverride ?? schedule?.strength_pct ?? 75;
  const reservoirStr =
    reservoirOverride ??
    (schedule?.reservoir_gallons != null ? String(schedule.reservoir_gallons) : "");
  const reservoir = reservoirStr === "" ? null : Number(reservoirStr);
  const countingMode: WeekCountingMode =
    modeOverride ?? schedule?.week_counting_mode ?? "continuous";
  const flowerStartStr =
    flowerStartOverride ??
    (schedule?.flower_start_week != null ? String(schedule.flower_start_week) : "");
  const flowerStartWeek = flowerStartStr === "" ? null : Number(flowerStartStr);
  const displayUnit = unitOverride ?? schedule?.display_unit ?? "ml/gal";
  const ppmScale = ppmScaleOverride ?? schedule?.ppm_scale ?? 500;

  const commitSettings = (extra?: Partial<ScheduleSettingsInput>) =>
    settingsMutation.mutate({
      growId,
      settings: {
        strength_pct: strengthPct,
        reservoir_gallons: reservoir,
        week_counting_mode: countingMode,
        flower_start_week: flowerStartWeek,
        display_unit: displayUnit,
        ppm_scale: ppmScale,
        ...extra,
      },
    });

  return {
    // live values
    strengthPct,
    reservoirStr,
    reservoir,
    countingMode,
    flowerStartStr,
    flowerStartWeek,
    displayUnit,
    ppmScale,
    // setters
    setStrengthOverride,
    setReservoirOverride,
    setModeOverride,
    setFlowerStartOverride,
    setUnitOverride,
    setPpmScaleOverride,
    // persist
    commitSettings,
  };
}
