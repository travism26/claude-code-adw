"use client";

/**
 * Nutrient Recommendation Panel Component
 *
 * Panel for requesting AI-powered nutrient recommendations.
 * Supports different recommendation types and goals.
 * Displays results with feeding schedules and NPK ratios.
 */

import type React from "react";
import { useState } from "react";
import {
  Box,
  Flex,
  Text,
  Button,
  VStack,
  HStack,
  Card,
  Textarea,
  Badge,
  createListCollection,
} from "@chakra-ui/react";
import {
  SelectRoot,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValueText,
  RadioGroup,
} from "@chakra-ui/react";
import { Leaf, Sparkles } from "lucide-react";
import {
  useRequestGrowAnalysis,
  useAnalysisUsage,
  useNutrientRecommendationWebSocket,
} from "../../hooks/useGrowAI";
import type {
  NutrientRecommendationType,
  RecommendationGoal,
  AnalysisSuggestion,
} from "../../types";
import { toaster } from "../ChakraProvider";

interface NutrientRecommendationPanelProps {
  /** Grow ID to request recommendations for */
  growId: string;
}

/**
 * Recommendation type options
 */
const RECOMMENDATION_TYPES = [
  {
    value: "full_schedule",
    label: "Full Schedule",
    description: "Complete week-by-week feeding plan",
  },
  {
    value: "phase_adjustment",
    label: "Phase Adjustment",
    description: "Optimize nutrients for current growth phase",
  },
  {
    value: "deficiency_fix",
    label: "Deficiency Fix",
    description: "Address specific nutrient deficiencies",
  },
  {
    value: "optimization",
    label: "Optimization",
    description: "Fine-tune existing nutrient program",
  },
];

const recommendationTypeCollection = createListCollection({
  items: RECOMMENDATION_TYPES,
});

/**
 * Goal options
 */
const GOAL_OPTIONS: { value: RecommendationGoal; label: string }[] = [
  { value: "yield", label: "Maximize Yield" },
  { value: "quality", label: "Maximize Quality" },
  { value: "balanced", label: "Balanced" },
];

/**
 * Nutrient Recommendation Panel Component
 */
export const NutrientRecommendationPanel: React.FC<
  NutrientRecommendationPanelProps
