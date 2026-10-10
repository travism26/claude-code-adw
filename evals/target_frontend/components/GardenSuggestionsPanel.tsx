"use client";

import type React from "react";
import { useState } from "react";
import {
  Box,
  Flex,
  Text,
  VStack,
  Button,
  Heading,
  Skeleton,
  Alert,
  AccordionItem,
  AccordionItemTrigger,
  AccordionItemContent,
  AccordionRoot,
  Spinner,
} from "@chakra-ui/react";
import { toaster } from "./ChakraProvider";
import { RefreshCw, ChevronDown } from "lucide-react";
import { useGardenAnalysis, useTriggerAnalysis } from "../hooks/useSuggestions";
import { useAnalysisUsageToday, useCanAnalyze, analysisUsageKeys } from "../hooks/useAnalysisUsage";
import { AnalysisLimitBadge } from "./AnalysisLimitBadge";
import { GardenHealthBadge } from "./GardenHealthBadge";
import { SuggestionCard } from "./SuggestionCard";
import type { Suggestion, AnalysisJobStatus } from "../types";
import { useQueryClient } from "@tanstack/react-query";

interface GardenSuggestionsPanelProps {
  gardenId: string;
  onPlotHighlight?: (plotIds: string[]) => void;
}

function groupSuggestionsByPriority(suggestions: Suggestion[]) {
  return {
    high: suggestions.filter((s) => s.priority === "high"),
    medium: suggestions.filter((s) => s.priority === "medium"),
    low: suggestions.filter((s) => s.priority === "low"),
  };
}

const LoadingSkeleton: React.FC = () => (
  <VStack align="stretch" gap={4}>
    <Skeleton height="60px" borderRadius="md" />
    <Skeleton height="40px" borderRadius="md" />
    <Skeleton height="150px" borderRadius="md" />
  </VStack>
);

