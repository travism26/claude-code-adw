"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Input,
  VStack,
  Text,
  HStack,
  Icon as ChakraIcon,
  Badge,
  Skeleton,
} from "@chakra-ui/react";
import { Search } from "lucide-react";

const DEFAULT_PLANT_ICON = "/plant-icons/default/generic-plant.svg";
import { usePlantProfiles } from "../hooks/usePlantProfiles";
import type { PlantProfile } from "../types";

interface PlantPaletteProps {
  onPlantSelect: (plantProfile: PlantProfile) => void;
  selectedZone?: number;
}

export const PlantPalette: React.FC<PlantPaletteProps> = ({
  onPlantSelect,
  selectedZone,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

  // Debounce the search term to avoid excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500); // Wait 500ms after user stops typing

    return () => {
      clearTimeout(timer);
    };
  }, [searchTerm]);

  const { data: response, isLoading } = usePlantProfiles({
    search: debouncedSearchTerm || undefined,
    zone: selectedZone,
    page: 1,
    limit: 50,
  });

  const plantProfiles = response?.plantProfiles || [];

  if (isLoading) {
    return (
      <VStack gap={2} align="stretch">
        <Skeleton height="60px" />
        <Skeleton height="60px" />
        <Skeleton height="60px" />
      </VStack>
    );
  }

  return (
    <VStack gap={4} align="stretch" h="full">
      <Box>
        <Text fontWeight="bold" mb={2}>
          Plant Palette
        </Text>
        <Box position="relative">
          <ChakraIcon
            as={Search}
            position="absolute"
            left={3}
            top="50%"
            transform="translateY(-50%)"
            color="gray.400"
            boxSize={4}
          />
          <Input
            placeholder="Search plants..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            pl={10}
            size="sm"
          />
        </Box>
      </Box>

      <VStack
        gap={2}
        align="stretch"
        overflowY="auto"
        flex={1}
        pr={2}
        css={{
          "&::-webkit-scrollbar": {
            width: "8px",
          },
          "&::-webkit-scrollbar-track": {
            background: "#f1f1f1",
          },
          "&::-webkit-scrollbar-thumb": {
            background: "#888",
            borderRadius: "4px",
          },
          "&::-webkit-scrollbar-thumb:hover": {
            background: "#555",
          },
        }}
      >
        {plantProfiles.length === 0 ? (
          <Text color="gray.500" textAlign="center" py={8}>
            No plants found
          </Text>
        ) : (
          plantProfiles.map((plant) => (
            <Box
              key={plant.id}
              p={3}
              rounded="md"
              borderWidth="1px"
              borderColor="gray.200"
              bg="white"
              cursor="pointer"
              _hover={{
                shadow: "md",
                borderColor: "green.400",
                bg: "green.50",
              }}
              transition="all 0.2s"
              onClick={() => onPlantSelect(plant)}
            >
              <HStack gap={2}>
                <img
                    src={plant.icon_url || DEFAULT_PLANT_ICON}
                    alt={plant.common_name || plant.name}
                    style={{
                      width: "18px",
                      height: "18px",
                      objectFit: "contain",
                    }}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (target.src !== DEFAULT_PLANT_ICON) {
                        target.src = DEFAULT_PLANT_ICON;
                      }
                    }}
                  />
                <VStack align="start" gap={0} flex={1}>
                  <Text fontWeight="medium" fontSize="sm">
                    {plant.common_name || plant.name}
                  </Text>
                  <HStack gap={1}>
                    <Badge colorScheme="green" fontSize="xs">
                      {plant.type}
                    </Badge>
                  </HStack>
                </VStack>
              </HStack>
            </Box>
          ))
        )}
      </VStack>

      <Text fontSize="xs" color="gray.500" textAlign="center">
        Click a plant to add it to your garden
      </Text>
    </VStack>
  );
};
