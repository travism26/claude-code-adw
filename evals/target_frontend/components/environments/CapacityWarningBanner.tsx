"use client";

/**
 * CapacityWarningBanner Component
 *
 * Dismissible alert banner for displaying capacity warnings.
 * Shows warning/error status with icons, messages, and dismiss button.
 * Fully accessible with keyboard navigation and ARIA labels.
 * Responsive design for mobile and desktop.
 */

import { Alert, CloseButton, VStack, Box, Text } from "@chakra-ui/react";
import type { CapacityStatus } from "../../types/environmentOverview";

export interface CapacityWarningBannerProps {
  /**
   * Capacity status: 'warning' or 'over' (normal status shouldn't show banner)
   */
  status: CapacityStatus;

  /**
   * Array of warning messages to display
   */
  warnings: string[];

  /**
   * Callback when user dismisses the warning
   */
  onDismiss: () => void;

  /**
   * Optional data-testid for E2E testing
   */
  "data-testid"?: string;
}

/**
 * Get Chakra UI Alert status based on capacity status
 */
const getAlertStatus = (status: CapacityStatus): "warning" | "error" => {
  return status === "over" ? "error" : "warning";
};

/**
 * Get title text for the warning banner
 */
const getTitle = (status: CapacityStatus): string => {
  return status === "over"
    ? "Environment Over Capacity"
    : "Environment Approaching Capacity";
};

/**
 * CapacityWarningBanner
 *
 * Displays a dismissible warning banner when environment capacity is
 * approaching or exceeding limits. Includes clear messaging that the
 * warning is informational only and doesn't block actions.
 *
 * @example
 * ```tsx
 * {status !== 'normal' && (
 *   <CapacityWarningBanner
 *     status={status}
 *     warnings={warnings}
 *     onDismiss={() => setDismissed(true)}
 *   />
 * )}
 * ```
 */
export const CapacityWarningBanner: React.FC<CapacityWarningBannerProps> = ({
  status,
  warnings,
  onDismiss,
  "data-testid": dataTestId,
}) => {
  const alertStatus = getAlertStatus(status);
  const title = getTitle(status);

  return (
    <Alert.Root
      status={alertStatus}
      variant="subtle"
      borderRadius="md"
      py={4}
      px={4}
      data-testid={dataTestId}
      role="alert"
    >
      <Alert.Indicator />
      <Box flex={1}>
        <Alert.Title fontSize="md" fontWeight="bold" mb={2}>
          {title}
        </Alert.Title>
        <Alert.Description fontSize="sm">
          <VStack align="flex-start" gap={1.5}>
            {warnings.map((warning, index) => (
              <Text key={index}>{warning}</Text>
            ))}
            <Text fontStyle="italic" mt={1} color="gray.600">
              This is a warning only. You can still proceed with your action.
            </Text>
          </VStack>
        </Alert.Description>
      </Box>
      <CloseButton
        alignSelf="flex-start"
        position="absolute"
        right={2}
        top={2}
        onClick={onDismiss}
        aria-label="Dismiss capacity warning"
        data-testid={dataTestId ? `${dataTestId}-close` : undefined}
      />
    </Alert.Root>
  );
};