export const GardenSuggestionsPanel: React.FC<GardenSuggestionsPanelProps> = ({
  gardenId,
  onPlotHighlight,
}) => {
  const queryClient = useQueryClient();
  const { data: analysis, isLoading, error, refetch } = useGardenAnalysis(gardenId);
  const { mutate: triggerAnalysis, isPending: isAnalyzing } = useTriggerAnalysis();
  const { data: usageStats, isLoading: isLoadingUsage } = useAnalysisUsageToday();
  const { data: canAnalyzeData, isLoading: isLoadingCanAnalyze } = useCanAnalyze(gardenId);
  const [jobStatus, setJobStatus] = useState<AnalysisJobStatus | null>(null);

  const handleRefreshAnalysis = () => {
    setJobStatus("pending");
    triggerAnalysis(gardenId, {
      onSuccess: (data) => {
        setJobStatus(data.status);
        toaster.create({
          title: "Analysis Started",
          description: `Garden analysis has been queued (Job ID: ${data.jobId})`,
          type: "success",
          duration: 5000,
        });
        queryClient.invalidateQueries({ queryKey: analysisUsageKeys.today() });
        queryClient.invalidateQueries({ queryKey: analysisUsageKeys.canAnalyze(gardenId) });
        setTimeout(() => {
          refetch();
          setJobStatus("completed");
        }, 3000);
      },
      onError: (error) => {
        setJobStatus("failed");
        const errorMessage = error.message || "Failed to trigger garden analysis. Please try again.";
        toaster.create({
          title: "Analysis Failed",
          description: errorMessage,
          type: "error",
          duration: 7000,
        });
      },
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <Box
        data-testid="suggestions-panel"
        p={6}
        bg="white"
        borderRadius="lg"
        borderWidth="1px"
        borderColor="gray.200"
      >
        <LoadingSkeleton />
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box
        data-testid="suggestions-panel"
        p={6}
        bg="white"
        borderRadius="lg"
        borderWidth="1px"
        borderColor="gray.200"
      >
        <Alert.Root status="error">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Unable to load suggestions</Alert.Title>
            <Alert.Description>
              {error.message || "Failed to analyze garden. Please try again."}
            </Alert.Description>
          </Alert.Content>
        </Alert.Root>
        <Flex mt={4} align="center" gap={3} flexWrap="wrap">
          {usageStats && (
            <AnalysisLimitBadge
              remaining={usageStats.remaining}
              total={usageStats.total}
              isLoading={isLoadingUsage}
            />
          )}
          <Button
            onClick={handleRefreshAnalysis}
            variant="outline"
            colorPalette="red"
            size="sm"
            loading={isAnalyzing}
            disabled={!canAnalyzeData?.canAnalyze || isAnalyzing}
            title={
              canAnalyzeData?.hasPending
                ? "Analysis in progress..."
                : !canAnalyzeData?.canAnalyze
                ? canAnalyzeData?.reason === "limit_reached"
                  ? "Daily limit reached (resets at midnight)"
                  : canAnalyzeData?.reason === "feature_disabled"
                  ? "AI analysis disabled"
                  : "Cannot analyze at this time"
                : ""
            }
          >
            <RefreshCw size={16} />
            <Text ml={2}>Analyze Garden</Text>
          </Button>
        </Flex>
      </Box>
    );
  }

  // No analysis available state (404 or no data)
  if (!analysis) {
    return (
      <Box
        data-testid="suggestions-panel"
        p={6}
        bg="white"
        borderRadius="lg"
        borderWidth="1px"
        borderColor="gray.200"
      >
        <VStack align="stretch" gap={4}>
          <Heading size="lg" color="gray.800">
            AI Garden Analysis
          </Heading>
          <Alert.Root status="info">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>No Analysis Available</Alert.Title>
              <Alert.Description>
                Click the &ldquo;Analyze Garden&rdquo; button to get AI-powered recommendations
              </Alert.Description>
            </Alert.Content>
          </Alert.Root>
          <Flex align="center" gap={3} flexWrap="wrap">
            {usageStats && (
              <AnalysisLimitBadge
                remaining={usageStats.remaining}
                total={usageStats.total}
                isLoading={isLoadingUsage}
              />
            )}
            <Button
              onClick={handleRefreshAnalysis}
              colorPalette="blue"
              size="md"
              data-testid="refresh-analysis-button"
              loading={isAnalyzing}
              disabled={!canAnalyzeData?.canAnalyze || isAnalyzing}
              title={
                canAnalyzeData?.hasPending
                  ? "Analysis in progress..."
                  : !canAnalyzeData?.canAnalyze
                  ? canAnalyzeData?.reason === "limit_reached"
                    ? "Daily limit reached (resets at midnight)"
                    : canAnalyzeData?.reason === "feature_disabled"
                    ? "AI analysis disabled"
                    : "Cannot analyze at this time"
                  : ""
              }
            >
              <RefreshCw size={16} />
              <Text ml={2}>Analyze Garden</Text>
            </Button>
          </Flex>
        </VStack>
      </Box>
    );
  }

  const groupedSuggestions = groupSuggestionsByPriority(analysis.suggestions);
  const hasSuggestions = analysis.suggestions.length > 0;

  return (
    <Box
      data-testid="suggestions-panel"
      p={6}
      bg="white"
      borderRadius="lg"
      borderWidth="1px"
      borderColor="gray.200"
      shadow="sm"
    >
      <VStack align="stretch" gap={4}>
        {/* Header: Title and Health Badge */}
        <Flex justify="space-between" align="center" flexWrap="wrap" gap={3}>
          <Heading size="lg" color="gray.800">
            AI Garden Analysis
          </Heading>
          <Flex align="center" gap={3} flexWrap="wrap">
            <GardenHealthBadge score={analysis.overallScore} size="md" />
            {usageStats && (
              <AnalysisLimitBadge
                remaining={usageStats.remaining}
                total={usageStats.total}
                isLoading={isLoadingUsage}
              />
            )}
            <Button
              onClick={handleRefreshAnalysis}
              variant="ghost"
              colorPalette="gray"
              size="sm"
              data-testid="refresh-analysis-button"
              loading={isAnalyzing}
              disabled={!canAnalyzeData?.canAnalyze || isAnalyzing}
              title={
                canAnalyzeData?.hasPending
                  ? "Analysis in progress..."
                  : !canAnalyzeData?.canAnalyze
                  ? canAnalyzeData?.reason === "limit_reached"
                    ? "Daily limit reached (resets at midnight)"
                    : canAnalyzeData?.reason === "feature_disabled"
                    ? "AI analysis disabled"
                    : "Cannot analyze at this time"
                  : ""
              }
            >
              {isAnalyzing ? <Spinner size="sm" /> : <RefreshCw size={16} />}
              <Text ml={1.5}>
                {isAnalyzing ? "Analyzing..." : jobStatus === "pending" ? "Pending..." : "Analyze Garden"}
              </Text>
            </Button>
          </Flex>
        </Flex>

        {/* Summary */}
        <Box
          p={4}
          bg="blue.50"
          borderRadius="md"
          borderWidth="1px"
          borderColor="blue.100"
        >
          <Text fontSize="sm" color="gray.700" lineHeight="tall">
            {analysis.summary}
          </Text>
        </Box>

        {/* Suggestions or Empty State */}
        {hasSuggestions ? (
          <AccordionRoot collapsible defaultValue={["high", "medium"]} multiple>
            {/* High Priority Suggestions */}
            {groupedSuggestions.high.length > 0 && (
              <AccordionItem value="high">
                <AccordionItemTrigger>
                  <Flex align="center" gap={2} flex="1">
                    <Text fontWeight="semibold" fontSize="md" color="red.700">
                      High Priority
                    </Text>
                    <Text fontSize="sm" color="gray.600">
                      ({groupedSuggestions.high.length})
                    </Text>
                  </Flex>
                  <ChevronDown />
                </AccordionItemTrigger>
                <AccordionItemContent>
                  <VStack align="stretch" gap={3} pt={2}>
                    {groupedSuggestions.high.map((suggestion, index) => (
                      <SuggestionCard
                        key={`high-${index}`}
                        suggestion={suggestion}
                        onHighlight={onPlotHighlight}
                      />
                    ))}
                  </VStack>
                </AccordionItemContent>
              </AccordionItem>
            )}

            {/* Medium Priority Suggestions */}
            {groupedSuggestions.medium.length > 0 && (
              <AccordionItem value="medium">
                <AccordionItemTrigger>
                  <Flex align="center" gap={2} flex="1">
                    <Text fontWeight="semibold" fontSize="md" color="orange.700">
                      Medium Priority
                    </Text>
                    <Text fontSize="sm" color="gray.600">
                      ({groupedSuggestions.medium.length})
                    </Text>
                  </Flex>
                  <ChevronDown />
                </AccordionItemTrigger>
                <AccordionItemContent>
                  <VStack align="stretch" gap={3} pt={2}>
                    {groupedSuggestions.medium.map((suggestion, index) => (
                      <SuggestionCard
                        key={`medium-${index}`}
                        suggestion={suggestion}
                        onHighlight={onPlotHighlight}
                      />
                    ))}
                  </VStack>
                </AccordionItemContent>
              </AccordionItem>
            )}

            {/* Low Priority Suggestions */}
            {groupedSuggestions.low.length > 0 && (
              <AccordionItem value="low">
                <AccordionItemTrigger>
                  <Flex align="center" gap={2} flex="1">
                    <Text fontWeight="semibold" fontSize="md" color="blue.700">
                      Low Priority
                    </Text>
                    <Text fontSize="sm" color="gray.600">
                      ({groupedSuggestions.low.length})
                    </Text>
                  </Flex>
                  <ChevronDown />
                </AccordionItemTrigger>
                <AccordionItemContent>
                  <VStack align="stretch" gap={3} pt={2}>
                    {groupedSuggestions.low.map((suggestion, index) => (
                      <SuggestionCard
                        key={`low-${index}`}
                        suggestion={suggestion}
                        onHighlight={onPlotHighlight}
                      />
                    ))}
                  </VStack>
                </AccordionItemContent>
              </AccordionItem>
            )}
          </AccordionRoot>
        ) : (
          <Box
            p={8}
            textAlign="center"
            bg="green.50"
            borderRadius="md"
            borderWidth="1px"
            borderColor="green.100"
          >
            <Text fontSize="lg" fontWeight="semibold" color="green.700" mb={2}>
              Your garden looks great!
            </Text>
            <Text fontSize="sm" color="gray.600">
              No suggestions at this time. Keep up the excellent work!
            </Text>
          </Box>
        )}
      </VStack>
    </Box>
  );
};