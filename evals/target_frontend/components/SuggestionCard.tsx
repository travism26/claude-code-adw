"use client";

/**
 * Suggestion Card Component
 *
 * Displays an individual AI-generated garden suggestion with details,
 * category, priority, and affected plots.
 */

import type React from "react";
import { useState } from "react";
import {
  Card,
  Flex,
  Text,
  Badge,
  Button,
  Box,
  HStack,
  VStack,
} from "@chakra-ui/react";
import {
  Lightbulb,
  TrendingUp,
  AlertTriangle,
  Eye,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { Suggestion } from "../types";

interface SuggestionCardProps {
  /** The suggestion to display */
  suggestion: Suggestion;
  /** Callback when user wants to highlight affected plots on canvas */
  onHighlight?: (plotIds: string[]) => void;
}

/**
 * Gets visual indicators based on suggestion type
 */
function getSuggestionTypeConfig(type: Suggestion["type"]) {
  switch (type) {
    case "optimization":
      return {
        icon: TrendingUp,
        colorScheme: "blue",
        label: "Optimization",
      };
    case "improvement":
      return {
        icon: Lightbulb,
        colorScheme: "purple",
        label: "Improvement",
      };
    case "warning":
      return {
        icon: AlertTriangle,
        colorScheme: "orange",
        label: "Warning",
      };
  }
}

/**
 * Gets color scheme based on priority level
 */
function getPriorityColorScheme(priority: Suggestion["priority"]) {
  switch (priority) {
    case "high":
      return "red";
    case "medium":
      return "orange";
    case "low":
      return "blue";
  }
}

/**
 * Formats category name for display
 */
function formatCategory(category: Suggestion["category"]): string {
  return category
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export const SuggestionCard: React.FC<SuggestionCardProps> = ({
  suggestion,
  onHighlight,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const typeConfig = getSuggestionTypeConfig(suggestion.type);
  const TypeIcon = typeConfig.icon;
  const priorityColor = getPriorityColorScheme(suggestion.priority);

  // Determine if description is long enough to need expansion
  const needsExpansion = suggestion.description.length > 150;
  const displayDescription =
    needsExpansion && !isExpanded
      ? `${suggestion.description.slice(0, 150)}...`
      : suggestion.description;

  return (
    <Card.Root
      data-testid="suggestion-card"
      borderWidth="1px"
      borderColor="gray.200"
      _hover={{ borderColor: "gray.300", shadow: "sm" }}
      transition="all 0.2s"
    >
      <Card.Body>
        <VStack align="stretch" gap={3}>
          {/* Header: Title and Badges */}
          <Flex justify="space-between" align="flex-start" gap={2}>
            <Flex align="center" gap={2} flex="1">
              <TypeIcon size={20} />
              <Text fontWeight="semibold" fontSize="md">
                {suggestion.title}
              </Text>
            </Flex>
            <HStack gap={1.5}>
              <Badge
                colorPalette={typeConfig.colorScheme}
                variant="subtle"
                fontSize="xs"
                data-testid="suggestion-type-badge"
              >
                {typeConfig.label}
              </Badge>
              <Badge
                colorPalette={priorityColor}
                variant="solid"
                fontSize="xs"
                data-testid="suggestion-priority-badge"
              >
                {suggestion.priority.toUpperCase()}
              </Badge>
            </HStack>
          </Flex>

          {/* Category */}
          <Flex align="center" gap={1.5}>
            <Text fontSize="sm" color="gray.600" fontWeight="medium">
              Category:
            </Text>
            <Badge colorPalette="gray" variant="outline" fontSize="xs">
              {formatCategory(suggestion.category)}
            </Badge>
          </Flex>

          {/* Description */}
          <Text fontSize="sm" color="gray.700" lineHeight="tall">
            {displayDescription}
          </Text>

          {/* Expand/Collapse Button */}
          {needsExpansion && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              alignSelf="flex-start"
              data-testid="suggestion-expand-button"
            >
              {isExpanded ? (
                <>
                  <ChevronUp size={16} />
                  <Text ml={1}>Show Less</Text>
                </>
              ) : (
                <>
                  <ChevronDown size={16} />
                  <Text ml={1}>Read More</Text>
                </>
              )}
            </Button>
          )}

          {/* Affected Plots */}
          {suggestion.affectedIds?.length > 0 && (
            <Box
              bg="gray.50"
              p={2.5}
              borderRadius="md"
              borderWidth="1px"
              borderColor="gray.200"
            >
              <Flex justify="space-between" align="center" gap={2}>
                <Box>
                  <Text fontSize="xs" fontWeight="semibold" color="gray.600" mb={1}>
                    Affected Plots ({suggestion.affectedIds?.length ?? 0})
                  </Text>
                  <Text fontSize="xs" color="gray.600" truncate maxW="300px">
                    {suggestion.affectedIds?.slice(0, 3).join(", ")}
                    {(suggestion.affectedIds?.length ?? 0) > 3 &&
                      ` +${(suggestion.affectedIds?.length ?? 0) - 3} more`}
                  </Text>
                </Box>
                {onHighlight && suggestion.actionable && suggestion.affectedIds && (
                  <Button
                    size="sm"
                    variant="outline"
                    colorPalette="blue"
                    onClick={() => onHighlight(suggestion.affectedIds!)}
                    data-testid="view-on-canvas-button"
                  >
                    <Eye size={16} />
                    <Text ml={1.5}>View on Canvas</Text>
                  </Button>
                )}
              </Flex>
            </Box>
          )}

          {/* Non-actionable indicator */}
          {!suggestion.actionable && (
            <Text fontSize="xs" color="gray.500" fontStyle="italic">
              Note: This is informational and does not require action.
            </Text>
          )}
        </VStack>
      </Card.Body>
    </Card.Root>
  );
};
