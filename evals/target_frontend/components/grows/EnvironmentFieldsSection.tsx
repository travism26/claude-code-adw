"use client";

import React from "react";
import {
  Box,
  Button,
  Collapsible,
  Field,
  Grid,
  GridItem,
  Heading,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";

interface EnvironmentFieldsData {
  temperature_f?: number | null;
  humidity_percent?: number | null;
  ph?: number | null;
  ec?: number | null;
  ppm?: number | null;
  co2_ppm?: number | null;
  light_hours?: number | null;
  light_distance_inches?: number | null;
  vpd?: number | null;
}

interface EnvironmentFieldsSectionProps {
  register: UseFormRegister<any>;
  errors: FieldErrors<EnvironmentFieldsData>;
  isOpen: boolean;
  onToggle: (isOpen: boolean) => void;
}

/**
 * EnvironmentFieldsSection component
 * Collapsible section for environment data fields
 */
export const EnvironmentFieldsSection: React.FC<
  EnvironmentFieldsSectionProps
> = ({ register, errors, isOpen, onToggle }) => {
  return (
    <Collapsible.Root
      open={isOpen}
      onOpenChange={(e) => onToggle(e.open)}
    >
      <Box borderWidth="1px" borderRadius="md" p={4} borderColor="gray.200">
        <Collapsible.Trigger asChild>
          <Button
            variant="ghost"
            width="full"
            justifyContent="space-between"
            data-testid="environment-section-toggle"
          >
            <Heading size="md">Environment Data (Optional)</Heading>
            {isOpen ? <ChevronUp /> : <ChevronDown />}
          </Button>
        </Collapsible.Trigger>

        <Collapsible.Content data-testid="environment-section-content">
          <VStack gap={4} align="stretch" mt={4}>
            <Text fontSize="sm" color="gray.600" mb={2}>
              Record environmental conditions for this log entry. All fields are
              optional.
            </Text>

            {/* Temperature & Humidity Row */}
            <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={4}>
              <GridItem>
                <Field.Root invalid={!!errors.temperature_f}>
                  <Field.Label>Temperature (°F)</Field.Label>
                  <Input
                    {...register("temperature_f", {
                      // no valueAsNumber — it overrides setValueAs and coerces
                      // empty -> NaN, which fails zod and silently blocks submit.
                      setValueAs: (v) => (v === "" ? undefined : Number(v)),
                    })}
                    type="number"
                    step="0.1"
                    placeholder="e.g., 75.5"
                    data-testid="temperature-input"
                  />
                  <Field.ErrorText>
                    {errors.temperature_f?.message}
                  </Field.ErrorText>
                </Field.Root>
              </GridItem>

              <GridItem>
                <Field.Root invalid={!!errors.humidity_percent}>
                  <Field.Label>Humidity (%)</Field.Label>
                  <Input
                    {...register("humidity_percent", {
                      // no valueAsNumber — it overrides setValueAs and coerces
                      // empty -> NaN, which fails zod and silently blocks submit.
                      setValueAs: (v) => (v === "" ? undefined : Number(v)),
                    })}
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    placeholder="e.g., 60"
                    data-testid="humidity-input"
                  />
                  <Field.ErrorText>
                    {errors.humidity_percent?.message}
                  </Field.ErrorText>
                </Field.Root>
              </GridItem>
            </Grid>

            {/* pH, EC, PPM Row */}
            <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={4}>
              <GridItem>
                <Field.Root invalid={!!errors.ph}>
                  <Field.Label>pH</Field.Label>
                  <Input
                    {...register("ph", {
                      // no valueAsNumber — it overrides setValueAs and coerces
                      // empty -> NaN, which fails zod and silently blocks submit.
                      setValueAs: (v) => (v === "" ? undefined : Number(v)),
                    })}
                    type="number"
                    step="0.1"
                    min="0"
                    max="14"
                    placeholder="e.g., 6.5"
                    data-testid="ph-input"
                  />
                  <Field.ErrorText>{errors.ph?.message}</Field.ErrorText>
                </Field.Root>
              </GridItem>

              <GridItem>
                <Field.Root invalid={!!errors.ec}>
                  <Field.Label>EC (mS/cm)</Field.Label>
                  <Input
                    {...register("ec", {
                      // no valueAsNumber — it overrides setValueAs and coerces
                      // empty -> NaN, which fails zod and silently blocks submit.
                      setValueAs: (v) => (v === "" ? undefined : Number(v)),
                    })}
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="e.g., 1.5"
                    data-testid="ec-input"
                  />
                  <Field.ErrorText>{errors.ec?.message}</Field.ErrorText>
                </Field.Root>
              </GridItem>

              <GridItem>
                <Field.Root invalid={!!errors.ppm}>
                  <Field.Label>PPM (TDS)</Field.Label>
                  <Input
                    {...register("ppm", {
                      // no valueAsNumber — it overrides setValueAs and coerces
                      // empty -> NaN, which fails zod and silently blocks submit.
                      setValueAs: (v) => (v === "" ? undefined : Number(v)),
                    })}
                    type="number"
                    step="1"
                    min="0"
                    placeholder="e.g., 800"
                    data-testid="ppm-input"
                  />
                  <Field.ErrorText>{errors.ppm?.message}</Field.ErrorText>
                </Field.Root>
              </GridItem>
            </Grid>

            {/* CO2 & VPD Row */}
            <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={4}>
              <GridItem>
                <Field.Root invalid={!!errors.co2_ppm}>
                  <Field.Label>CO2 (PPM)</Field.Label>
                  <Input
                    {...register("co2_ppm", {
                      // no valueAsNumber — it overrides setValueAs and coerces
                      // empty -> NaN, which fails zod and silently blocks submit.
                      setValueAs: (v) => (v === "" ? undefined : Number(v)),
                    })}
                    type="number"
                    step="1"
                    min="0"
                    placeholder="e.g., 1200"
                    data-testid="co2-input"
                  />
                  <Field.ErrorText>{errors.co2_ppm?.message}</Field.ErrorText>
                </Field.Root>
              </GridItem>

              <GridItem>
                <Field.Root invalid={!!errors.vpd}>
                  <Field.Label>VPD (kPa)</Field.Label>
                  <Input
                    {...register("vpd", {
                      // no valueAsNumber — it overrides setValueAs and coerces
                      // empty -> NaN, which fails zod and silently blocks submit.
                      setValueAs: (v) => (v === "" ? undefined : Number(v)),
                    })}
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="e.g., 1.2"
                    data-testid="vpd-input"
                  />
                  <Field.ErrorText>{errors.vpd?.message}</Field.ErrorText>
                  <Field.HelperText fontSize="xs">
                    Auto-calculated from temp + humidity if left blank
                  </Field.HelperText>
                </Field.Root>
              </GridItem>
            </Grid>

            {/* Light Parameters Row */}
            <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={4}>
              <GridItem>
                <Field.Root invalid={!!errors.light_hours}>
                  <Field.Label>Light Hours (per day)</Field.Label>
                  <Input
                    {...register("light_hours", {
                      // no valueAsNumber — it overrides setValueAs and coerces
                      // empty -> NaN, which fails zod and silently blocks submit.
                      setValueAs: (v) => (v === "" ? undefined : Number(v)),
                    })}
                    type="number"
                    step="0.5"
                    min="0"
                    max="24"
                    placeholder="e.g., 18"
                    data-testid="light-hours-input"
                  />
                  <Field.ErrorText>
                    {errors.light_hours?.message}
                  </Field.ErrorText>
                </Field.Root>
              </GridItem>

              <GridItem>
                <Field.Root invalid={!!errors.light_distance_inches}>
                  <Field.Label>Light Distance (inches)</Field.Label>
                  <Input
                    {...register("light_distance_inches", {
                      // no valueAsNumber — it overrides setValueAs and coerces
                      // empty -> NaN, which fails zod and silently blocks submit.
                      setValueAs: (v) => (v === "" ? undefined : Number(v)),
                    })}
                    type="number"
                    step="1"
                    min="0"
                    placeholder="e.g., 24"
                    data-testid="light-distance-input"
                  />
                  <Field.ErrorText>
                    {errors.light_distance_inches?.message}
                  </Field.ErrorText>
                </Field.Root>
              </GridItem>
            </Grid>
          </VStack>
        </Collapsible.Content>
      </Box>
    </Collapsible.Root>
  );
};
