"use client";

/**
 * Grow Card Component
 *
 * Displays a summary of a cannabis grow in a card format.
 * Shows strain information, current phase, plant count, grow method,
 * and days in the current phase.
 */

import type React from "react";
import { Box, Flex, Text, Badge, Card, VStack, HStack } from "@chakra-ui/react";
import { Calendar, Droplet, Sun } from "lucide-react";
import type { Grow } from "../../types";
import { PhaseBadge } from "./PhaseBadge";

interface GrowCardProps {
  /** Grow data to display */
  grow: Grow;
  /** Optional click handler for card interaction */
  onClick?: (grow: Grow) => void;
}

/**
 * Gets the color scheme for strain type badges
 */
function getStrainTypeColor(strainType: string | null): string {
  if (!strainType) return "gray";

  const strainColors: Record<string, string> = {
    indica: "purple",
    sativa: "green",
    hybrid: "blue",
    ruderalis: "orange",
  };
  return strainColors[strainType] || "gray";
}

/**
 * Capitalizes the first letter of a string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Formats the grow method for display
 */
function formatGrowMethod(method: string | null): string {
  if (!method) return "Not specified";

  const methodLabels: Record<string, string> = {
    soil: "Soil",
    coco: "Coco Coir",
    hydro: "Hydroponic",
    dwc: "Deep Water Culture",
    aero: "Aeroponic",
    other: "Other",
  };
  return methodLabels[method] || capitalize(method);
}

/**
 * Calculates days in current phase
 * Returns null if phase_started_at is not set
 */
function calculateDaysInPhase(phaseStartedAt: string | null): number | null {
  if (!phaseStartedAt) return null;

  const startDate = new Date(phaseStartedAt);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - startDate.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Grow Card Component
 * Renders a card displaying grow summary information
 */
export const GrowCard: React.FC<GrowCardProps> = ({ grow, onClick }) => {
  const strainColor = getStrainTypeColor(grow.strain_type);
  const daysInPhase = calculateDaysInPhase(grow.phase_started_at);
  const growMethod = formatGrowMethod(grow.grow_method);

  return (
    <Card.Root
      cursor={onClick ? "pointer" : "default"}
      transition="all 0.2s"
      _hover={onClick ? { shadow: "md", transform: "translateY(-2px)" } : {}}
      onClick={() => onClick?.(grow)}
      data-testid="grow-card"
    >
      <Card.Header pb={3}>
        <Flex align="flex-start" justify="space-between" gap={2}>
          <Box flex="1">
            <Text
              fontSize="lg"
              fontWeight="semibold"
              data-testid="grow-card-strain"
              lineClamp={1}
            >
              {grow.strain_name}
            </Text>
            {grow.strain_type && (
              <Badge
                colorPalette={strainColor}
                fontSize="xs"
                mt={1}
              >
                {capitalize(grow.strain_type)}
              </Badge>
            )}
          </Box>
          <PhaseBadge phase={grow.phase} size="md" />
        </Flex>
      </Card.Header>

      <Card.Body pt={0}>
        <VStack gap={3} align="stretch">
          {/* Plant Count and Grow Method */}
          <Flex gap={4} fontSize="sm" color="gray.600">
            <Flex align="center" gap={1.5}>
              <Box as={Droplet} boxSize="4" color="green.500" />
              <Text>
                {grow.plant_count} {grow.plant_count === 1 ? "plant" : "plants"}
              </Text>
            </Flex>
            <Flex align="center" gap={1.5}>
              <Box as={Sun} boxSize="4" color="orange.500" />
              <Text>{growMethod}</Text>
            </Flex>
          </Flex>

          {/* Days in Phase */}
          {daysInPhase !== null ? (
            <Flex
              align="center"
              gap={2}
              fontSize="sm"
              color="gray.600"
              pt={2}
              borderTop="1px"
              borderColor="gray.200"
            >
              <Box as={Calendar} boxSize="4" />
              <Text>
                Day {daysInPhase} in {grow.phase}
              </Text>
            </Flex>
          ) : (
            <Flex
              align="center"
              gap={2}
              fontSize="sm"
              color="gray.400"
              pt={2}
              borderTop="1px"
              borderColor="gray.200"
            >
              <Box as={Calendar} boxSize="4" />
              <Text>Phase timing not tracked</Text>
            </Flex>
          )}

          {/* Notes Preview */}
          {grow.notes && (
            <Text fontSize="xs" color="gray.600" lineClamp={2} pt={1}>
              {grow.notes}
            </Text>
          )}
        </VStack>
      </Card.Body>
    </Card.Root>
  );
};
