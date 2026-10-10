"use client";

/**
 * Garden Health Badge Component
 *
 * Displays a color-coded badge showing the garden's overall health score.
 * Uses the following color scheme:
 * - Green (80-100): Excellent garden layout
 * - Yellow (60-79): Good with minor improvements
 * - Orange (40-59): Needs attention
 * - Red (0-39): Significant issues to address
 */

import type React from "react";
import { Badge, Flex, Text } from "@chakra-ui/react";
import { CheckCircle, AlertTriangle, AlertCircle, XCircle } from "lucide-react";

interface GardenHealthBadgeProps {
  /** Health score from 0-100 */
  score: number;
  /** Size variant for the badge */
  size?: "sm" | "md" | "lg";
}

/**
 * Gets the color scheme and icon based on the health score
 */
function getHealthIndicator(score: number) {
  if (score >= 80) {
    return {
      colorScheme: "green",
      icon: CheckCircle,
      label: "Excellent",
      ariaLabel: `Garden health score: ${score} - Excellent`,
    };
  } else if (score >= 60) {
    return {
      colorScheme: "yellow",
      icon: AlertTriangle,
      label: "Good",
      ariaLabel: `Garden health score: ${score} - Good`,
    };
  } else if (score >= 40) {
    return {
      colorScheme: "orange",
      icon: AlertCircle,
      label: "Needs Attention",
      ariaLabel: `Garden health score: ${score} - Needs Attention`,
    };
  } else {
    return {
      colorScheme: "red",
      icon: XCircle,
      label: "Needs Improvement",
      ariaLabel: `Garden health score: ${score} - Needs Improvement`,
    };
  }
}

/**
 * Gets the size configuration for the badge
 */
function getSizeConfig(size: "sm" | "md" | "lg" = "md") {
  switch (size) {
    case "sm":
      return { fontSize: "sm", iconSize: 3, gap: 1 };
    case "lg":
      return { fontSize: "lg", iconSize: 5, gap: 2 };
    case "md":
    default:
      return { fontSize: "md", iconSize: 4, gap: 1.5 };
  }
}

export const GardenHealthBadge: React.FC<GardenHealthBadgeProps> = ({
  score,
  size = "md",
}) => {
  const indicator = getHealthIndicator(score);
  const sizeConfig = getSizeConfig(size);
  const Icon = indicator.icon;

  return (
    <Badge
      colorPalette={indicator.colorScheme}
      data-testid="garden-health-badge"
      aria-label={indicator.ariaLabel}
      px={3}
      py={1.5}
      borderRadius="md"
      fontSize={sizeConfig.fontSize}
    >
      <Flex align="center" gap={sizeConfig.gap}>
        <Icon size={sizeConfig.iconSize * 4} />
        <Text fontWeight="semibold">{score}</Text>
        <Text>/ 100</Text>
        <Text display={{ base: "none", md: "inline" }}>- {indicator.label}</Text>
      </Flex>
    </Badge>
  );
};
