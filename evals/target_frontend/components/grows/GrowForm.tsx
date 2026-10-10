"use client";

/**
 * GrowForm Component
 *
 * Reusable form component for creating and editing cannabis grows.
 * Implements comprehensive validation using Zod schema.
 * Supports all grow configuration fields with proper validation.
 */

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Button,
  Field,
  Input,
  Textarea,
  VStack,
  NativeSelectRoot,
  NativeSelectField,
} from "@chakra-ui/react";
import type { CreateGrowRequest, StrainType, GrowMethod, LightType } from "../../types";
import { EnvironmentSelector } from "./EnvironmentSelector";
import { CapacityWarningSection } from "./CapacityWarningSection";

/**
 * Zod validation schema for grow form
 * Matches backend validation rules and constraints
 */
const growFormSchema = z.object({
  strain_name: z
    .string()
    .min(1, "Strain name is required")
    .max(255, "Strain name must be 255 characters or less"),
  strain_type: z
    .enum(["indica", "sativa", "hybrid", "ruderalis", ""])
    .optional(),
  grow_method: z
    .enum(["soil", "coco", "hydro", "dwc", "aero", "other", ""])
    .optional(),
  grow_medium: z
    .string()
    .max(255, "Grow medium must be 255 characters or less")
    .optional(),
  light_type: z
    .enum(["led", "hps", "mh", "cfl", "sun", "other", ""])
    .optional(),
  light_wattage: z
    .number()
    .positive("Light wattage must be greater than 0")
    .optional()
    .nullable(),
  grow_space_sqft: z
    .number()
    .positive("Grow space must be greater than 0")
    .optional()
    .nullable(),
  pot_size_gallons: z
    .number()
    .positive("Pot size must be greater than 0")
    .optional()
    .nullable(),
  plant_count: z
    .number()
    .int("Plant count must be a whole number")
    .min(1, "Plant count must be at least 1"),
  started_at: z.string().min(1, "Start date is required"),
  notes: z
    .string()
    .max(5000, "Notes must be 5000 characters or less")
    .optional(),
  environment_id: z.string().uuid().optional().nullable(),
});

type GrowFormData = z.infer<typeof growFormSchema>;

interface GrowFormProps {
  onSubmit: (data: CreateGrowRequest) => Promise<void>;
  initialData?: Partial<GrowFormData>;
  isLoading?: boolean;
}

/**
 * GrowForm component
 * Displays all grow fields with validation and error handling
 */