> = ({ growId }) => {
  const [recommendationType, setRecommendationType] =
    useState<NutrientRecommendationType>("full_schedule");
  const [goal, setGoal] = useState<RecommendationGoal>("balanced");
  const [context, setContext] = useState("");
  const [deficiency, setDeficiency] = useState("");
  const [recommendations, setRecommendations] = useState<
    AnalysisSuggestion[] | null
  >(null);

  const requestMutation = useRequestGrowAnalysis();
  const { data: usage } = useAnalysisUsage();

  const remainingAnalyses = usage?.growAnalysisRemaining ?? 0;
  const canAnalyze = remainingAnalyses > 0;

  // Listen for nutrient recommendation completion
  useNutrientRecommendationWebSocket(growId, (event) => {
    if (event.recommendations) {
      setRecommendations(event.recommendations);

      toaster.create({
        title: "Nutrient Recommendations Ready",
        description: `${event.recommendations.length} recommendations generated`,
        type: "success",
      });
    }
  });

  /**
   * Handle recommendation request
   */
  const handleRequest = async () => {
    try {
      await requestMutation.mutateAsync({
        growId,
        request: {
          type: "nutrients",
          recommendationType,
          goal,
          context: context.trim() || undefined,
          deficiency:
            recommendationType === "deficiency_fix" && deficiency.trim()
              ? deficiency.trim()
              : undefined,
        },
      });

      toaster.create({
        title: "Recommendation Requested",
        description:
          "Generating nutrient recommendations. You'll be notified when complete.",
        type: "success",
      });

      // Clear recommendations to show loading state
      setRecommendations(null);
    } catch (error) {
      toaster.create({
        title: "Request Failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to request recommendations",
        type: "error",
      });
    }
  };

  return (
    <Box data-testid="nutrient-recommendation-panel">
      <VStack align="stretch" gap={4}>
        {/* Request Form */}
        <Card.Root>
          <Card.Header>
            <Flex align="center" gap={2}>
              <Leaf size={20} />
              <Text fontWeight="semibold">Request Nutrient Recommendations</Text>
            </Flex>
          </Card.Header>
          <Card.Body>
            <VStack align="stretch" gap={4}>
              {/* Recommendation Type */}
              <Box>
                <Text fontSize="sm" fontWeight="medium" mb={2}>
                  Recommendation Type
                </Text>
                <SelectRoot
                  collection={recommendationTypeCollection}
                  value={[recommendationType]}
                  onValueChange={(e) =>
                    setRecommendationType(
                      e.value[0] as NutrientRecommendationType
                    )
                  }
                >
                  <SelectTrigger data-testid="recommendation-type-selector">
                    <SelectValueText placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {RECOMMENDATION_TYPES.map((type) => (
                      <SelectItem key={type.value} item={type.value}>
                        <VStack align="start" gap={0}>
                          <Text fontWeight="medium">{type.label}</Text>
                          <Text fontSize="xs" color="gray.500">
                            {type.description}
                          </Text>
                        </VStack>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </SelectRoot>
              </Box>

              {/* Goal Selection */}
              <Box>
                <Text fontSize="sm" fontWeight="medium" mb={2}>
                  Goal
                </Text>
                <RadioGroup.Root
                  value={goal}
                  onValueChange={(e) => setGoal(e.value as RecommendationGoal)}
                  data-testid="goal-selector"
                >
                  <HStack gap={4}>
                    {GOAL_OPTIONS.map((option) => (
                      <RadioGroup.Item key={option.value} value={option.value}>
                        <RadioGroup.ItemControl />
                        <RadioGroup.ItemText>
                          {option.label}
                        </RadioGroup.ItemText>
                      </RadioGroup.Item>
                    ))}
                  </HStack>
                </RadioGroup.Root>
              </Box>

              {/* Deficiency Input (only for deficiency_fix type) */}
              {recommendationType === "deficiency_fix" && (
                <Box>
                  <Text fontSize="sm" fontWeight="medium" mb={2}>
                    Deficiency Description
                  </Text>
                  <Textarea
                    placeholder="Describe the deficiency symptoms (e.g., yellowing lower leaves, purple stems)..."
                    value={deficiency}
                    onChange={(e) => setDeficiency(e.target.value)}
                    rows={2}
                    data-testid="deficiency-input"
                  />
                </Box>
              )}

              {/* Additional Context */}
              <Box>
                <Text fontSize="sm" fontWeight="medium" mb={2}>
                  Additional Context (Optional)
                </Text>
                <Textarea
                  placeholder="Any additional information about your nutrient program or concerns..."
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  rows={3}
                  data-testid="recommendation-context-input"
                />
              </Box>

              {/* Request Button */}
              <Button
                onClick={handleRequest}
                loading={requestMutation.isPending}
                disabled={!canAnalyze || requestMutation.isPending}
                colorPalette="green"
                data-testid="submit-recommendation-request"
              >
                <Sparkles size={16} />
                {requestMutation.isPending
                  ? "Generating..."
                  : "Get Recommendations"}
              </Button>

              {/* Usage Counter */}
              <Text fontSize="xs" color="gray.500" textAlign="center">
                {canAnalyze
                  ? `${remainingAnalyses} analyses remaining today (shared with grow analysis)`
                  : "Daily analysis limit reached"}
              </Text>
            </VStack>
          </Card.Body>
        </Card.Root>

        {/* Results Display */}
        {recommendations && recommendations.length > 0 && (
          <Card.Root>
            <Card.Header>
              <Flex justify="space-between" align="center">
                <Text fontWeight="semibold">Recommendations</Text>
                <Badge colorPalette="green" size="sm">
                  {recommendations.length} suggestions
                </Badge>
              </Flex>
            </Card.Header>
            <Card.Body>
              <VStack align="stretch" gap={3}>
                {recommendations.map((rec, index) => (
                  <Box
                    key={index}
                    p={4}
                    borderWidth="1px"
                    borderColor="gray.200"
                    borderRadius="md"
                    data-testid={`recommendation-${index}`}
                  >
                    <VStack align="stretch" gap={2}>
                      <Flex justify="space-between" align="start">
                        <Text fontWeight="semibold" fontSize="md">
                          {rec.title}
                        </Text>
                        <HStack gap={2}>
                          <Badge
                            colorPalette={
                              rec.priority === "high"
                                ? "red"
                                : rec.priority === "medium"
                                  ? "orange"
                                  : "gray"
                            }
                            size="sm"
                          >
                            {rec.priority}
                          </Badge>
                          {rec.category && (
                            <Badge colorPalette="blue" size="sm" variant="subtle">
                              {rec.category}
                            </Badge>
                          )}
                        </HStack>
                      </Flex>
                      <Text fontSize="sm" color="gray.700">
                        {rec.description}
                      </Text>
                      {rec.type && (
                        <Text fontSize="xs" color="gray.500">
                          Type: {rec.type}
                        </Text>
                      )}
                    </VStack>
                  </Box>
                ))}
              </VStack>
            </Card.Body>
          </Card.Root>
        )}

        {/* Loading State */}
        {requestMutation.isPending && (
          <Card.Root>
            <Card.Body>
              <Text textAlign="center" color="gray.500">
                Generating nutrient recommendations...
              </Text>
            </Card.Body>
          </Card.Root>
        )}
      </VStack>
    </Box>
  );
};
