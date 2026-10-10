"use client";

/**
 * Feeding Schedule Panel — the weekly nutrient "feeding calendar" for a grow.
 * Shows each week (number + mapped date range) with its assigned nutrients and
 * dosages, highlighting the current week. When the grow has no schedule yet,
 * offers to apply a reusable template.
 */

import { useState } from "react";
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Card,
  Button,
  Spinner,
  Flex,
  Input,
} from "@chakra-ui/react";
import NextLink from "next/link";
import { CalendarDays } from "lucide-react";
import {
  useGrowFeedingSchedule,
  useFeedingTemplates,
  useApplyTemplateToGrow,
  useReplaceGrowFeedingSchedule,
} from "../../hooks/useFeedingSchedule";
import { useFeedingScheduleDraft } from "../../hooks/useFeedingScheduleDraft";
import { FeedingScheduleEditor } from "./FeedingScheduleEditor";
import { WeekCard } from "./FeedingWeekCard";
import { fmt, UNIT_OPTIONS } from "./feedingUnits";
import { useFeedEvents } from "../../hooks/useFeedEvents";
import type { WeekInput, WeekCountingMode } from "../../types/feedingSchedule";

interface FeedingSchedulePanelProps {
  growId: string;
}

export function FeedingSchedulePanel({ growId }: FeedingSchedulePanelProps) {
  const { data, isLoading, error } = useGrowFeedingSchedule(growId);
  const { data: templatesData } = useFeedingTemplates();
  const { data: feedEventsData } = useFeedEvents(growId);
  const applyMutation = useApplyTemplateToGrow();
  const replaceMutation = useReplaceGrowFeedingSchedule();
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [templateFilter, setTemplateFilter] = useState("");
  const [editing, setEditing] = useState(false);

  const templates = templatesData?.templates ?? [];
  const filteredTemplates = templateFilter.trim()
    ? templates.filter((t) =>
        t.name.toLowerCase().includes(templateFilter.trim().toLowerCase())
      )
    : templates;
  const schedule = data?.feedingSchedule ?? null;
  const eventsByWeek = new Map(
    (feedEventsData?.feedEvents ?? []).map((e) => [e.week_number, e])
  );

  const {
    strengthPct,
    reservoirStr,
    reservoir,
    countingMode,
    flowerStartStr,
    displayUnit,
    ppmScale,
    setStrengthOverride,
    setReservoirOverride,
    setModeOverride,
    setFlowerStartOverride,
    setUnitOverride,
    setPpmScaleOverride,
    commitSettings,
  } = useFeedingScheduleDraft(growId, schedule);

  const scheduleToWeeks = (): WeekInput[] =>
    (schedule?.weeks ?? []).map((w) => ({
      week_number: w.week_number,
      notes: w.notes ?? undefined,
      nutrients: w.weekNutrients.map((wn) => ({
        nutrient_id: wn.nutrient_id,
        dosage_ml_per_gallon: wn.dosage_ml_per_gallon,
      })),
    }));

  const handleSaveWeeks = (weeks: WeekInput[]) =>
    replaceMutation.mutate({ growId, weeks }, { onSuccess: () => setEditing(false) });

  const handleApply = (overwrite: boolean) => {
    if (!selectedTemplate) return;
    if (overwrite && !window.confirm("Replace the current feeding schedule?")) return;
    applyMutation.mutate({ growId, templateId: selectedTemplate, overwrite });
  };

  if (isLoading) {
    return (
      <Flex justify="center" py={10}>
        <Spinner color="green.500" />
      </Flex>
    );
  }

  if (error) {
    return (
      <Text color="red.600" data-testid="feeding-error">
        Failed to load feeding schedule
      </Text>
    );
  }

  if (editing) {
    return (
      <VStack align="stretch" gap={4} data-testid="feeding-editor-wrap">
        <HStack justify="space-between">
          <Heading size="md">
            {schedule ? "Edit feeding schedule" : "Build feeding schedule"}
          </Heading>
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </HStack>
        <FeedingScheduleEditor
          initialWeeks={schedule ? scheduleToWeeks() : undefined}
          onSave={handleSaveWeeks}
          saving={replaceMutation.isPending}
          saveLabel="Save schedule"
        />
      </VStack>
    );
  }

  // Render function (not a nested component) — a nested component would get a
  // new identity on every parent render, remounting the filter input and
  // dropping focus on each keystroke.
  const renderTemplatePicker = (overwrite: boolean) => (
    <HStack gap={2} flexWrap="wrap">
      <Input
        size="sm"
        w="180px"
        placeholder="Filter templates…"
        data-testid="template-filter-input"
        value={templateFilter}
        onChange={(e) => {
          const next = e.target.value;
          setTemplateFilter(next);
          // Drop the selection if filtering hides it, so the select never
          // shows a value that isn't in its option list.
          if (
            selectedTemplate &&
            next.trim() &&
            !templates.some(
              (t) =>
                t.id === selectedTemplate &&
                t.name.toLowerCase().includes(next.trim().toLowerCase())
            )
          ) {
            setSelectedTemplate("");
          }
        }}
      />
      <select
        data-testid="apply-template-select"
        value={selectedTemplate}
        onChange={(e) => setSelectedTemplate(e.target.value)}
        style={{
          minWidth: 220,
          padding: "8px",
          border: "1px solid #e2e8f0",
          borderRadius: 6,
        }}
      >
        <option value="">
          {templateFilter.trim()
            ? `Select a template… (${filteredTemplates.length} of ${templates.length})`
            : "Select a template…"}
        </option>
        {filteredTemplates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} ({t.weeks.length} wks)
          </option>
        ))}
      </select>
      <Button
        colorPalette="green"
        data-testid="apply-template-btn"
        onClick={() => handleApply(overwrite)}
        loading={applyMutation.isPending}
        disabled={!selectedTemplate}
      >
        {overwrite ? "Replace with template" : "Apply template"}
      </Button>
    </HStack>
  );

  if (!schedule) {
    return (
      <VStack gap={4} py={10} data-testid="feeding-empty" align="center">
        <Box as={CalendarDays} boxSize={10} color="gray.300" />
        <Text color="gray.600">No feeding schedule yet</Text>
        {templates.length > 0 ? (
          <>
            <Text fontSize="sm" color="gray.500">
              Apply a reusable feeding template to lay out this grow week by week.
            </Text>
            {renderTemplatePicker(false)}
          </>
        ) : (
          <Text fontSize="sm" color="gray.500">
            No templates yet — build a schedule for this grow, or manage templates.
          </Text>
        )}
        <HStack gap={3} pt={2}>
          <Button
            variant="outline"
            data-testid="build-schedule-btn"
            onClick={() => setEditing(true)}
          >
            Build from scratch
          </Button>
          <Button asChild variant="ghost" colorPalette="green" data-testid="manage-templates-link">
            <NextLink href="/grows/feeding-templates">Manage templates</NextLink>
          </Button>
        </HStack>
      </VStack>
    );
  }

  return (
    <VStack align="stretch" gap={4} data-testid="feeding-panel">
      <HStack justify="space-between" flexWrap="wrap" gap={3}>
        <Heading size="md">Weekly Feeding Schedule</Heading>
        <HStack gap={2} flexWrap="wrap">
          <Button
            size="sm"
            variant="outline"
            data-testid="edit-schedule-btn"
            onClick={() => setEditing(true)}
          >
            Edit schedule
          </Button>
          {templates.length > 0 && renderTemplatePicker(true)}
        </HStack>
      </HStack>

      <Card.Root data-testid="feeding-settings">
        <Card.Body p={4}>
          <HStack gap={6} flexWrap="wrap">
            <HStack gap={2}>
              <Text fontSize="sm" fontWeight="medium">
                Strength
              </Text>
              <Input
                type="number"
                min={1}
                max={100}
                w="80px"
                size="sm"
                data-testid="strength-input"
                value={String(strengthPct)}
                onChange={(e) =>
                  setStrengthOverride(e.target.value === "" ? null : Number(e.target.value))
                }
                onBlur={() => commitSettings()}
              />
              <Text fontSize="sm" color="gray.500">
                %
              </Text>
            </HStack>
            <HStack gap={2}>
              <Text fontSize="sm" fontWeight="medium">
                Reservoir
              </Text>
              <Input
                type="number"
                min={0}
                step="0.5"
                w="100px"
                size="sm"
                placeholder="gal"
                data-testid="reservoir-input"
                value={reservoirStr}
                onChange={(e) => setReservoirOverride(e.target.value)}
                onBlur={() => commitSettings()}
              />
              <Text fontSize="sm" color="gray.500">
                gal
              </Text>
            </HStack>
            <HStack gap={2}>
              <Text fontSize="sm" fontWeight="medium">
                Weeks
              </Text>
              <select
                data-testid="counting-mode-select"
                value={countingMode}
                onChange={(e) => {
                  const v = e.target.value as WeekCountingMode;
                  setModeOverride(v);
                  commitSettings({ week_counting_mode: v });
                }}
                style={{ padding: "6px", border: "1px solid #e2e8f0", borderRadius: 6 }}
              >
                <option value="continuous">From grow start</option>
                <option value="flip-reset">Reset at flower flip</option>
              </select>
              {countingMode === "flip-reset" && (
                <>
                  <Text fontSize="sm" color="gray.500">
                    flower starts wk
                  </Text>
                  <Input
                    type="number"
                    min={1}
                    w="70px"
                    size="sm"
                    data-testid="flower-start-input"
                    value={flowerStartStr}
                    onChange={(e) => setFlowerStartOverride(e.target.value)}
                    onBlur={() => commitSettings()}
                  />
                </>
              )}
            </HStack>
            <HStack gap={2}>
              <Text fontSize="sm" fontWeight="medium">
                Units
              </Text>
              <select
                data-testid="display-unit-select"
                value={displayUnit}
                onChange={(e) => {
                  const v = e.target.value;
                  setUnitOverride(v);
                  commitSettings({ display_unit: v });
                }}
                style={{ padding: "6px", border: "1px solid #e2e8f0", borderRadius: 6 }}
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <select
                data-testid="ppm-scale-select"
                value={String(ppmScale)}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setPpmScaleOverride(v);
                  commitSettings({ ppm_scale: v });
                }}
                style={{ padding: "6px", border: "1px solid #e2e8f0", borderRadius: 6 }}
              >
                <option value="500">PPM @500</option>
                <option value="700">PPM @700</option>
              </select>
            </HStack>
            {strengthPct < 100 && (
              <Text fontSize="xs" color="green.600">
                Showing doses at {strengthPct}% strength
                {reservoir != null ? ` · mixed for ${fmt(reservoir)} gal` : ""}
              </Text>
            )}
          </HStack>
        </Card.Body>
      </Card.Root>

      <VStack align="stretch" gap={3}>
        {schedule.weeks.map((week) => (
          <WeekCard
            key={week.id}
            week={week}
            strengthPct={strengthPct}
            reservoir={reservoir}
            displayUnit={displayUnit}
            ppmScale={ppmScale}
            growId={growId}
            feedEvent={eventsByWeek.get(week.week_number)}
          />
        ))}
      </VStack>
    </VStack>
  );
}

export default FeedingSchedulePanel;
