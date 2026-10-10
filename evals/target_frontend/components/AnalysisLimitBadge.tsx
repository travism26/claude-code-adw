"use client";

/**
 * AnalysisLimitBadge Component
 *
 * Displays the number of remaining AI analyses for the day.
 * Color coded based on remaining count: green (3+), yellow (1-2), red (0)
 */

import React from "react";
import { Badge, Skeleton } from "@chakra-ui/react";

interface AnalysisLimitBadgeProps {
  /** Number of analyses remaining */
  remaining: number;
  /** Total analyses available (default limit + bonus) */
  total: number;
  /** Loading state */
  isLoading?: boolean;
}

export const AnalysisLimitBadge: React.FC<AnalysisLimitBadgeProps> = ({
  remaining,
  total,
  isLoading = false,
}) => {
  // Show loading skeleton while data is being fetched
  if (isLoading) {
    return <Skeleton height="24px" width="120px" />;
  }

  // Determine badge color based on remaining count
  const getColorScheme = (): "green" | "yellow" | "red" => {
    if (remaining >= 3) return "green";
    if (remaining >= 1) return "yellow";
    return "red";
  };

  return (
    <Badge
      colorScheme={getColorScheme()}
      fontSize="sm"
      px={3}
      py={1}
      borderRadius="md"
      data-testid="analysis-limit-badge"
    >
      {remaining}/{total} analyses remaining
    </Badge>
  );
};
