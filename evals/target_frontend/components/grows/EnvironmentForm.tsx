"use client";

/**
 * EnvironmentForm Component
 *
 * Form component for creating and editing grow environments.
 * Supports preset tent sizes and auto-capacity calculation.
 */

import React from "react";
import { Controller } from "react-hook-form";
import {
  Button,
  Field,
  Grid,
  HStack,
  Input,
  NativeSelectField,
  NativeSelectRoot,
  Switch,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import { useEnvironmentForm } from "../../hooks/useEnvironmentForm";
import { PresetTentButtons } from "./PresetTentButtons";
import { DimensionsSection } from "./DimensionsSection";
import { LightingSection } from "./LightingSection";
import { EquipmentSwitches } from "./EquipmentSwitches";
import type {
  CreateGrowEnvironmentRequest,
  UpdateGrowEnvironmentRequest,
  GrowEnvironment,
} from "../../types/growEnvironment";

interface EnvironmentFormProps {
  onSubmit: (data: CreateGrowEnvironmentRequest | UpdateGrowEnvironmentRequest) => Promise<void>;
  initialData?: GrowEnvironment;
  isLoading?: boolean;
  mode?: "create" | "edit";
}

/**
 * EnvironmentForm component
 * Displays all environment fields with validation and preset support
 */
export const EnvironmentForm: React.FC<EnvironmentFormProps> = ({
  onSubmit,
  initialData,
  isLoading = false,
  mode = "create",
}) => {
  const {
    form,
    capacity,
    widthInches,
    depthInches,
    heightInches,
    handlePresetSelect,
    handleFormSubmit,
  } = useEnvironmentForm({ initialData, onSubmit });

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = form;

  // Use div instead of form to prevent nested form issues when rendered in modals
  return (
    <div>
      <VStack gap={6} align="stretch">
        {/* Name and Type */}
        <Grid templateColumns={{ base: "1fr", md: "2fr 1fr" }} gap={4}>
          <Field.Root invalid={!!errors.name} required>
            <Field.Label>Environment Name</Field.Label>
            <Input
              {...register("name")}
              placeholder="e.g., Main Flower Tent, Veg Room"
              data-testid="environment-name-input"
            />
            <Field.ErrorText>{errors.name?.message}</Field.ErrorText>
          </Field.Root>

          <Field.Root invalid={!!errors.type} required>
            <Field.Label>Environment Type</Field.Label>
            <NativeSelectRoot>
              <NativeSelectField {...register("type")} data-testid="environment-type-select">
                <option value="tent">Grow Tent</option>
                <option value="room">Grow Room</option>
                <option value="closet">Closet</option>
                <option value="outdoor">Outdoor</option>
                <option value="greenhouse">Greenhouse</option>
              </NativeSelectField>
            </NativeSelectRoot>
            <Field.ErrorText>{errors.type?.message}</Field.ErrorText>
          </Field.Root>
        </Grid>

        {/* Preset Tent Sizes */}
        <PresetTentButtons onPresetSelect={handlePresetSelect} />

        {/* Dimensions */}
        <DimensionsSection
          register={register}
          errors={errors}
          widthInches={widthInches}
          depthInches={depthInches}
          heightInches={heightInches}
          capacity={capacity}
        />

        {/* Lighting */}
        <LightingSection register={register} errors={errors} capacity={capacity} />

        {/* Ventilation */}
        <Field.Root invalid={!!errors.ventilation_cfm}>
          <Field.Label>Ventilation CFM</Field.Label>
          <Input
            {...register("ventilation_cfm", {
              setValueAs: (v) => (v === "" ? null : Number(v)),
            })}
            type="number"
            step="1"
            min="1"
            placeholder="e.g., 440"
            data-testid="ventilation-cfm-input"
          />
          <Field.ErrorText>{errors.ventilation_cfm?.message}</Field.ErrorText>
        </Field.Root>

        {/* Equipment */}
        <EquipmentSwitches control={control} />

        {/* Capacity */}
        <Field.Root invalid={!!errors.max_plants}>
          <Field.Label>Maximum Plants</Field.Label>
          <Input
            {...register("max_plants", {
              setValueAs: (v) => (v === "" ? null : Number(v)),
            })}
            type="number"
            step="1"
            min="1"
            placeholder="e.g., 4"
            data-testid="max-plants-input"
          />
          <Field.ErrorText>{errors.max_plants?.message}</Field.ErrorText>
          {capacity && (
            <Field.HelperText>
              Recommended: {capacity.vegPlants} for veg, {capacity.flowerPlants} for flower
            </Field.HelperText>
          )}
        </Field.Root>

        {/* Notes */}
        <Field.Root invalid={!!errors.notes}>
          <Field.Label>Notes</Field.Label>
          <Textarea
            {...register("notes")}
            placeholder="Add any additional details about this environment..."
            rows={3}
            data-testid="notes-textarea"
          />
          <Field.ErrorText>{errors.notes?.message}</Field.ErrorText>
        </Field.Root>

        {/* Active Status */}
        <Controller
          name="is_active"
          control={control}
          render={({ field }) => (
            <HStack>
              <Switch.Root
                checked={field.value}
                onCheckedChange={(e) => field.onChange(e.checked)}
                data-testid="is-active-switch"
              >
                <Switch.HiddenInput />
                <Switch.Control />
              </Switch.Root>
              <Text>Active Environment</Text>
            </HStack>
          )}
        />

        {/* Display Color for Calendar */}
        <Field.Root invalid={!!errors.display_color}>
          <Field.Label>Display Color (used in calendar)</Field.Label>
          <Input
            {...register("display_color")}
            type="color"
            defaultValue="#10B981"
            data-testid="environment-color-picker"
          />
          <Field.ErrorText>{errors.display_color?.message}</Field.ErrorText>
        </Field.Root>

        {/* Submit Button */}
        <Button
          type="button"
          colorScheme="green"
          size="lg"
          loading={isSubmitting || isLoading}
          loadingText="Saving..."
          onClick={handleSubmit(handleFormSubmit)}
          data-testid="submit-button"
        >
          {mode === "create" ? "Create Environment" : "Save Changes"}
        </Button>
      </VStack>
    </div>
  );
};
