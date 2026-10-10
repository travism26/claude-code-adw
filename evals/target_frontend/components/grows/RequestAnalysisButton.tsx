"use client";

/**
 * Request Analysis Button Component
 *
 * Button with dropdown menu for requesting different analysis types.
 * Shows remaining analysis quota and handles loading states.
 * Displays error/success toasts and respects rate limiting.
 */

import type React from "react";
import { useState } from "react";
import {
  Button,
  MenuRoot,
  MenuTrigger,
  MenuContent,
  MenuItem,
  Text,
  VStack,
  Textarea,
  Box,
} from "@chakra-ui/react";
import { Sparkles, ChevronDown } from "lucide-react";
import {
  useRequestGrowAnalysis,
  useAnalysisUsage,
  useCanAnalyze,
} from "../../hooks/useGrowAI";
import type { AnalysisType } from "../../types";
import { toaster } from "../ChakraProvider";

interface RequestAnalysisButtonProps {
  /** Grow ID to analyze */
  growId: string;
}

/**
 * Analysis type options with labels
 */
const ANALYSIS_TYPES: { value: AnalysisType; label: string; description: string }[] = [
  {
    value: "general",
    label: "General Analysis",
    description: "Overall health and progress assessment",
  },
  {
    value: "nutrients",
    label: "Nutrient Analysis",
    description: "Nutrient levels and feeding recommendations",
  },
  {
    value: "diagnosis",
    label: "Diagnosis",
    description: "Identify issues and deficiencies",
  },
  {
    value: "optimization",
    label: "Optimization",
    description: "Suggestions to improve yield and quality",
  },
  {
    value: "harvest_timing",
    label: "Harvest Timing",
    description: "Estimate optimal harvest window",
  },
];

/**
 * Request Analysis Button Component
 */
export const RequestAnalysisButton: React.FC<RequestAnalysisButtonProps> = ({
  growId,
}) => {
  const [selectedType, setSelectedType] = useState<AnalysisType | null>(null);
  const [context, setContext] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const requestMutation = useRequestGrowAnalysis();
  const { data: usage } = useAnalysisUsage();
  const { data: canAnalyzeData } = useCanAnalyze();

  const canAnalyze = canAnalyzeData?.canAnalyze ?? true;
  const remainingAnalyses = usage?.growAnalysisRemaining ?? 0;

  /**
   * Handle analysis request
   */
  const handleRequest = async (type: AnalysisType) => {
    try {
      await requestMutation.mutateAsync({
        growId,
        request: {
          type,
          context: context.trim() || undefined,
        },
      });

      toaster.create({
        title: "Analysis Requested",
        description: `${ANALYSIS_TYPES.find((t) => t.value === type)?.label} has been queued. You'll be notified when complete.`,
        type: "success",
      });

      // Reset state
      setContext("");
      setSelectedType(null);
      setIsMenuOpen(false);
    } catch (error) {
      toaster.create({
        title: "Analysis Failed",
        description:
          error instanceof Error ? error.message : "Failed to request analysis",
        type: "error",
      });
    }
  };

  /**
   * Handle type selection
   */
  const handleTypeSelect = (type: AnalysisType) => {
    setSelectedType(type);
    setIsMenuOpen(false);
  };

  return (
    <Box data-testid="request-analysis-button">
      <VStack align="stretch" gap={3}>
        {/* Analysis Type Selector */}
        <MenuRoot open={isMenuOpen} onOpenChange={(e) => setIsMenuOpen(e.open)}>
          <MenuTrigger asChild>
            <Button
              variant="outline"
              colorPalette="green"
              disabled={!canAnalyze || requestMutation.isPending}
              data-testid="analysis-type-selector"
            >
              <Sparkles size={16} />
              {selectedType
                ? ANALYSIS_TYPES.find((t) => t.value === selectedType)?.label
                : "Select Analysis Type"}
              <ChevronDown size={16} />
            </Button>
          </MenuTrigger>
          <MenuContent>
            {ANALYSIS_TYPES.map((type) => (
              <MenuItem
                key={type.value}
                value={type.value}
                onClick={() => handleTypeSelect(type.value)}
                data-testid={`analysis-type-${type.value}`}
              >
                <VStack align="start" gap={0}>
                  <Text fontWeight="medium">{type.label}</Text>
                  <Text fontSize="xs" color="gray.500">
                    {type.description}
                  </Text>
                </VStack>
              </MenuItem>
            ))}
          </MenuContent>
        </MenuRoot>

        {/* Context Input (shown when type selected) */}
        {selectedType && (
          <Textarea
            placeholder="Optional: Add context or specific questions..."
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={3}
            data-testid="analysis-context-input"
          />
        )}

        {/* Request Button */}
        {selectedType && (
          <Button
            onClick={() => handleRequest(selectedType)}
            loading={requestMutation.isPending}
            disabled={!canAnalyze || requestMutation.isPending}
            colorPalette="green"
            data-testid="submit-analysis-request"
          >
            {requestMutation.isPending ? "Analyzing..." : "Request Analysis"}
          </Button>
        )}

        {/* Usage Counter */}
        <Text fontSize="xs" color="gray.500" textAlign="center">
          {canAnalyze
            ? `${remainingAnalyses} analyses remaining today`
            : canAnalyzeData?.reason === "limit_reached"
              ? "Daily limit reached. Resets tomorrow."
              : canAnalyzeData?.reason === "analysis_pending"
                ? "Analysis in progress. Please wait."
                : "Analysis not available"}
        </Text>
      </VStack>
    </Box>
  );
};
