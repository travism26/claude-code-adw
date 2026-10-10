"use client";

/**
 * Grow AI Panel Component
 *
 * Main AI analysis panel with tabbed interface for:
 * - Analysis: Request and view grow analysis
 * - Photo Analysis: Analyze photos for deficiencies
 * - Recommendations: Get nutrient recommendations
 * - History: View past analyses
 *
 * Includes WebSocket integration for real-time updates.
 */

import type React from "react";
import {
  Box,
  Flex,
  Text,
  Card,
  Tabs,
  Badge,
} from "@chakra-ui/react";
import { Sparkles, Camera, Leaf, History } from "lucide-react";
import { useAnalysisUsage, useGrowAnalysisWebSocket } from "../../hooks/useGrowAI";
import { RequestAnalysisButton } from "./RequestAnalysisButton";
import { PhotoAnalysisButton } from "./PhotoAnalysisButton";
import { NutrientRecommendationPanel } from "./NutrientRecommendationPanel";
import { AnalysisHistory } from "./AnalysisHistory";
import { toaster } from "../ChakraProvider";

interface GrowAIPanelProps {
  /** Grow ID to analyze */
  growId: string;
}

/**
 * Grow AI Panel Component
 */
export const GrowAIPanel: React.FC<GrowAIPanelProps> = ({ growId }) => {
  const { data: usage, isLoading: isLoadingUsage } = useAnalysisUsage();

  // Subscribe to WebSocket events for analysis completion
  useGrowAnalysisWebSocket(growId, (event) => {
    toaster.create({
      title: "Analysis Complete",
      description: `Overall score: ${event.overallScore}/100`,
      type: "success",
    });
  });

  const growAnalysesRemaining = usage?.growAnalysisRemaining ?? 0;
  const photoAnalysesRemaining = usage?.photoAnalysisRemaining ?? 0;

  return (
    <Box data-testid="grow-ai-panel">
      <Card.Root>
        <Card.Header>
          <Flex justify="space-between" align="center">
            <Flex align="center" gap={2}>
              <Sparkles size={24} />
              <Text fontSize="xl" fontWeight="bold">
                AI Analysis
              </Text>
            </Flex>
            {!isLoadingUsage && (
              <Flex gap={2}>
                <Badge colorPalette="green" size="sm">
                  {growAnalysesRemaining} grow analyses
                </Badge>
                <Badge colorPalette="blue" size="sm">
                  {photoAnalysesRemaining} photo analyses
                </Badge>
              </Flex>
            )}
          </Flex>
        </Card.Header>
        <Card.Body>
          <Tabs.Root defaultValue="analysis" colorPalette="green">
            <Tabs.List>
              <Tabs.Trigger value="analysis" data-testid="tab-analysis">
                <Sparkles size={16} />
                Analysis
              </Tabs.Trigger>
              <Tabs.Trigger value="photo" data-testid="tab-photo">
                <Camera size={16} />
                Photo Analysis
              </Tabs.Trigger>
              <Tabs.Trigger value="recommendations" data-testid="tab-recommendations">
                <Leaf size={16} />
                Recommendations
              </Tabs.Trigger>
              <Tabs.Trigger value="history" data-testid="tab-history">
                <History size={16} />
                History
              </Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="analysis" pt={4}>
              <RequestAnalysisButton growId={growId} />
            </Tabs.Content>

            <Tabs.Content value="photo" pt={4}>
              <PhotoAnalysisButton growId={growId} />
            </Tabs.Content>

            <Tabs.Content value="recommendations" pt={4}>
              <NutrientRecommendationPanel growId={growId} />
            </Tabs.Content>

            <Tabs.Content value="history" pt={4}>
              <AnalysisHistory growId={growId} />
            </Tabs.Content>
          </Tabs.Root>
        </Card.Body>
      </Card.Root>
    </Box>
  );
};
