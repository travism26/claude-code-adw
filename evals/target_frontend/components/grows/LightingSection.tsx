"use client";

/**
 * LightingSection Component
 *
 * Handles lighting configuration inputs for grow environments
 */

import React from "react";
import { UseFormRegister, FieldErrors } from "react-hook-form";
import {
  Box,
  Field,
  Grid,
  Heading,
  Input,
  NativeSelectField,
  NativeSelectRoot,
} from "@chakra-ui/react";
import type { CapacityCalculation } from "../../utils/tentCapacity";
import type { EnvironmentFormData } from "../../hooks/useEnvironmentForm";

interface LightingSectionProps {
  register: UseFormRegister<EnvironmentFormData>;
  errors: FieldErrors<EnvironmentFormData>;
  capacity: CapacityCalculation | null;
}

export const LightingSection: React.FC<LightingSectionProps> = ({
  register,
  errors,
  capacity,
}) => {
  return (
    <Box>
      <Heading size="sm" mb={2}>
        Lighting
      </Heading>
      <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
        <Field.Root invalid={!!errors.light_type}>
          <Field.Label>Light Type</Field.Label>
          <NativeSelectRoot>
            <NativeSelectField
              {...register("light_type")}
              data-testid="light-type-select"
            >
              <option value="">Select light type...</option>
              <option value="led">LED</option>
              <option value="hps">HPS</option>
              <option value="mh">Metal Halide</option>
              <option value="cfl">CFL</option>
              <option value="sun">Natural Sunlight</option>
              <option value="other">Other</option>
            </NativeSelectField>
          </NativeSelectRoot>
          <Field.ErrorText>{errors.light_type?.message}</Field.ErrorText>
        </Field.Root>

        <Field.Root invalid={!!errors.light_wattage}>
          <Field.Label>Light Wattage</Field.Label>
          <Input
            {...register("light_wattage", {
              setValueAs: (v) => (v === "" ? null : Number(v)),
            })}
            type="number"
            step="1"
            min="1"
            placeholder="e.g., 600"
            data-testid="light-wattage-input"
          />
          <Field.ErrorText>{errors.light_wattage?.message}</Field.ErrorText>
          {capacity && (
            <Field.HelperText>
              Recommended: {capacity.recommendedWattage}W for this space
            </Field.HelperText>
          )}
        </Field.Root>
      </Grid>
    </Box>
  );
};
