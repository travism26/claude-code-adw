"use client";

import type React from "react";
import { Box, Text, Badge } from "@chakra-ui/react";

interface ConfigFieldDisplayProps {
  /** Label text displayed above the value */
  label: string;
  /** Value to display - can be string, number, or ReactNode */
  value: React.ReactNode;
  /** Whether to render this field (allows conditional rendering inline) */
  condition?: boolean;
  /** Optional suffix to append to the value */
  suffix?: string;
  /** Whether to display value as a badge */
  asBadge?: boolean;
  /** Badge color palette when asBadge is true */
  badgeColor?: string;
}

/**
 * ConfigFieldDisplay Component
 *
 * Displays a label-value pair in a consistent format.
 * Used in settings grids and configuration displays.
 */
export const ConfigFieldDisplay: React.FC<ConfigFieldDisplayProps> = ({
  label,
  value,
  condition = true,
  suffix,
  asBadge = false,
  badgeColor = "gray",
}) => {
  if (!condition) {
    return null;
  }

  const displayValue = suffix ? `${value}${suffix}` : value;

  return (
    <Box>
      <Text fontSize="sm" color="gray.600" mb={1}>
        {label}
      </Text>
      {asBadge ? (
        <Badge colorPalette={badgeColor} fontSize="sm">
          {displayValue}
        </Badge>
      ) : (
        <Text fontWeight="semibold">{displayValue}</Text>
      )}
    </Box>
  );
};

export default ConfigFieldDisplay;
