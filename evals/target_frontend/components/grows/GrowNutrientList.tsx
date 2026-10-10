"use client";

/**
 * Grow Nutrient List Component
 *
 * Displays all nutrients configured for a grow with dosage,
 * frequency, and phase information. Shows nutrient details
 * including brand, product name, NPK ratio, and organic status.
 */

import type React from "react";
import {
  Box,
  Flex,
  Text,
  Badge,
  Card,
  VStack,
  HStack,
  Grid,
  Spinner,
} from "@chakra-ui/react";
import { Droplet, Calendar, Leaf } from "lucide-react";
import type { GrowNutrient, NutrientType, GrowNutrientFrequency, GrowNutrientPhase } from "../../types";
import { useGrowNutrients } from "../../hooks/useNutrients";

interface GrowNutrientListProps {
  /** Grow ID to fetch nutrients for */
  growId: string;
}

/**
 * Gets color scheme for nutrient type badges
 */
function getNutrientTypeColor(type: NutrientType): string {
  const typeColors: Record<NutrientType, string> = {
    base: "blue",
    supplement: "green",
    additive: "purple",
    ph_adjuster: "orange",
    other: "gray",
  };
  return typeColors[type];
}

/**
 * Formats nutrient type for display
 */
function formatNutrientType(type: NutrientType): string {
  const typeLabels: Record<NutrientType, string> = {
    base: "Base Nutrient",
    supplement: "Supplement",
    additive: "Additive",
    ph_adjuster: "pH Adjuster",
    other: "Other",
  };
  return typeLabels[type];
}

/**
 * Formats frequency for display
 */
function formatFrequency(frequency: GrowNutrientFrequency | null): string {
  if (!frequency) return "Not specified";

  const frequencyLabels: Record<GrowNutrientFrequency, string> = {
    every_watering: "Every watering",
    weekly: "Weekly",
    biweekly: "Bi-weekly",
    as_needed: "As needed",
  };
  return frequencyLabels[frequency];
}

/**
 * Formats phase for display
 */
function formatPhase(phase: GrowNutrientPhase | null): string {
  if (!phase) return "Not specified";

  const phaseLabels: Record<GrowNutrientPhase, string> = {
    all: "All phases",
    vegetative: "Vegetative",
    flowering: "Flowering",
    late_flowering: "Late flowering",
  };
  return phaseLabels[phase];
}

/**
 * Gets color for phase badge
 */
function getPhaseColor(phase: GrowNutrientPhase | null): string {
  if (!phase) return "gray";

  const phaseColors: Record<GrowNutrientPhase, string> = {
    all: "green",
    vegetative: "teal",
    flowering: "purple",
    late_flowering: "pink",
  };
  return phaseColors[phase];
}

/**
 * Nutrient Card Component
 * Displays a single nutrient with all configuration details
 */
