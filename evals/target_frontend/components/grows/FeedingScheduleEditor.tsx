"use client";

/**
 * Shared editor for a list of feeding weeks (used by both template authoring
 * and per-grow free-form editing). Controlled by local state; calls onSave with
 * a normalized WeekInput[]. Each week has notes + a list of nutrient rows
 * (catalog nutrient + dosage in ml/gal).
 */

import { useState } from "react";
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Button,
  IconButton,
  Input,
  Card,
} from "@chakra-ui/react";
import { Plus, Trash2 } from "lucide-react";
import { useNutrients } from "../../hooks/useNutrients";
import type { WeekInput } from "../../types/feedingSchedule";

interface EditorNutrient {
  nutrient_id: string;
  dosage: string; // kept as string for the input; parsed on save
}
interface EditorWeek {
  week_number: number;
  notes: string;
  ec_min: string;
  ec_max: string;
  ppm_min: string;
  ppm_max: string;
  ph_min: string;
  ph_max: string;
  is_flush: boolean;
  is_water_only: boolean;
  nutrients: EditorNutrient[];
}

const numField = (n: number | null | undefined) => (n != null ? String(n) : "");
const parseNum = (s: string) => (s === "" ? null : Number(s));

interface FeedingScheduleEditorProps {
  initialWeeks?: WeekInput[];
  onSave: (weeks: WeekInput[]) => void;
  saving?: boolean;
  saveLabel?: string;
}

const emptyWeek = (week_number: number): EditorWeek => ({
  week_number,
  notes: "",
  ec_min: "",
  ec_max: "",
  ppm_min: "",
  ppm_max: "",
  ph_min: "",
  ph_max: "",
  is_flush: false,
  is_water_only: false,
  nutrients: [],
});

function toEditorWeeks(weeks?: WeekInput[]): EditorWeek[] {
  if (!weeks || weeks.length === 0) {
    return [emptyWeek(1)];
  }
  return weeks.map((w) => ({
    week_number: w.week_number,
    notes: w.notes ?? "",
    ec_min: numField(w.ec_min),
    ec_max: numField(w.ec_max),
    ppm_min: numField(w.ppm_min),
    ppm_max: numField(w.ppm_max),
    ph_min: numField(w.ph_min),
    ph_max: numField(w.ph_max),
    is_flush: w.is_flush ?? false,
    is_water_only: w.is_water_only ?? false,
    nutrients: (w.nutrients ?? []).map((n) => ({
      nutrient_id: n.nutrient_id,
      dosage: n.dosage_ml_per_gallon != null ? String(n.dosage_ml_per_gallon) : "",
    })),
  }));
}

