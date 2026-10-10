"use client";

/**
 * CapacityWarningSection Component
 *
 * Self-contained section that checks environment capacity and displays warnings.
 * Integrates useCapacityCheck hook with CapacityWarningBanner component.
 * Manages its own loading state and dismiss functionality.
 * Used in forms to show capacity warnings without blocking submission.
 */

import { useState } from "react";
import { Box, Skeleton } from "@chakra-ui/react";
import { useCapacityCheck } from "../../hooks/useCapacityCheck";
import { CapacityWarningBanner } from "../environments/CapacityWarningBanner";

export interface CapacityWarningSectionProps {
  /**
   * UUID of the environment to check capacity for
   */
  environmentId: string | null;

  /**
   * Number of plants to add (for capacity projection)
   */
  plantCount: number;

  /**
   * Optional data-testid for E2E testing
   */
  "data-testid"?: string;
}

/**
 * CapacityWarningSection
 *
 * Container component that handles capacity checking and warning display.
 * Use this in forms where users are adding plants to environments.
 * The component automatically checks capacity when environmentId or
 * plantCount changes, with debouncing to prevent excessive API calls.
 *
 * Warnings are dismissible and don't block form submission.
 *
 * @example
 * ```tsx
 * <CapacityWarningSection
 *   environmentId={selectedEnvironmentId}
 *   plantCount={formData.plantCount}
 * />
 * ```
 */
export const CapacityWarningSection: React.FC<CapacityWarningSectionProps> = ({
  environmentId,
  plantCount,
  "data-testid": dataTestId,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);

  // Use the capacity check hook with debouncing
  const { data: capacityResult, isLoading, error } = useCapacityCheck(environmentId, plantCount);

  // Don't show anything if query is disabled (no environment or no plants)
  if (!environmentId || plantCount <= 0) {
    return null;
  }

  // Show loading skeleton while checking capacity
  if (isLoading) {
    return (
      <Box data-testid={dataTestId ? `${dataTestId}-loading` : undefined}>
        <Skeleton height="60px" borderRadius="md" />
      </Box>
    );
  }

  // Silently handle errors - don't block the user
  if (error) {
    // Could log error to monitoring service here
    return null;
  }

  // No capacity data or normal status - don't show warning
  if (!capacityResult || capacityResult.status === "normal") {
    return null;
  }

  // User dismissed the warning - don't show it again until data changes
  if (isDismissed) {
    // Reset dismiss state when capacity data changes (user modified form)
    if (capacityResult) {
      setTimeout(() => setIsDismissed(false), 0);
    }
    return null;
  }

  // Show warning banner for warning or over status
  return (
    <Box mt={4} data-testid={dataTestId}>
      <CapacityWarningBanner
        status={capacityResult.status}
        warnings={capacityResult.warnings}
        onDismiss={() => setIsDismissed(true)}
        data-testid={dataTestId ? `${dataTestId}-banner` : undefined}
      />
    </Box>
  );
};
