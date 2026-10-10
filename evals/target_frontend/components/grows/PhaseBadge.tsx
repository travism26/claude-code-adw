"use client";

/**
 * Phase Badge Component
 *
 * Displays a color-coded badge for cannabis cultivation phases.
 * Phase colors:
 * - Germination: Yellow (seeds sprouting)
 * - Vegetative: Green (plant growth)
 * - Flowering: Purple (bud development)
 * - Harvest: Orange (ready to harvest)
 * - Archived: Gray (completed grow)
 */

import type React from "react";
import { Badge } from "@chakra-ui/react";
import type { GrowPhase } from "../../types";

interface PhaseBadgeProps {
  /** Current cultivation phase (may be null/undefined for log entries with no phase) */
  phase: GrowPhase | null | undefined;
  /** Size variant for the badge */
  size?: "sm" | "md" | "lg";
  /** Whether to show the phase label text */
  showLabel?: boolean;
}

/**
 * Gets the color scheme for a given phase
 */
function getPhaseColor(phase: GrowPhase): string {
  const phaseColors: Record<GrowPhase, string> = {
    germination: "yellow",
    vegetative: "green",
    flowering: "purple",
    harvest: "orange",
    archived: "gray",
  };
  return phaseColors[phase];
}

/**
 * Capitalizes the phase name for display
 */
function formatPhaseLabel(phase: GrowPhase): string {
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}

/**
 * Gets the font size for the badge based on size prop
 */
function getFontSize(size: "sm" | "md" | "lg" = "md"): string {
  const sizes: Record<"sm" | "md" | "lg", string> = {
    sm: "xs",
    md: "sm",
    lg: "md",
  };
  return sizes[size];
}

/**
 * Phase Badge Component
 * Renders a color-coded badge showing the current cultivation phase
 */
export const PhaseBadge: React.FC<PhaseBadgeProps> = ({
  phase,
  size = "md",
  showLabel = true,
}) => {
  // Logs/entities without a phase render nothing rather than crashing.
  if (!phase) return null;

  const colorScheme = getPhaseColor(phase);
  const fontSize = getFontSize(size);
  const label = formatPhaseLabel(phase);

  return (
    <Badge
      colorPalette={colorScheme}
      fontSize={fontSize}
      px={2}
      py={0.5}
      borderRadius="md"
      fontWeight="semibold"
      data-testid="grow-card-phase"
    >
      {showLabel ? label : null}
    </Badge>
  );
};