export function FeedingScheduleEditor({
  initialWeeks,
  onSave,
  saving = false,
  saveLabel = "Save",
}: FeedingScheduleEditorProps) {
  const { data: nutrientsData } = useNutrients();
  const catalog = nutrientsData?.nutrients ?? [];
  const [weeks, setWeeks] = useState<EditorWeek[]>(() => toEditorWeeks(initialWeeks));

  const update = (fn: (draft: EditorWeek[]) => void) => {
    setWeeks((prev) => {
      const next = prev.map((w) => ({ ...w, nutrients: w.nutrients.map((n) => ({ ...n })) }));
      fn(next);
      return next;
    });
  };

  const addWeek = () =>
    update((d) => {
      const nextNum = d.length ? Math.max(...d.map((w) => w.week_number)) + 1 : 1;
      d.push(emptyWeek(nextNum));
    });
  const removeWeek = (i: number) => update((d) => d.splice(i, 1));
  const addNutrient = (i: number) =>
    update((d) => d[i].nutrients.push({ nutrient_id: "", dosage: "" }));
  const removeNutrient = (i: number, j: number) =>
    update((d) => d[i].nutrients.splice(j, 1));

  const handleSave = () => {
    const payload: WeekInput[] = weeks.map((w) => ({
      week_number: w.week_number,
      notes: w.notes || undefined,
      ec_min: parseNum(w.ec_min),
      ec_max: parseNum(w.ec_max),
      ppm_min: parseNum(w.ppm_min),
      ppm_max: parseNum(w.ppm_max),
      ph_min: parseNum(w.ph_min),
      ph_max: parseNum(w.ph_max),
      is_flush: w.is_flush,
      is_water_only: w.is_water_only,
      nutrients: w.nutrients
        .filter((n) => n.nutrient_id)
        .map((n) => ({
          nutrient_id: n.nutrient_id,
          dosage_ml_per_gallon: n.dosage === "" ? null : Number(n.dosage),
        })),
    }));
    onSave(payload);
  };

  return (
    <VStack align="stretch" gap={4} data-testid="feeding-editor">
      {weeks.map((week, i) => (
        <Card.Root key={i} data-testid={`editor-week-${week.week_number}`}>
          <Card.Body p={4}>
            <HStack justify="space-between" mb={3}>
              <Heading size="sm">Week {week.week_number}</Heading>
              <IconButton
                aria-label="Remove week"
                size="xs"
                variant="ghost"
                colorPalette="red"
                data-testid={`remove-week-${week.week_number}`}
                onClick={() => removeWeek(i)}
              >
                <Trash2 size={14} />
              </IconButton>
            </HStack>

            <VStack align="stretch" gap={2}>
              {week.nutrients.length === 0 && (
                <Text fontSize="sm" color="gray.400">
                  No nutrients yet
                </Text>
              )}
              {week.nutrients.map((n, j) => (
                <HStack key={j} gap={2}>
                  <select
                    data-testid={`nutrient-select-${week.week_number}`}
                    value={n.nutrient_id}
                    onChange={(e) =>
                      update((d) => {
                        d[i].nutrients[j].nutrient_id = e.target.value;
                      })
                    }
                    style={{
                      flex: 1,
                      padding: "8px",
                      border: "1px solid #e2e8f0",
                      borderRadius: 6,
                    }}
                  >
                    <option value="">Select nutrient…</option>
                    {catalog.map((nut) => (
                      <option key={nut.id} value={nut.id}>
                        {nut.brand} {nut.product_name}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    w="120px"
                    placeholder="ml/gal"
                    data-testid={`dosage-input-${week.week_number}`}
                    value={n.dosage}
                    onChange={(e) =>
                      update((d) => {
                        d[i].nutrients[j].dosage = e.target.value;
                      })
                    }
                  />
                  <IconButton
                    aria-label="Remove nutrient"
                    size="xs"
                    variant="ghost"
                    onClick={() => removeNutrient(i, j)}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </HStack>
              ))}
              <Button
                size="xs"
                variant="outline"
                alignSelf="flex-start"
                data-testid={`add-nutrient-${week.week_number}`}
                onClick={() => addNutrient(i)}
              >
                <Plus size={14} /> Add nutrient
              </Button>
            </VStack>

            <HStack mt={3} gap={4} flexWrap="wrap" fontSize="xs" color="gray.600">
              <Text fontWeight="medium">Targets</Text>
              {([
                ["EC", "ec_min", "ec_max", "0.1"],
                ["PPM", "ppm_min", "ppm_max", "1"],
                ["pH", "ph_min", "ph_max", "0.1"],
              ] as const).map(([label, minKey, maxKey, step]) => (
                <HStack key={label} gap={1}>
                  <Text>{label}</Text>
                  <Input
                    size="xs"
                    w="52px"
                    type="number"
                    step={step}
                    placeholder="min"
                    data-testid={`${minKey.replace("_", "-")}-${week.week_number}`}
                    value={week[minKey] as string}
                    onChange={(e) =>
                      update((d) => {
                        (d[i] as any)[minKey] = e.target.value;
                      })
                    }
                  />
                  <Text>–</Text>
                  <Input
                    size="xs"
                    w="52px"
                    type="number"
                    step={step}
                    placeholder="max"
                    data-testid={`${maxKey.replace("_", "-")}-${week.week_number}`}
                    value={week[maxKey] as string}
                    onChange={(e) =>
                      update((d) => {
                        (d[i] as any)[maxKey] = e.target.value;
                      })
                    }
                  />
                </HStack>
              ))}
            </HStack>

            <HStack mt={2} gap={4} fontSize="xs" color="gray.600">
              <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input
                  type="checkbox"
                  data-testid={`flush-toggle-${week.week_number}`}
                  checked={week.is_flush}
                  onChange={(e) =>
                    update((d) => {
                      d[i].is_flush = e.target.checked;
                    })
                  }
                />
                Flush week
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input
                  type="checkbox"
                  data-testid={`water-toggle-${week.week_number}`}
                  checked={week.is_water_only}
                  onChange={(e) =>
                    update((d) => {
                      d[i].is_water_only = e.target.checked;
                    })
                  }
                />
                Water only
              </label>
            </HStack>

            <Input
              mt={3}
              size="sm"
              placeholder="Week notes (optional)"
              value={week.notes}
              onChange={(e) =>
                update((d) => {
                  d[i].notes = e.target.value;
                })
              }
            />
          </Card.Body>
        </Card.Root>
      ))}

      <HStack>
        <Button variant="outline" data-testid="add-week-btn" onClick={addWeek}>
          <Plus size={16} /> Add week
        </Button>
        <Button
          colorPalette="green"
          data-testid="save-schedule-btn"
          onClick={handleSave}
          loading={saving}
        >
          {saveLabel}
        </Button>
      </HStack>
    </VStack>
  );
}

export default FeedingScheduleEditor;