const NutrientCard: React.FC<{ growNutrient: GrowNutrient }> = ({ growNutrient }) => {
  const { nutrient } = growNutrient;

  if (!nutrient) return null;

  return (
    <Card.Root data-testid="nutrient-card">
      <Card.Header pb={2}>
        <Flex justify="space-between" align="flex-start" gap={2}>
          <VStack align="flex-start" gap={1} flex="1">
            <Text fontSize="lg" fontWeight="semibold" lineClamp={1}>
              {nutrient.product_name}
            </Text>
            <Text fontSize="sm" color="gray.600">
              {nutrient.brand}
            </Text>
          </VStack>

          <Badge
            colorPalette={getNutrientTypeColor(nutrient.type)}
            fontSize="xs"
          >
            {formatNutrientType(nutrient.type)}
          </Badge>
        </Flex>
      </Card.Header>

      <Card.Body pt={2}>
        <VStack align="stretch" gap={3}>
          {/* NPK Ratio and Organic Badge */}
          <HStack gap={2}>
            {nutrient.npk_ratio && (
              <Badge colorPalette="gray" fontSize="sm">
                NPK: {nutrient.npk_ratio}
              </Badge>
            )}
            {nutrient.is_organic && (
              <Badge colorPalette="green" fontSize="sm">
                <Leaf size={12} />
                Organic
              </Badge>
            )}
          </HStack>

          {/* Dosage */}
          {growNutrient.dosage_ml_per_gallon !== null && (
            <Flex align="center" gap={2} fontSize="sm">
              <Box as={Droplet} boxSize="4" color="blue.500" />
              <Text fontWeight="semibold">Dosage:</Text>
              <Text>{growNutrient.dosage_ml_per_gallon} ml/gallon</Text>
            </Flex>
          )}

          {/* Frequency */}
          {growNutrient.frequency && (
            <Flex align="center" gap={2} fontSize="sm">
              <Box as={Calendar} boxSize="4" color="purple.500" />
              <Text fontWeight="semibold">Frequency:</Text>
              <Text>{formatFrequency(growNutrient.frequency)}</Text>
            </Flex>
          )}

          {/* Phase Used */}
          {growNutrient.phase_used && (
            <Flex align="center" gap={2} fontSize="sm">
              <Badge colorPalette={getPhaseColor(growNutrient.phase_used)} fontSize="xs">
                {formatPhase(growNutrient.phase_used)}
              </Badge>
            </Flex>
          )}

          {/* Notes */}
          {growNutrient.notes && (
            <Box
              p={2}
              borderWidth="1px"
              borderRadius="md"
              borderColor="gray.200"
              bg="gray.50"
            >
              <Text fontSize="xs" color="gray.700" whiteSpace="pre-wrap">
                {growNutrient.notes}
              </Text>
            </Box>
          )}

          {/* Description */}
          {nutrient.description && (
            <Text fontSize="xs" color="gray.600" lineClamp={2}>
              {nutrient.description}
            </Text>
          )}
        </VStack>
      </Card.Body>
    </Card.Root>
  );
};

/**
 * Grow Nutrient List Component
 * Renders the list of nutrients for a grow
 */
export const GrowNutrientList: React.FC<GrowNutrientListProps> = ({ growId }) => {
  const { data, isLoading, error } = useGrowNutrients(growId);

  // Loading state
  if (isLoading) {
    return (
      <VStack gap={4} py={8} data-testid="nutrient-list-loading">
        <Spinner size="lg" colorPalette="green" />
        <Text color="gray.600">Loading nutrients...</Text>
      </VStack>
    );
  }

  // Error state
  if (error) {
    return (
      <Box
        p={6}
        borderWidth="1px"
        borderRadius="md"
        borderColor="red.200"
        bg="red.50"
      >
        <Text color="red.700" fontWeight="semibold" mb={2}>
          Error loading nutrients
        </Text>
        <Text color="red.600" fontSize="sm">
          {error.message}
        </Text>
      </Box>
    );
  }

  // Empty state
  if (!data?.grow_nutrients || data.grow_nutrients.length === 0) {
    return (
      <VStack gap={4} py={12} data-testid="nutrient-list-empty">
        <Box as={Droplet} boxSize="12" color="gray.300" />
        <Text fontSize="lg" fontWeight="semibold" color="gray.600">
          No nutrients configured
        </Text>
        <Text color="gray.500" textAlign="center" maxW="md">
          Add nutrients to track your feeding schedule, dosages, and application frequency
          throughout the grow cycle.
        </Text>
      </VStack>
    );
  }

  return (
    <Box data-testid="nutrient-list">
      <Text fontSize="sm" color="gray.600" mb={4}>
        {data.grow_nutrients.length}{" "}
        {data.grow_nutrients.length === 1 ? "nutrient" : "nutrients"} configured
      </Text>

      <Grid
        templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }}
        gap={4}
      >
        {data.grow_nutrients.map((growNutrient) => (
          <NutrientCard key={growNutrient.id} growNutrient={growNutrient} />
        ))}
      </Grid>
    </Box>
  );
};
