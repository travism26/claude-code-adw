"use client";

import type React from "react";
import { useState } from "react";
import {
  Box,
  VStack,
  HStack,
  Flex,
  Text,
  Button,
  Grid,
  Badge,
  Collapsible,
} from "@chakra-ui/react";
import { ChevronDown, ChevronUp, Check } from "lucide-react";
import { LayoutPreview } from "./LayoutPreview";
import { PlantListPanel } from "./PlantListPanel";
import type { LayoutOption, Garden } from "../../types";

interface LayoutOptionsProps {
  layouts: LayoutOption[];
  garden: Garden;
  onLayoutSelect: (layout: LayoutOption) => void;
}

export const LayoutOptions: React.FC<LayoutOptionsProps> = ({
  layouts,
  garden,
  onLayoutSelect,
}) => {
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);
  const [expandedPanelId, setExpandedPanelId] = useState<string | null>(null);

  const handleSelectLayout = (layout: LayoutOption) => {
    setSelectedLayoutId(layout.id);
    onLayoutSelect(layout);
  };

  const togglePlantList = (layoutId: string) => {
    setExpandedPanelId(expandedPanelId === layoutId ? null : layoutId);
  };

  if (layouts.length === 0) {
    return (
      <Box textAlign="center" py={12}>
        <Text color="gray.500" fontSize="lg">
          No layouts available
        </Text>
      </Box>
    );
  }

  // Calculate summary metrics for each layout
  const getLayoutMetrics = (layout: LayoutOption) => {
    const uniquePlants = new Set(
      layout.placements.map((p) => p.plantProfileId)
    ).size;
    const totalSqFt = layout.placements.reduce(
      (sum, p) => sum + p.width * p.height,
      0
    );
    return { uniquePlants, totalSqFt };
  };

  return (
    <VStack gap={4} align="stretch" data-testid="layout-options">
      <Text fontSize="lg" fontWeight="semibold" color="gray.700">
        Choose Your Layout ({layouts.length} options)
      </Text>

      <Grid
        templateColumns={{ base: "1fr", lg: "repeat(3, 1fr)" }}
        gap={4}
      >
        {layouts.map((layout) => {
          const metrics = getLayoutMetrics(layout);
          const isSelected = selectedLayoutId === layout.id;
          const isExpanded = expandedPanelId === layout.id;

          return (
            <VStack
              key={layout.id}
              gap={3}
              align="stretch"
              data-testid={`layout-option-${layout.id}`}
            >
              {/* Layout Preview */}
              <LayoutPreview
                layoutOption={layout}
                garden={garden}
                isSelected={isSelected}
                onSelect={() => handleSelectLayout(layout)}
              />

              {/* Comparison Metrics */}
              <VStack gap={2} align="stretch" px={2}>
                <HStack gap={4} fontSize="sm" color="gray.600" justify="center">
                  <Text>
                    <strong>{metrics.uniquePlants}</strong> plants
                  </Text>
                  <Text>•</Text>
                  <Text>
                    <strong>{Math.round(metrics.totalSqFt)}</strong> sq ft
                  </Text>
                  <Text>•</Text>
                  <Text>
                    <strong>{Math.round(layout.companionScore)}</strong>/100
                  </Text>
                </HStack>
              </VStack>

              {/* View Plant List Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => togglePlantList(layout.id)}
                data-testid={`view-plant-list-${layout.id}`}
              >
                <Box
                  as={isExpanded ? ChevronUp : ChevronDown}
                  boxSize="4"
                  mr={1}
                />
                {isExpanded ? "Hide" : "View"} Plant List
              </Button>

              {/* Expandable Plant List */}
              {isExpanded && <PlantListPanel layoutOption={layout} />}

              {/* Select This Layout Button */}
              <Button
                colorPalette="green"
                size="md"
                onClick={() => handleSelectLayout(layout)}
                disabled={isSelected}
                data-testid={`select-layout-${layout.id}`}
              >
                {isSelected ? (
                  <>
                    <Box as={Check} boxSize="4" mr={1} />
                    Selected
                  </>
                ) : (
                  "Select This Layout"
                )}
              </Button>
            </VStack>
          );
        })}
      </Grid>
    </VStack>
  );
};
