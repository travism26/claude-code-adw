"use client";

/**
 * Form to record/edit a grow's harvest (wet/dry/trim weights, THC/CBD, cure
 * days, quality rating, smoke report). Uses noValidate so RHF/zod own
 * validation, and setValueAs (no valueAsNumber) so empty optionals don't become
 * NaN — the two pitfalls fixed earlier in the grows forms.
 */

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Box, VStack, SimpleGrid, Field, Input, Textarea, Button, Heading } from "@chakra-ui/react";
import type { GrowHarvest, HarvestInput } from "../../types/growHarvest";

const schema = z.object({
  harvested_at: z.string().min(1, "Harvest date is required"),
  wet_weight_grams: z.number().min(0).optional().nullable(),
  dry_weight_grams: z.number().min(0).optional().nullable(),
  trim_weight_grams: z.number().min(0).optional().nullable(),
  thc_percent: z.number().min(0).max(100).optional().nullable(),
  cbd_percent: z.number().min(0).max(100).optional().nullable(),
  cure_days: z.number().int().min(0).optional().nullable(),
  quality_rating: z.number().int().min(1).max(5).optional().nullable(),
  smoke_report: z.string().max(5000).optional(),
});
type HarvestFormData = z.infer<typeof schema>;

const num = { setValueAs: (v: any) => (v === "" || v === null ? undefined : Number(v)) };

interface HarvestFormProps {
  initial?: GrowHarvest | null;
  onSubmit: (data: HarvestInput) => void;
  saving?: boolean;
}

export function HarvestForm({ initial, onSubmit, saving = false }: HarvestFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<HarvestFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      harvested_at: initial?.harvested_at ? initial.harvested_at.slice(0, 10) : "",
      wet_weight_grams: initial?.wet_weight_grams ?? undefined,
      dry_weight_grams: initial?.dry_weight_grams ?? undefined,
      trim_weight_grams: initial?.trim_weight_grams ?? undefined,
      thc_percent: initial?.thc_percent ?? undefined,
      cbd_percent: initial?.cbd_percent ?? undefined,
      cure_days: initial?.cure_days ?? undefined,
      quality_rating: initial?.quality_rating ?? undefined,
      smoke_report: initial?.smoke_report ?? "",
    },
  });

  const onFormSubmit = (data: HarvestFormData) => {
    onSubmit({
      harvested_at: data.harvested_at,
      wet_weight_grams: data.wet_weight_grams ?? undefined,
      dry_weight_grams: data.dry_weight_grams ?? undefined,
      trim_weight_grams: data.trim_weight_grams ?? undefined,
      thc_percent: data.thc_percent ?? undefined,
      cbd_percent: data.cbd_percent ?? undefined,
      cure_days: data.cure_days ?? undefined,
      quality_rating: data.quality_rating ?? undefined,
      smoke_report: data.smoke_report || undefined,
    });
  };

  return (
    <form noValidate onSubmit={handleSubmit(onFormSubmit)} data-testid="harvest-form">
      <VStack align="stretch" gap={4}>
        <Heading size="md">{initial ? "Edit harvest" : "Record harvest"}</Heading>

        <Field.Root invalid={!!errors.harvested_at} required>
          <Field.Label>Harvest date</Field.Label>
          <Input type="date" data-testid="harvest-date-input" {...register("harvested_at")} maxW="220px" />
          <Field.ErrorText>{errors.harvested_at?.message}</Field.ErrorText>
        </Field.Root>

        <SimpleGrid columns={{ base: 1, sm: 3 }} gap={4}>
          <Field.Root invalid={!!errors.wet_weight_grams}>
            <Field.Label>Wet weight (g)</Field.Label>
            <Input type="number" step="0.1" min="0" data-testid="wet-weight-input" {...register("wet_weight_grams", num)} />
          </Field.Root>
          <Field.Root invalid={!!errors.dry_weight_grams}>
            <Field.Label>Dry weight (g)</Field.Label>
            <Input type="number" step="0.1" min="0" data-testid="dry-weight-input" {...register("dry_weight_grams", num)} />
          </Field.Root>
          <Field.Root invalid={!!errors.trim_weight_grams}>
            <Field.Label>Trim (g)</Field.Label>
            <Input type="number" step="0.1" min="0" data-testid="trim-weight-input" {...register("trim_weight_grams", num)} />
          </Field.Root>
        </SimpleGrid>

        <SimpleGrid columns={{ base: 1, sm: 4 }} gap={4}>
          <Field.Root invalid={!!errors.thc_percent}>
            <Field.Label>THC %</Field.Label>
            <Input type="number" step="0.1" min="0" max="100" data-testid="thc-input" {...register("thc_percent", num)} />
          </Field.Root>
          <Field.Root invalid={!!errors.cbd_percent}>
            <Field.Label>CBD %</Field.Label>
            <Input type="number" step="0.1" min="0" max="100" data-testid="cbd-input" {...register("cbd_percent", num)} />
          </Field.Root>
          <Field.Root invalid={!!errors.cure_days}>
            <Field.Label>Cure days</Field.Label>
            <Input type="number" step="1" min="0" data-testid="cure-days-input" {...register("cure_days", num)} />
          </Field.Root>
          <Field.Root invalid={!!errors.quality_rating}>
            <Field.Label>Quality (1–5)</Field.Label>
            <Input type="number" step="1" min="1" max="5" data-testid="quality-rating-input" {...register("quality_rating", num)} />
            <Field.ErrorText>{errors.quality_rating?.message}</Field.ErrorText>
          </Field.Root>
        </SimpleGrid>

        <Field.Root invalid={!!errors.smoke_report}>
          <Field.Label>Smoke report / notes</Field.Label>
          <Textarea rows={3} data-testid="smoke-report-input" placeholder="Aroma, effects, observations…" {...register("smoke_report")} />
        </Field.Root>

        <Box>
          <Button type="submit" colorPalette="green" loading={saving} data-testid="save-harvest-btn">
            {initial ? "Save changes" : "Record harvest"}
          </Button>
        </Box>
      </VStack>
    </form>
  );
}

export default HarvestForm;
