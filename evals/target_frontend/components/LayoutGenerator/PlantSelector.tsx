"use client";

import type React from "react";
import { useState, useMemo, useEffect } from "react";
import {
  Box,
  VStack,
  HStack,
  Flex,
  Input,
  InputGroup,
  NativeSelectRoot,
  NativeSelectField,
  Button,
  Field,
  Text,
  Grid,
  Badge,
  Spinner,
  Alert,
  IconButton,
  Checkbox,
} from "@chakra-ui/react";
import { Search, Filter, X, Grid as GridIcon, List } from "lucide-react";
import { usePlantProfiles } from "../../hooks/usePlantProfiles";
import { PlantProfileCard } from "../PlantProfileCard";
import type { PlantProfile, PlantProfileFilters } from "../../types";

interface PlantSelectorProps {
  selectedPlantIds: string[];
  onSelectionChange: (plantIds: string[]) => void;
  userZone?: number;
}

export const PlantSelector: React.FC<PlantSelectorProps> = ({
  selectedPlantIds,
  onSelectionChange,
  userZone,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filters, setFilters] = useState<PlantProfileFilters>({
    zone: userZone,
  });

  // Debounce search query to avoid excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Pass search query to API instead of filtering client-side
  const apiFilters = useMemo(() => ({
    ...filters,
    search: debouncedSearchQuery || undefined,
    page: 1,
    limit: 50, // Match PlantPalette limit
  }), [filters, debouncedSearchQuery]);

  const { data: response, isLoading, error } = usePlantProfiles(apiFilters);

  const filteredProfiles = response?.plantProfiles || [];

  const handleFilterChange = (key: keyof PlantProfileFilters, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
    }));
  };

  const clearFilters = () => {
    setFilters({ zone: userZone });
    setSearchQuery("");
  };

  const togglePlantSelection = (plantId: string) => {
    if (selectedPlantIds.includes(plantId)) {
      onSelectionChange(selectedPlantIds.filter((id) => id !== plantId));
    } else {
      onSelectionChange([...selectedPlantIds, plantId]);
    }
  };

  const activeFilterCount = Object.values(filters).filter(
    (v) => v !== undefined && v !== ""
  ).length;

  return (
    <VStack gap={4} align="stretch" data-testid="plant-selector">
      <Flex gap={2}>
        <Box flex="1" position="relative">
          <InputGroup
            startElement={<Box as={Search} boxSize="4" color="gray.400" />}
          >
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search plants..."
              data-testid="search-input"
            />
          </InputGroup>
        </Box>
        <Button
          onClick={() => setShowFilters(!showFilters)}
          bg={showFilters ? "green.50" : "white"}
          borderColor={showFilters ? "green.500" : "gray.300"}
          color={showFilters ? "green.700" : "gray.700"}
          borderWidth="1px"
          _hover={{ bg: showFilters ? "green.100" : "gray.50" }}
        >
          <Box as={Filter} boxSize="4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge ml={2} bg="green.600" color="white">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
        {activeFilterCount > 0 && (
          <IconButton
            aria-label="Clear filters"
            onClick={clearFilters}
            color="gray.600"
            variant="ghost"
            _hover={{ color: "gray.900" }}
            title="Clear filters"
          >
            <Box as={X} boxSize="5" />
          </IconButton>
        )}
        <IconButton
          aria-label={viewMode === "grid" ? "List view" : "Grid view"}
          onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
          color="gray.600"
          variant="ghost"
          _hover={{ color: "gray.900" }}
          data-testid="view-toggle"
        >
          <Box as={viewMode === "grid" ? List : GridIcon} boxSize="5" />
        </IconButton>
      </Flex>

      {showFilters && (
        <Box
          bg="gray.50"
          border="1px"
          borderColor="gray.200"
          borderRadius="lg"
          p={4}
        >
          <Grid
            templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }}
            gap={3}
          >
            <Field.Root>
              <Field.Label
                fontSize="sm"
                fontWeight="medium"
                color="gray.700"
                mb={1}
              >
                Plant Type
              </Field.Label>
              <NativeSelectRoot fontSize="sm">
                <NativeSelectField
                  value={filters.type || ""}
                  onChange={(e) => handleFilterChange("type", e.target.value)}
                >
                  <option value="">All Types</option>
                  <option value="vegetable">Vegetable</option>
                  <option value="herb">Herb</option>
                  <option value="flower">Flower</option>
                  <option value="houseplant">Houseplant</option>
                  <option value="fruit">Fruit</option>
                  <option value="tree">Tree</option>
                </NativeSelectField>
              </NativeSelectRoot>
            </Field.Root>

            <Field.Root>
              <Field.Label
                fontSize="sm"
                fontWeight="medium"
                color="gray.700"
                mb={1}
              >
                Difficulty
              </Field.Label>
              <NativeSelectRoot fontSize="sm">
                <NativeSelectField
                  value={filters.difficulty || ""}
                  onChange={(e) =>
                    handleFilterChange("difficulty", e.target.value)
                  }
                >
                  <option value="">All Levels</option>
                  <option value="easy">Easy</option>
                  <option value="moderate">Moderate</option>
                  <option value="challenging">Challenging</option>
                </NativeSelectField>
              </NativeSelectRoot>
            </Field.Root>

            <Field.Root>
              <Field.Label
                fontSize="sm"
                fontWeight="medium"
                color="gray.700"
                mb={1}
              >
                Sunlight
              </Field.Label>
              <NativeSelectRoot fontSize="sm">
                <NativeSelectField
                  value={
                    (filters as any).sunlight_requirements || ""
                  }
                  onChange={(e) =>
                    handleFilterChange(
                      "sunlight_requirements" as any,
                      e.target.value
                    )
                  }
                >
                  <option value="">All</option>
                  <option value="full_sun">Full Sun</option>
                  <option value="partial_sun">Partial Sun</option>
                  <option value="partial_shade">Partial Shade</option>
                  <option value="full_shade">Full Shade</option>
                </NativeSelectField>
              </NativeSelectRoot>
            </Field.Root>
          </Grid>
        </Box>
      )}

      {isLoading ? (
        <Flex align="center" justify="center" py={12}>
          <Spinner size="xl" color="gray.400" />
        </Flex>
      ) : error ? (
        <Alert.Root status="error" borderRadius="lg">
          <Alert.Indicator />
          <Alert.Title>
            Failed to load plant profiles. Please try again.
          </Alert.Title>
        </Alert.Root>
      ) : filteredProfiles.length === 0 ? (
        <Box textAlign="center" py={12}>
          <Text color="gray.500">No plants found matching your criteria.</Text>
          <Button
            onClick={clearFilters}
            mt={4}
            color="green.600"
            variant="plain"
            fontWeight="medium"
            _hover={{ color: "green.700" }}
          >
            Clear filters
          </Button>
        </Box>
      ) : (
        <>
          <Flex align="center" justify="space-between">
            <Text fontSize="sm" color="gray.600">
              Showing {filteredProfiles.length}{" "}
              {filteredProfiles.length === 1 ? "plant" : "plants"}
            </Text>
            <Text fontSize="sm" fontWeight="medium" color="green.600">
              {selectedPlantIds.length} selected
            </Text>
          </Flex>
          <Grid
            templateColumns={{
              base: "1fr",
              md: "repeat(2, 1fr)",
              lg: "repeat(3, 1fr)",
            }}
            gap={4}
          >
            {filteredProfiles.map((profile) => (
              <Box
                key={profile.id}
                position="relative"
                data-testid={`plant-card-${profile.id}`}
              >
                <PlantProfileCard
                  profile={profile}
                  onSelect={() => togglePlantSelection(profile.id)}
                  selected={selectedPlantIds.includes(profile.id)}
                />
              </Box>
            ))}
          </Grid>
        </>
      )}
    </VStack>
  );
};
