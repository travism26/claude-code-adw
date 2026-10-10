"use client";

/**
 * Analysis Result Component
 *
 * Displays AI analysis results including overall score, summary,
 * and prioritized suggestions. Shows suggestion details with
 * badges for priority and category.
 */

import type React from "react";
import {
  Box,
  Flex,
  Text,
  Badge,
  VStack,
  HStack,
  Card,
  Progress,
} from "@chakra-ui/react";
import { CircleCheck, AlertTriangle, Info, TrendingUp } from "lucide-react";
import type { GrowAnalysis, SuggestionPriority } from "../../types";

interface AnalysisResultProps {
  /** Analysis result to display */
  analysis: GrowAnalysis;
}

/**
 * Gets color palette for priority badges
 */
function getPriorityColor(priority: SuggestionPriority): string {
  const colors: Record<SuggestionPriority, string> = {
    high: "red",
    medium: "orange",
    low: "gray",
  };
  return colors[priority];
}

/**
 * Gets icon for priority level
 */
function getPriorityIcon(priority: SuggestionPriority) {
  const icons: Record<SuggestionPriority, React.ReactNode> = {
    high: <AlertTriangle size={16} />,
    medium: <Info size={16} />,
    low: <CircleCheck size={16} />,
  };
  return icons[priority];
}

/**
 * Gets color for overall score
 */
function getScoreColor(score: number): string {
  if (score >= 80) return "green";
  if (score >= 60) return "yellow";
  if (score >= 40) return "orange";
  return "red";
}

/**
 * Formats date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Analysis Result Component
 * Renders the analysis result with score, summary, and suggestions
 */
export const AnalysisResult: React.FC<AnalysisResultProps> = ({ analysis }) => {
  const scoreColor = getScoreColor(analysis.overall_score);

  return (
    <Box data-testid="analysis-result">
      {/* Overall Score Section */}
      <Card.Root mb={4}>
        <Card.Body>
          <Flex justify="space-between" align="center" mb={2}>
            <Text fontSize="sm" color="gray.600">
              Overall Health Score
            </Text>
            <Text fontSize="sm" color="gray.500">
              {formatDate(analysis.analyzed_at)}
            </Text>
          </Flex>
          <Flex align="center" gap={4}>
            <Box flex="1">
              <Progress.Root
                value={analysis.overall_score}
                colorPalette={scoreColor}
                size="lg"
              >
                <Progress.Track>
                  <Progress.Range />
                </Progress.Track>
              </Progress.Root>
            </Box>
            <Text fontSize="2xl" fontWeight="bold" color={`${scoreColor}.600`}>
              {analysis.overall_score}/100
            </Text>
          </Flex>
        </Card.Body>
      </Card.Root>

      {/* Summary Section */}
      {analysis.summary && (
        <Card.Root mb={4}>
          <Card.Header>
            <Flex align="center" gap={2}>
              <TrendingUp size={20} />
              <Text fontWeight="semibold">Analysis Summary</Text>
            </Flex>
          </Card.Header>
          <Card.Body>
            <Text color="gray.700">{analysis.summary}</Text>
          </Card.Body>
        </Card.Root>
      )}

      {/* Suggestions Section */}
      {analysis.suggestions && analysis.suggestions.length > 0 ? (
        <VStack gap={3} align="stretch" data-testid="suggestions-list">
          <Text fontWeight="semibold" fontSize="md" mb={1}>
            Suggestions ({analysis.suggestions.length})
          </Text>
          {analysis.suggestions.map((suggestion, index) => (
            <Card.Root
              key={index}
              borderLeft="4px solid"
              borderLeftColor={`${getPriorityColor(suggestion.priority)}.400`}
              data-testid={`suggestion-${index}`}
            >
              <Card.Body>
                <VStack align="stretch" gap={2}>
                  {/* Suggestion Header */}
                  <Flex justify="space-between" align="start" gap={2}>
                    <HStack gap={2} flex="1">
                      <Box>{getPriorityIcon(suggestion.priority)}</Box>
                      <Text fontWeight="semibold" fontSize="md">
                        {suggestion.title}
                      </Text>
                    </HStack>
                    <HStack gap={2}>
                      <Badge
                        colorPalette={getPriorityColor(suggestion.priority)}
                        size="sm"
                        data-testid={`priority-badge-${index}`}
                      >
                        {suggestion.priority}
                      </Badge>
                      {suggestion.category && (
                        <Badge colorPalette="blue" size="sm" variant="subtle">
                          {suggestion.category}
                        </Badge>
                      )}
                      {suggestion.actionable && (
                        <Badge colorPalette="green" size="sm" variant="outline">
                          Actionable
                        </Badge>
                      )}
                    </HStack>
                  </Flex>

                  {/* Suggestion Description */}
                  <Text color="gray.700" fontSize="sm">
                    {suggestion.description}
                  </Text>

                  {/* Suggestion Type */}
                  {suggestion.type && (
                    <Text fontSize="xs" color="gray.500">
                      Type: {suggestion.type}
                    </Text>
                  )}
                </VStack>
              </Card.Body>
            </Card.Root>
          ))}
        </VStack>
      ) : (
        <Card.Root>
          <Card.Body>
            <Text color="gray.500" textAlign="center">
              No suggestions available for this analysis.
            </Text>
          </Card.Body>
        </Card.Root>
      )}
    </Box>
  );
};
