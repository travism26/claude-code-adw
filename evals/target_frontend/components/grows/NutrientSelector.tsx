"use client";

import React, { useState, useMemo } from "react";
import {
  Box,
  Input,
  Grid,
  Card,
  Badge,
  Field,
  Button,
  Text,
  VStack,
  HStack,
  Heading,
  Spinner,
  NativeSelectRoot,
  NativeSelectField,
  Separator,
} from "@chakra-ui/react";
import { Plus, X, Droplet } from "lucide-react";
import { useNutrients } from "../../hooks/useNutrients";
import type {
  Nutrient,
  SelectedNutrient,
  NutrientType,
  GrowNutrientFrequency,
  GrowNutrientPhase,
} from "../../types";

interface NutrientSelectorProps {
  selectedNutrients: SelectedNutrient[];
  onNutrientsChange: (nutrients: SelectedNutrient[]) => void;
}

export const NutrientSelector: React.FC<NutrientSelectorProps> = ({
  selectedNutrients,
  onNutrientsChange,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<NutrientType | "">("");
  const [brandFilter, setBrandFilter] = useState("");

  const { data: nutrientsResponse, isLoading, error } = useNutrients();

  const nutrients = nutrientsResponse?.nutrients || [];
  const brands = useMemo(() => {
    const brandSet = new Set(nutrients.map((n) => n.brand));
    return Array.from(brandSet).sort();
  }, [nutrients]);
  const filteredNutrients = useMemo(() => {
    let filtered = nutrients;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (n) =>
          n.product_name.toLowerCase().includes(query) ||
          n.brand.toLowerCase().includes(query) ||
          n.npk_ratio?.toLowerCase().includes(query)
      );
    }

    // Type filter
    if (typeFilter) {
      filtered = filtered.filter((n) => n.type === typeFilter);
    }

    // Brand filter
    if (brandFilter) {
      filtered = filtered.filter((n) => n.brand === brandFilter);
    }

    return filtered;
  }, [nutrients, searchQuery, typeFilter, brandFilter]);
  const groupedNutrients = useMemo(() => {
    const groups: Record<NutrientType, Nutrient[]> = {
      base: [],
      supplement: [],
      additive: [],
      ph_adjuster: [],
      other: [],
    };

    filteredNutrients.forEach((nutrient) => {
      groups[nutrient.type].push(nutrient);
    });

    return groups;
  }, [filteredNutrients]);
  const isSelected = (nutrientId: string) => {
    return selectedNutrients.some((sn) => sn.nutrient.id === nutrientId);
  };
  const handleAddNutrient = (nutrient: Nutrient) => {
    if (isSelected(nutrient.id)) return;

    const newSelection: SelectedNutrient = {
      nutrient,
      dosage_ml_per_gallon: undefined,
      frequency: "weekly",
      phase_used: "all",
      notes: undefined,
    };

    onNutrientsChange([...selectedNutrients, newSelection]);
  };
  const handleRemoveNutrient = (nutrientId: string) => {
    onNutrientsChange(selectedNutrients.filter((sn) => sn.nutrient.id !== nutrientId));
  };
  const handleUpdateNutrient = (
    nutrientId: string,
    field: keyof SelectedNutrient,
    value: any
  ) => {
    onNutrientsChange(
      selectedNutrients.map((sn) =>
        sn.nutrient.id === nutrientId ? { ...sn, [field]: value } : sn
      )
    );
  };
  const typeNames: Record<NutrientType, string> = {
    base: "Base Nutrients",
    supplement: "Supplements",
    additive: "Additives",
    ph_adjuster: "pH Adjusters",
    other: "Other",
  };

  if (isLoading) {
    return (
      <Box textAlign="center" py={8}>
        <Spinner size="lg" />
        <Text mt={2}>Loading nutrients...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box textAlign="center" py={8} color="red.500">
        <Text>Error loading nutrients: {error.message}</Text>
      </Box>
    );
  }

  return (
    <VStack gap={6} align="stretch">
      <Box>
        <Heading size="lg" mb={4}>
          Nutrients
        </Heading>

        {/* Search and Filters */}
        <Grid templateColumns={{ base: "1fr", md: "2fr 1fr 1fr" }} gap={3} mb={4}>
          <Field.Root>
            <Field.Label>Search Nutrients</Field.Label>
            <Input
              placeholder="Search by name, brand, or NPK..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="nutrient-search-input"
            />
          </Field.Root>

          <Field.Root>
            <Field.Label>Filter by Type</Field.Label>
            <NativeSelectRoot>
              <NativeSelectField
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as NutrientType | "")}
                data-testid="nutrient-type-filter"
              >
                <option value="">All Types</option>
                <option value="base">Base Nutrients</option>
                <option value="supplement">Supplements</option>
                <option value="additive">Additives</option>
                <option value="ph_adjuster">pH Adjusters</option>
                <option value="other">Other</option>
              </NativeSelectField>
            </NativeSelectRoot>
          </Field.Root>

          <Field.Root>
            <Field.Label>Filter by Brand</Field.Label>
            <NativeSelectRoot>
              <NativeSelectField
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                data-testid="nutrient-brand-filter"
              >
                <option value="">All Brands</option>
                {brands.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </NativeSelectField>
            </NativeSelectRoot>
          </Field.Root>
        </Grid>

        {/* Selected Nutrients */}
        {selectedNutrients.length > 0 && (
          <Box mb={6}>
            <Heading size="md" mb={3}>
              Selected Nutrients ({selectedNutrients.length})
            </Heading>
            <VStack gap={3} align="stretch">
              {selectedNutrients.map((selected) => (
                <Card.Root key={selected.nutrient.id} p={4}>
                  <VStack gap={3} align="stretch">
                    <HStack justify="space-between">
                      <Box>
                        <HStack gap={2}>
                          <Droplet size={16} />
                          <Text fontWeight="bold">
                            {selected.nutrient.brand} - {selected.nutrient.product_name}
                          </Text>
                        </HStack>
                        {selected.nutrient.npk_ratio && (
                          <Badge colorScheme="blue" ml={6} mt={1}>
                            NPK: {selected.nutrient.npk_ratio}
                          </Badge>
                        )}
                        {selected.nutrient.is_organic && (
                          <Badge colorScheme="green" ml={1} mt={1}>
                            Organic
                          </Badge>
                        )}
                      </Box>
                      <Button
                        size="sm"
                        variant="ghost"
                        colorScheme="red"
                        onClick={() => handleRemoveNutrient(selected.nutrient.id)}
                        data-testid={`remove-nutrient-${selected.nutrient.id}`}
                      >
                        <X size={16} />
                      </Button>
                    </HStack>

                    <Grid templateColumns={{ base: "1fr", md: "1fr 1fr 1fr" }} gap={3}>
                      <Field.Root>
                        <Field.Label>Dosage (ml/gallon)</Field.Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          placeholder="e.g., 5.0"
                          value={selected.dosage_ml_per_gallon || ""}
                          onChange={(e) =>
                            handleUpdateNutrient(
                              selected.nutrient.id,
                              "dosage_ml_per_gallon",
                              e.target.value ? parseFloat(e.target.value) : undefined
                            )
                          }
                          data-testid={`dosage-input-${selected.nutrient.id}`}
                        />
                      </Field.Root>

                      <Field.Root>
                        <Field.Label>Frequency</Field.Label>
                        <NativeSelectRoot>
                          <NativeSelectField
                            value={selected.frequency || "weekly"}
                            onChange={(e) =>
                              handleUpdateNutrient(
                                selected.nutrient.id,
                                "frequency",
                                e.target.value as GrowNutrientFrequency
                              )
                            }
                            data-testid={`frequency-select-${selected.nutrient.id}`}
                          >
                            <option value="every_watering">Every Watering</option>
                            <option value="weekly">Weekly</option>
                            <option value="biweekly">Bi-weekly</option>
                            <option value="as_needed">As Needed</option>
                          </NativeSelectField>
                        </NativeSelectRoot>
                      </Field.Root>

                      <Field.Root>
                        <Field.Label>Growth Phase</Field.Label>
                        <NativeSelectRoot>
                          <NativeSelectField
                            value={selected.phase_used || "all"}
                            onChange={(e) =>
                              handleUpdateNutrient(
                                selected.nutrient.id,
                                "phase_used",
                                e.target.value as GrowNutrientPhase
                              )
                            }
                            data-testid={`phase-select-${selected.nutrient.id}`}
                          >
                            <option value="all">All Phases</option>
                            <option value="vegetative">Vegetative</option>
                            <option value="flowering">Flowering</option>
                            <option value="late_flowering">Late Flowering</option>
                          </NativeSelectField>
                        </NativeSelectRoot>
                      </Field.Root>
                    </Grid>
                  </VStack>
                </Card.Root>
              ))}
            </VStack>
            <Separator my={6} />
          </Box>
        )}

        {/* Available Nutrients */}
        <Heading size="md" mb={3}>
          Available Nutrients
        </Heading>

        {filteredNutrients.length === 0 ? (
          <Text color="gray.500" textAlign="center" py={4}>
            No nutrients found matching your filters.
          </Text>
        ) : (
          <VStack gap={4} align="stretch">
            {Object.entries(groupedNutrients).map(([type, typeNutrients]) => {
              if (typeNutrients.length === 0) return null;

              return (
                <Box key={type}>
                  <Heading size="sm" mb={2} color="gray.600">
                    {typeNames[type as NutrientType]} ({typeNutrients.length})
                  </Heading>
                  <Grid
                    templateColumns={{ base: "1fr", md: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }}
                    gap={3}
                  >
                    {typeNutrients.map((nutrient) => {
                      const selected = isSelected(nutrient.id);
                      return (
                        <Card.Root
                          key={nutrient.id}
                          p={3}
                          cursor={selected ? "not-allowed" : "pointer"}
                          opacity={selected ? 0.5 : 1}
                          _hover={selected ? {} : { shadow: "md", borderColor: "green.400" }}
                          onClick={() => !selected && handleAddNutrient(nutrient)}
                          data-testid={`nutrient-card-${nutrient.id}`}
                        >
                          <VStack align="stretch" gap={2}>
                            <HStack justify="space-between">
                              <Text fontSize="sm" fontWeight="bold">
                                {nutrient.brand}
                              </Text>
                              {!selected && <Plus size={16} />}
                              {selected && <Badge colorScheme="green">Added</Badge>}
                            </HStack>
                            <Text fontSize="sm">{nutrient.product_name}</Text>
                            <HStack gap={2} flexWrap="wrap">
                              {nutrient.npk_ratio && (
                                <Badge size="sm" colorScheme="blue">
                                  {nutrient.npk_ratio}
                                </Badge>
                              )}
                              {nutrient.is_organic && (
                                <Badge size="sm" colorScheme="green">
                                  Organic
                                </Badge>
                              )}
                            </HStack>
                            {nutrient.description && (
                              <Text fontSize="xs" color="gray.600" lineClamp={2}>
                                {nutrient.description}
                              </Text>
                            )}
                          </VStack>
                        </Card.Root>
                      );
                    })}
                  </Grid>
                </Box>
              );
            })}
          </VStack>
        )}
      </Box>
    </VStack>
  );
};
