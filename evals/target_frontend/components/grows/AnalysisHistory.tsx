"use client";

/**
 * Analysis History Component
 *
 * Displays historical analysis results for a grow.
 * Shows list of past analyses with expandable details.
 * Supports filtering by analysis type and sorting.
 */

import type React from "react";
import { useState } from "react";
import {
  Box,
  Flex,
  Text,
  Badge,
  VStack,
  Spinner,
  Button,
  AccordionRoot,
  AccordionItem,
  AccordionItemTrigger,
  AccordionItemContent,
  createListCollection,
} from "@chakra-ui/react";
import {
  SelectRoot,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValueText,
} from "@chakra-ui/react";
import { Calendar, Filter } from "lucide-react";
import { useAnalysisHistory } from "../../hooks/useGrowAI";
import { AnalysisResult } from "./AnalysisResult";
import type { AnalysisType } from "../../types";

interface AnalysisHistoryProps {
  /** Grow ID to fetch history for */
  growId: string;
}

/**
 * Analysis type filter options
 */
const FILTER_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "general", label: "General Analysis" },
  { value: "nutrients", label: "Nutrient Analysis" },
  { value: "diagnosis", label: "Diagnosis" },
  { value: "optimization", label: "Optimization" },
  { value: "harvest_timing", label: "Harvest Timing" },
];

const filterCollection = createListCollection({
  items: FILTER_OPTIONS,
});

/**
 * Formats date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Gets color for overall score badge
 */
function getScoreColor(score: number): string {
  if (score >= 80) return "green";
  if (score >= 60) return "yellow";
  if (score >= 40) return "orange";
  return "red";
}

/**
 * Analysis History Component
 */
export const AnalysisHistory: React.FC<AnalysisHistoryProps> = ({ growId }) => {
  const [selectedFilter, setSelectedFilter] = useState<string>("all");

  const filters =
    selectedFilter !== "all"
      ? { analysisType: selectedFilter as AnalysisType }
      : undefined;

  const { data, isLoading, error } = useAnalysisHistory(growId, filters);

  // Loading state
  if (isLoading) {
    return (
      <Flex justify="center" align="center" minH="200px" data-testid="analysis-history-loading">
        <VStack gap={3}>
          <Spinner size="lg" colorPalette="green" />
          <Text color="gray.500">Loading analysis history...</Text>
        </VStack>
      </Flex>
    );
  }

  // Error state
  if (error) {
    return (
      <Box
        p={6}
        borderWidth="1px"
        borderColor="red.200"
        bg="red.50"
        borderRadius="md"
        data-testid="analysis-history-error"
      >
        <Text color="red.700" fontWeight="semibold" mb={2}>
          Error Loading History
        </Text>
        <Text color="red.600" fontSize="sm">
          {error.message || "Failed to load analysis history. Please try again."}
        </Text>
      </Box>
    );
  }

  // Empty state
  if (!data?.analyses || data.analyses.length === 0) {
    return (
      <Box
        p={8}
        textAlign="center"
        borderWidth="1px"
        borderColor="gray.200"
        borderRadius="md"
        bg="gray.50"
        data-testid="analysis-history-empty"
      >
        <VStack gap={3}>
          <Calendar size={48} color="gray" />
          <Text fontWeight="semibold" fontSize="lg" color="gray.700">
            No Analysis History
          </Text>
          <Text color="gray.500" fontSize="sm">
            Request your first analysis to see results here.
          </Text>
        </VStack>
      </Box>
    );
  }

  return (
    <Box data-testid="analysis-history">
      {/* Filter Controls */}
      <Flex justify="space-between" align="center" mb={4}>
        <Text fontWeight="semibold" fontSize="md">
          Analysis History ({data.total})
        </Text>
        <SelectRoot
          collection={filterCollection}
          value={[selectedFilter]}
          onValueChange={(e) => setSelectedFilter(e.value[0] as string)}
          size="sm"
          width="200px"
        >
          <SelectTrigger data-testid="analysis-type-filter">
            <Filter size={16} />
            <SelectValueText placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            {FILTER_OPTIONS.map((option) => (
              <SelectItem key={option.value} item={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </SelectRoot>
      </Flex>

      {/* Analysis List */}
      <AccordionRoot collapsible data-testid="analysis-accordion">
        {data.analyses.map((analysis, index) => {
          const scoreColor = getScoreColor(analysis.overall_score);

          return (
            <AccordionItem
              key={analysis.id}
              value={analysis.id}
              data-testid={`analysis-item-${index}`}
            >
              <AccordionItemTrigger>
                <Flex
                  justify="space-between"
                  align="center"
                  width="100%"
                  pr={4}
                >
                  <VStack align="start" gap={1} flex="1">
                    <Flex align="center" gap={2}>
                      <Calendar size={16} />
                      <Text fontWeight="medium">
                        {formatDate(analysis.analyzed_at)}
                      </Text>
                    </Flex>
                    {analysis.summary && (
                      <Text fontSize="sm" color="gray.600" lineClamp={1}>
                        {analysis.summary}
                      </Text>
                    )}
                  </VStack>
                  <Flex align="center" gap={2}>
                    <Badge
                      colorPalette={scoreColor}
                      size="lg"
                      data-testid={`score-badge-${index}`}
                    >
                      {analysis.overall_score}/100
                    </Badge>
                    {analysis.is_current && (
                      <Badge colorPalette="blue" size="sm">
                        Current
                      </Badge>
                    )}
                  </Flex>
                </Flex>
              </AccordionItemTrigger>
              <AccordionItemContent>
                <Box pt={2}>
                  <AnalysisResult analysis={analysis} />
                </Box>
              </AccordionItemContent>
            </AccordionItem>
          );
        })}
      </AccordionRoot>

      {/* Load More (if needed) */}
      {data.total > data.analyses.length && (
        <Flex justify="center" mt={4}>
          <Button variant="outline" size="sm">
            Load More
          </Button>
        </Flex>
      )}
    </Box>
  );
};