export const GrowForm: React.FC<GrowFormProps> = ({
  onSubmit,
  initialData,
  isLoading = false,
}) => {
  const [environmentId, setEnvironmentId] = useState<string | null>(
    initialData?.environment_id || null
  );

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<GrowFormData>({
    resolver: zodResolver(growFormSchema),
    defaultValues: initialData || {
      strain_name: "",
      strain_type: "",
      grow_method: "",
      grow_medium: "",
      light_type: "",
      light_wattage: undefined,
      grow_space_sqft: undefined,
      pot_size_gallons: undefined,
      plant_count: 1,
      started_at: "",
      notes: "",
      environment_id: null,
    },
  });

  // Watch plant_count for capacity checking
  const plantCount = watch("plant_count");

  const onFormSubmit = async (data: GrowFormData) => {
    // Transform form data to API request format
    const requestData: CreateGrowRequest = {
      strain_name: data.strain_name,
      strain_type: data.strain_type && data.strain_type.length > 0
        ? (data.strain_type as StrainType)
        : undefined,
      grow_method: data.grow_method && data.grow_method.length > 0
        ? (data.grow_method as GrowMethod)
        : undefined,
      grow_medium: data.grow_medium || undefined,
      light_type: data.light_type && data.light_type.length > 0
        ? (data.light_type as LightType)
        : undefined,
      light_wattage: data.light_wattage || undefined,
      grow_space_sqft: data.grow_space_sqft || undefined,
      pot_size_gallons: data.pot_size_gallons || undefined,
      plant_count: data.plant_count,
      started_at: data.started_at,
      notes: data.notes || undefined,
      environment_id: environmentId || undefined,
    };

    await onSubmit(requestData);
  };

  return (
    <form noValidate onSubmit={handleSubmit(onFormSubmit)}>
      <VStack gap={4} align="stretch">
        {/* Strain Name - Required */}
        <Field.Root invalid={!!errors.strain_name} required>
          <Field.Label>Strain Name</Field.Label>
          <Input
            {...register("strain_name")}
            placeholder="e.g., Blue Dream, Northern Lights"
            data-testid="strain-name-input"
          />
          <Field.ErrorText>{errors.strain_name?.message}</Field.ErrorText>
        </Field.Root>

        {/* Strain Type - Optional */}
        <Field.Root invalid={!!errors.strain_type}>
          <Field.Label>Strain Type</Field.Label>
          <NativeSelectRoot>
            <NativeSelectField
              {...register("strain_type")}
              data-testid="strain-type-select"
            >
              <option value="">Select strain type...</option>
              <option value="indica">Indica</option>
              <option value="sativa">Sativa</option>
              <option value="hybrid">Hybrid</option>
              <option value="ruderalis">Ruderalis</option>
            </NativeSelectField>
          </NativeSelectRoot>
          <Field.ErrorText>{errors.strain_type?.message}</Field.ErrorText>
        </Field.Root>

        {/* Environment - Optional */}
        <EnvironmentSelector
          value={environmentId}
          onChange={setEnvironmentId}
          label="Growing Environment (Optional)"
          helperText="Assign this grow to a tent, room, or other growing space"
        />

        {/* Capacity Warning Section - Shows when environment is selected */}
        {environmentId && (
          <CapacityWarningSection
            environmentId={environmentId}
            plantCount={plantCount || 0}
            data-testid="grow-form-capacity-warning"
          />
        )}

        {/* Grow Method - Optional */}
        <Field.Root invalid={!!errors.grow_method}>
          <Field.Label>Grow Method</Field.Label>
          <NativeSelectRoot>
            <NativeSelectField
              {...register("grow_method")}
              data-testid="grow-method-select"
            >
              <option value="">Select grow method...</option>
              <option value="soil">Soil</option>
              <option value="coco">Coco Coir</option>
              <option value="hydro">Hydroponic</option>
              <option value="dwc">Deep Water Culture (DWC)</option>
              <option value="aero">Aeroponic</option>
              <option value="other">Other</option>
            </NativeSelectField>
          </NativeSelectRoot>
          <Field.ErrorText>{errors.grow_method?.message}</Field.ErrorText>
        </Field.Root>

        {/* Grow Medium - Optional */}
        <Field.Root invalid={!!errors.grow_medium}>
          <Field.Label>Grow Medium</Field.Label>
          <Input
            {...register("grow_medium")}
            placeholder="e.g., Fox Farm Ocean Forest, Perlite/Vermiculite mix"
            data-testid="grow-medium-input"
          />
          <Field.ErrorText>{errors.grow_medium?.message}</Field.ErrorText>
        </Field.Root>

        {/* Light Type - Optional */}
        <Field.Root invalid={!!errors.light_type}>
          <Field.Label>Light Type</Field.Label>
          <NativeSelectRoot>
            <NativeSelectField
              {...register("light_type")}
              data-testid="light-type-select"
            >
              <option value="">Select light type...</option>
              <option value="led">LED</option>
              <option value="hps">HPS (High Pressure Sodium)</option>
              <option value="mh">MH (Metal Halide)</option>
              <option value="cfl">CFL (Compact Fluorescent)</option>
              <option value="sun">Natural Sunlight</option>
              <option value="other">Other</option>
            </NativeSelectField>
          </NativeSelectRoot>
          <Field.ErrorText>{errors.light_type?.message}</Field.ErrorText>
        </Field.Root>

        {/* Light Wattage - Optional */}
        <Field.Root invalid={!!errors.light_wattage}>
          <Field.Label>Light Wattage</Field.Label>
          <Input
            {...register("light_wattage", {
              // NOTE: no `valueAsNumber` — RHF ignores `setValueAs` when it is set,
              // coercing an empty input to NaN which fails the zod `.positive()`
              // check and silently blocks submit. setValueAs maps "" -> undefined.
              setValueAs: (v) => (v === "" || v === null ? undefined : Number(v)),
            })}
            type="number"
            step="1"
            min="0"
            placeholder="e.g., 600, 1000"
            data-testid="light-wattage-input"
          />
          <Field.ErrorText>{errors.light_wattage?.message}</Field.ErrorText>
        </Field.Root>

        {/* Grow Space Square Feet - Optional */}
        <Field.Root invalid={!!errors.grow_space_sqft}>
          <Field.Label>Grow Space (sq ft)</Field.Label>
          <Input
            {...register("grow_space_sqft", {
              // NOTE: no `valueAsNumber` — RHF ignores `setValueAs` when it is set,
              // coercing an empty input to NaN which fails the zod `.positive()`
              // check and silently blocks submit. setValueAs maps "" -> undefined.
              setValueAs: (v) => (v === "" || v === null ? undefined : Number(v)),
            })}
            type="number"
            step="0.1"
            min="0"
            placeholder="e.g., 10, 25.5"
            data-testid="grow-space-sqft-input"
          />
          <Field.ErrorText>{errors.grow_space_sqft?.message}</Field.ErrorText>
        </Field.Root>

        {/* Pot Size Gallons - Optional */}
        <Field.Root invalid={!!errors.pot_size_gallons}>
          <Field.Label>Pot Size (gallons)</Field.Label>
          <Input
            {...register("pot_size_gallons", {
              // NOTE: no `valueAsNumber` — RHF ignores `setValueAs` when it is set,
              // coercing an empty input to NaN which fails the zod `.positive()`
              // check and silently blocks submit. setValueAs maps "" -> undefined.
              setValueAs: (v) => (v === "" || v === null ? undefined : Number(v)),
            })}
            type="number"
            step="0.5"
            min="0"
            placeholder="e.g., 3, 5, 10"
            data-testid="pot-size-gallons-input"
          />
          <Field.ErrorText>{errors.pot_size_gallons?.message}</Field.ErrorText>
        </Field.Root>

        {/* Plant Count - Required */}
        <Field.Root invalid={!!errors.plant_count} required>
          <Field.Label>Plant Count</Field.Label>
          <Input
            {...register("plant_count", { valueAsNumber: true })}
            type="number"
            step="1"
            min="1"
            placeholder="Number of plants"
            data-testid="plant-count-input"
          />
          <Field.ErrorText>{errors.plant_count?.message}</Field.ErrorText>
        </Field.Root>

        {/* Start Date - Required */}
        <Field.Root invalid={!!errors.started_at} required>
          <Field.Label>Start Date</Field.Label>
          <Input
            {...register("started_at")}
            type="date"
            data-testid="started-at-input"
          />
          <Field.ErrorText>{errors.started_at?.message}</Field.ErrorText>
        </Field.Root>

        {/* Notes - Optional */}
        <Field.Root invalid={!!errors.notes}>
          <Field.Label>Notes</Field.Label>
          <Textarea
            {...register("notes")}
            placeholder="Add any additional details about this grow..."
            rows={4}
            data-testid="notes-textarea"
          />
          <Field.ErrorText>{errors.notes?.message}</Field.ErrorText>
          <Field.HelperText>
            Use this space to record any important details about your setup, goals, or observations.
          </Field.HelperText>
        </Field.Root>

        {/* Submit Button */}
        <Button
          type="submit"
          colorScheme="green"
          size="lg"
          loading={isSubmitting || isLoading}
          loadingText="Saving..."
          data-testid="submit-button"
        >
          Save Grow
        </Button>
      </VStack>
    </form>
  );
};
