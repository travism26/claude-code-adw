"use client";

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
import { Trophy, AlertTriangle } from "lucide-react";
import type { LayoutOption, Garden } from "../../types";

interface LayoutPreviewProps {
  layoutOption: LayoutOption;
  garden: Garden;
  isSelected?: boolean;
  onSelect?: () => void;
}

export const LayoutPreview: React.FC<LayoutPreviewProps> = ({
  layoutOption,
  garden,
  isSelected = false,
  onSelect,
}) => {
  // Calculate scale to fit garden in preview
  const PREVIEW_WIDTH = 300;
  const PREVIEW_HEIGHT = 200;
  const scaleX = PREVIEW_WIDTH / garden.width;
  const scaleY = PREVIEW_HEIGHT / garden.height;
  const scale = Math.min(scaleX, scaleY);

  const scaledWidth = garden.width * scale;
  const scaledHeight = garden.height * scale;

  // Get optimization goal display name
  const getOptimizationLabel = (goal: string) => {
    switch (goal) {
      case "max_yield":
        return "Max Yield";
      case "max_variety":
        return "Max Variety";
      case "beginner_friendly":
        return "Beginner Friendly";
      default:
        return goal;
    }
  };

  // Get color for optimization goal
  const getGoalColor = (goal: string) => {
    switch (goal) {
      case "max_yield":
        return { bg: "green.500", color: "white" };
      case "max_variety":
        return { bg: "purple.500", color: "white" };
      case "beginner_friendly":
        return { bg: "blue.500", color: "white" };
      default:
        return { bg: "gray.500", color: "white" };
    }
  };

  // Get plant type color for visualization
  const getPlantColor = (index: number) => {
    const colors = [
      "green.400",
      "blue.400",
      "purple.400",
      "orange.400",
      "pink.400",
      "teal.400",
      "cyan.400",
      "yellow.400",
    ];
    return colors[index % colors.length];
  };

  const goalColor = getGoalColor(layoutOption.optimizationGoal);

  return (
    <Card.Root
      cursor={onSelect ? "pointer" : "default"}
      transition="all 0.2s"
      _hover={onSelect ? { shadow: "lg" } : {}}
      border={isSelected ? "2px" : "1px"}
      borderColor={isSelected ? "green.500" : "gray.200"}
      onClick={onSelect}
      data-testid="layout-preview"
      data-testid-id={`layout-preview-${layoutOption.id}`}
    >
      <Card.Body>
        <VStack gap={3} align="stretch">
          {/* Optimization Goal Badge */}
          <Flex align="center" justify="space-between">
            <Badge bg={goalColor.bg} color={goalColor.color} px={3} py={1}>
              <Flex align="center" gap={1}>
                <Box as={Trophy} boxSize="3" />
                {getOptimizationLabel(layoutOption.optimizationGoal)}
              </Flex>
            </Badge>
            {isSelected && (
              <Badge bg="green.500" color="white" px={2} py={1}>
                Selected
              </Badge>
            )}
          </Flex>

          {/* Garden Preview */}
          <Box
            position="relative"
            width={`${scaledWidth}px`}
            height={`${scaledHeight}px`}
            bg="green.50"
            border="2px"
            borderColor="green.200"
            borderRadius="md"
            overflow="hidden"
            mx="auto"
          >
            {/* Grid background */}
            <Box
              position="absolute"
              top={0}
              left={0}
              right={0}
              bottom={0}
              backgroundImage="linear-gradient(to right, rgba(0,128,0,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,128,0,0.1) 1px, transparent 1px)"
              backgroundSize={`${scale * 12}px ${scale * 12}px`}
            />

            {/* Plant placements */}
            {layoutOption.placements.map((placement, index) => (
              <Box
                key={`${placement.plantProfileId}-${index}`}
                position="absolute"
                left={`${placement.x * scale}px`}
                top={`${placement.y * scale}px`}
                width={`${placement.width * scale}px`}
                height={`${placement.height * scale}px`}
                bg={getPlantColor(index)}
                opacity={0.7}
                border="1px"
                borderColor="white"
                borderRadius="sm"
                display="flex"
                alignItems="center"
                justifyContent="center"
                fontSize="xs"
                fontWeight="bold"
                color="white"
                textAlign="center"
                p={1}
                title={`${placement.plantName} (${placement.quantity})`}
              >
                <Text fontSize="2xs" lineClamp={2}>
                  {placement.plantName.split(" ")[0]}
                </Text>
              </Box>
            ))}
          </Box>

          {/* Score Display */}
          <VStack gap={2} align="stretch" data-testid="layout-score">
            <Flex align="center" justify="space-between">
              <Text fontSize="sm" fontWeight="medium">
                Overall Score
              </Text>
              <Text fontSize="sm" fontWeight="bold" color="green.600">
                {Math.round(layoutOption.score)}/100
              </Text>
            </Flex>
            <Progress.Root
              value={layoutOption.score}
              max={100}
              size="sm"
              colorPalette="green"
            >
              <Progress.Track>
                <Progress.Range />
              </Progress.Track>
            </Progress.Root>

            {/* Sub-scores */}
            <HStack gap={2} fontSize="xs" color="gray.600">
              <Text>Companion: {Math.round(layoutOption.companionScore)}</Text>
              <Text>•</Text>
              <Text>Spacing: {Math.round(layoutOption.spacingScore)}</Text>
              <Text>•</Text>
              <Text>
                Accessibility: {Math.round(layoutOption.accessibilityScore)}
              </Text>
            </HStack>
          </VStack>

          {/* Warnings */}
          {layoutOption.warnings.length > 0 && (
            <Box
              bg="yellow.50"
              border="1px"
              borderColor="yellow.200"
              borderRadius="md"
              p={2}
              data-testid="layout-warnings"
            >
              <Flex align="flex-start" gap={2}>
                <Box
                  as={AlertTriangle}
                  boxSize="4"
                  color="yellow.600"
                  flexShrink={0}
                  mt={0.5}
                />
                <VStack gap={1} align="stretch" fontSize="xs">
                  {layoutOption.warnings.slice(0, 2).map((warning, index) => (
                    <Text key={index} color="yellow.800">
                      {warning}
                    </Text>
                  ))}
                  {layoutOption.warnings.length > 2 && (
                    <Text color="yellow.600" fontStyle="italic">
                      +{layoutOption.warnings.length - 2} more warnings
                    </Text>
                  )}
                </VStack>
              </Flex>
            </Box>
          )}
        </VStack>
      </Card.Body>
    </Card.Root>
  );
};
