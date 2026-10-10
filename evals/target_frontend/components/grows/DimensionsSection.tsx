"use client";

/**
 * DimensionsSection Component
 *
 * Handles dimension inputs and capacity display for grow environments
 */

import React from "react";
import { UseFormRegister, FieldErrors } from "react-hook-form";
import { Box, Field, Grid, Heading, Input, Text } from "@chakra-ui/react";
import { formatDimensions, type CapacityCalculation } from "../../utils/tentCapacity";
import type { EnvironmentFormData } from "../../hooks/useEnvironmentForm";

interface DimensionsSectionProps {
  register: UseFormRegister<EnvironmentFormData>;
  errors: FieldErrors<EnvironmentFormData>;
  widthInches: number | null | undefined;
  depthInches: number | null | undefined;
  heightInches: number | null | undefined;
  capacity: CapacityCalculation | null;
}

export const DimensionsSection: React.FC<DimensionsSectionProps> = ({
  register,
  errors,
  widthInches,
  depthInches,
  heightInches,
  capacity,
}) => {
  return (
    <Box>
      <Heading size="sm" mb={2}>
        Dimensions (inches)
      </Heading>
      <Grid templateColumns={{ base: "1fr", md: "1fr 1fr 1fr" }} gap={4}>
        <Field.Root invalid={!!errors.width_inches}>
          <Field.Label>Width</Field.Label>
          <Input
            {...register("width_inches", {
              setValueAs: (v) => (v === "" ? null : Number(v)),
            })}
            type="number"
            step="1"
            min="1"
            placeholder="e.g., 48"
            data-testid="width-input"
          />
          <Field.ErrorText>{errors.width_inches?.message}</Field.ErrorText>
        </Field.Root>

        <Field.Root invalid={!!errors.depth_inches}>
          <Field.Label>Depth</Field.Label>
          <Input
            {...register("depth_inches", {
              setValueAs: (v) => (v === "" ? null : Number(v)),
            })}
            type="number"
            step="1"
            min="1"
            placeholder="e.g., 48"
            data-testid="depth-input"
          />
          <Field.ErrorText>{errors.depth_inches?.message}</Field.ErrorText>
        </Field.Root>

        <Field.Root invalid={!!errors.height_inches}>
          <Field.Label>Height</Field.Label>
          <Input
            {...register("height_inches", {
              setValueAs: (v) => (v === "" ? null : Number(v)),
            })}
            type="number"
            step="1"
            min="1"
            placeholder="e.g., 80"
            data-testid="height-input"
          />
          <Field.ErrorText>{errors.height_inches?.message}</Field.ErrorText>
        </Field.Root>
      </Grid>
      {widthInches && depthInches && (
        <Text fontSize="sm" color="gray.600" mt={2}>
          Dimensions: {formatDimensions(widthInches, depthInches, heightInches)}
          {capacity && ` (${capacity.squareFeet} sq ft)`}
        </Text>
      )}
    </Box>
  );
};
