"use client";

import type React from "react";
import { useMemo } from "react";
import {
  Box,
  VStack,
  HStack,
  Flex,
  Text,
  Button,
  Separator,
} from "@chakra-ui/react";
import { Copy, Leaf, MapPin } from "lucide-react";
import type { LayoutOption } from "../../types";
import { toaster } from "../ChakraProvider";

interface PlantListPanelProps {
  layoutOption: LayoutOption;
}

interface AggregatedPlant {
  plantProfileId: string;
  plantName: string;
  totalQuantity: number;
  locations: string[];
  blockCount: number;
  spacing?: string;
}

export const PlantListPanel: React.FC<PlantListPanelProps> = ({
  layoutOption,
}) => {

  // Aggregate plant placements by plant profile ID
  const aggregatedPlants = useMemo(() => {
    const plantMap = new Map<string, AggregatedPlant>();

    layoutOption.placements.forEach((placement) => {
      const existing = plantMap.get(placement.plantProfileId);
      const locationLabel = `(${Math.round(placement.x)}, ${Math.round(placement.y)})`;

      // Use plantCount if available, otherwise fall back to quantity
      const plantCount = placement.plantCount || placement.quantity;

      if (existing) {
        existing.totalQuantity += plantCount;
        existing.locations.push(locationLabel);
        existing.blockCount++;
      } else {
        plantMap.set(placement.plantProfileId, {
          plantProfileId: placement.plantProfileId,
          plantName: placement.plantName,
          totalQuantity: plantCount,
          locations: [locationLabel],
          blockCount: 1,
          spacing: placement.reasoning.match(/(\d+(?:\.\d+)?)\s*(?:ft|feet)/i)?.[1]
            ? `${placement.reasoning.match(/(\d+(?:\.\d+)?)\s*(?:ft|feet)/i)?.[1]}ft apart`
            : placement.reasoning.match(/(\d+)\s*(?:inches|")/)?.[1]
            ? `${placement.reasoning.match(/(\d+)\s*(?:inches|")/)?.[1]}" apart`
            : undefined,
        });
      }
    });

    return Array.from(plantMap.values());
  }, [layoutOption.placements]);

  const totalPlants = useMemo(() => {
    return aggregatedPlants.reduce(
      (sum, plant) => sum + plant.totalQuantity,
      0
    );
  }, [aggregatedPlants]);

  const copyToClipboard = async () => {
    const listText = [
      "PLANT SHOPPING LIST",
      "===================",
      "",
      ...aggregatedPlants.map(
        (plant) =>
          `${plant.plantName}\n` +
          `  Quantity: ${plant.totalQuantity}\n` +
          `  Locations: ${plant.locations.join(", ")}\n` +
          (plant.spacing ? `  Spacing: ${plant.spacing}\n` : "")
      ),
      "",
      `Total Plants: ${totalPlants}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(listText);
      toaster.create({
        title: "Plant list copied!",
        description: "The shopping list has been copied to your clipboard.",
        type: "success",
        duration: 3000,
      });
    } catch (error) {
      toaster.create({
        title: "Failed to copy",
        description: "Could not copy to clipboard. Please try again.",
        type: "error",
        duration: 3000,
      });
    }
  };

  if (aggregatedPlants.length === 0) {
    return (
      <Box textAlign="center" py={6} color="gray.500">
        <Text>No plants in this layout</Text>
      </Box>
    );
  }

  return (
    <VStack
      gap={3}
      align="stretch"
      data-testid="plant-list-panel"
      bg="gray.50"
      p={4}
      borderRadius="md"
    >
      {/* Header */}
      <Flex align="center" justify="space-between">
        <Text fontSize="md" fontWeight="semibold" color="gray.700">
          Plant Shopping List
        </Text>
        <Button
          size="sm"
          variant="outline"
          onClick={copyToClipboard}
          data-testid="copy-list-button"
        >
          <Box as={Copy} boxSize="4" mr={1} />
          Copy
        </Button>
      </Flex>

      <Separator />

      {/* Plant List */}
      <VStack gap={3} align="stretch">
        {aggregatedPlants.map((plant) => (
          <Box
            key={plant.plantProfileId}
            bg="white"
            p={3}
            borderRadius="md"
            border="1px"
            borderColor="gray.200"
            data-testid={`plant-list-item-${plant.plantProfileId}`}
          >
            <VStack gap={2} align="stretch">
              {/* Plant Name and Quantity */}
              <Flex align="center" justify="space-between">
                <HStack gap={2}>
                  <Box as={Leaf} boxSize="4" color="green.500" />
                  <Text fontWeight="semibold" fontSize="sm">
                    {plant.plantName}
                  </Text>
                </HStack>
                <Text
                  fontSize="sm"
                  fontWeight="bold"
                  color="green.600"
                  bg="green.50"
                  px={2}
                  py={1}
                  borderRadius="md"
                  data-testid={`plant-list-${plant.plantProfileId}-count`}
                >
                  {plant.totalQuantity} plant{plant.totalQuantity !== 1 ? "s" : ""}
                </Text>
              </Flex>

              {/* Block count and locations */}
              <VStack gap={1} align="stretch">
                {plant.blockCount > 1 && (
                  <Text fontSize="xs" color="gray.600" fontWeight="medium">
                    Across {plant.blockCount} blocks
                  </Text>
                )}
                <HStack gap={2} fontSize="xs" color="gray.600">
                  <Box as={MapPin} boxSize="3" />
                  <Text>
                    {plant.locations.length > 3
                      ? `${plant.locations.slice(0, 3).join(", ")}...`
                      : plant.locations.join(", ")}
                  </Text>
                </HStack>
              </VStack>

              {/* Spacing Instructions */}
              {plant.spacing && (
                <Text fontSize="xs" color="gray.600">
                  Space {plant.spacing}
                </Text>
              )}
            </VStack>
          </Box>
        ))}
      </VStack>

      <Separator />

      {/* Total Count */}
      <Flex align="center" justify="space-between" data-testid="total-plants-count">
        <Text fontSize="sm" fontWeight="medium" color="gray.700">
          Total Plants
        </Text>
        <Text fontSize="md" fontWeight="bold" color="green.600">
          {totalPlants}
        </Text>
      </Flex>
    </VStack>
  );
};
