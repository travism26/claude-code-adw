"use client";

/**
 * CapacityStatusIndicator Component
 *
 * Displays a colored status indicator for environment capacity.
 * Shows a badge with optional utilization percentage.
 * Includes tooltip with capacity details on hover.
 * Fully accessible with ARIA labels and keyboard navigation.
 */

import { Badge, HStack, Text } from "@chakra-ui/react";
import { CircleCheck, TriangleAlert } from "lucide-react";
import type { CapacityStatus } from "../../types/environmentOverview";

export interface CapacityStatusIndicatorProps {
  /**
   * Capacity status: normal (green), warning (yellow), over (red)
   */
  status: CapacityStatus;

  /**
   * Optional utilization percentage to display (e.g., 75 for 75%)
   */
  utilizationPercent?: number | null;

  /**
   * Size variant: 'sm' for compact display, 'md' for default
   */
  size?: "sm" | "md";

  /**
   * Optional data-testid for E2E testing
   */
  "data-testid"?: string;
}

/**
 * Get color scheme for Chakra UI Badge based on capacity status
 */
const getColorScheme = (status: CapacityStatus): string => {
  switch (status) {
    case "normal":
      return "green";
    case "warning":
      return "orange";
    case "over":
      return "red";
  }
};

/**
 * Get display label for capacity status
 */
const getStatusLabel = (status: CapacityStatus): string => {
  switch (status) {
    case "normal":
      return "Normal";
    case "warning":
      return "Warning";
    case "over":
      return "Over";
  }
};

/**
 * Get icon for capacity status
 */
const getStatusIcon = (status: CapacityStatus) => {
  return status === "normal" ? CircleCheck : TriangleAlert;
};

/**
 * CapacityStatusIndicator
 *
 * Displays a colored badge showing environment capacity status.
 * Use this component in environment selectors, cards, and lists to
 * provide quick visual feedback about capacity.
 *
 * @example
 * ```tsx
 * <CapacityStatusIndicator
 *   status="warning"
 *   utilizationPercent={85}
 *   size="sm"
 * />
 * ```
 */
export const CapacityStatusIndicator: React.FC<CapacityStatusIndicatorProps> = ({
  status,
  utilizationPercent,
  size = "md",
  "data-testid": dataTestId,
}) => {
  const colorScheme = getColorScheme(status);
  const label = getStatusLabel(status);
  const StatusIcon = getStatusIcon(status);

  return (
    <Badge
      colorScheme={colorScheme}
      variant="subtle"
      px={2}
      py={1}
      borderRadius="md"
      fontSize={size === "sm" ? "xs" : "sm"}
      fontWeight="medium"
      data-testid={dataTestId}
      aria-label={`Capacity status: ${label}${utilizationPercent ? ` at ${utilizationPercent}%` : ""}`}
      role="status"
      display="inline-flex"
      alignItems="center"
      gap={1}
    >
      <StatusIcon size={size === "sm" ? 12 : 14} />
      <HStack gap={1}>
        <Text as="span">{label}</Text>
        {utilizationPercent !== null && utilizationPercent !== undefined && (
          <Text as="span" fontWeight="bold">
            ({utilizationPercent}%)
          </Text>
        )}
      </HStack>
    </Badge>
  );
};
