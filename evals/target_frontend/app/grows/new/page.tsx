"use client";

/**
 * Create New Grow Page
 *
 * Page component for creating a new cannabis grow cycle.
 * Implements two-step submission flow:
 * 1. Create grow via POST /api/grows
 * 2. Add selected nutrients via POST /api/grows/:id/nutrients for each
 *
 * Provides comprehensive form with nutrient selection and configuration.
 */

import React, { useState } from "react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import {
  Box,
  Container,
  Heading,
  VStack,
  Text,
  Separator,
  HStack,
  Button,
} from "@chakra-ui/react";
import { List, Plus } from "lucide-react";
import { GrowForm } from "../../../components/grows/GrowForm";
import { NutrientSelector } from "../../../components/grows/NutrientSelector";
import { useCreateGrow } from "../../../hooks/useGrows";
import { useAddGrowNutrient } from "../../../hooks/useNutrients";
import { toaster } from "../../../components/ChakraProvider";
import type { CreateGrowRequest, SelectedNutrient } from "../../../types";

/**
 * CreateGrowPage component
 * Displays form for creating new grow with nutrient selection
 */
export default function CreateGrowPage() {
  const router = useRouter();
  const createGrowMutation = useCreateGrow();
  const addGrowNutrientMutation = useAddGrowNutrient();

  const [selectedNutrients, setSelectedNutrients] = useState<SelectedNutrient[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: CreateGrowRequest) => {
    setIsSubmitting(true);

    try {
      // Step 1: Create the grow
      const newGrow = await createGrowMutation.mutateAsync(data);

      // Step 2: Add nutrients if any selected
      if (selectedNutrients.length > 0) {
        // Add all nutrients sequentially
        for (const selected of selectedNutrients) {
          try {
            await addGrowNutrientMutation.mutateAsync({
              growId: newGrow.id,
              data: {
                nutrient_id: selected.nutrient.id,
                dosage_ml_per_gallon: selected.dosage_ml_per_gallon,
                frequency: selected.frequency,
                phase_used: selected.phase_used,
                notes: selected.notes,
              },
            });
          } catch {
            // Continue with remaining nutrients
            toaster.create({
              title: "Warning",
              description: `Failed to add nutrient: ${selected.nutrient.product_name}`,
              type: "warning",
              duration: 5000,
            });
          }
        }
      }

      // Success!
      toaster.create({
        title: "Grow created successfully",
        description: `${data.strain_name} grow has been created with ${selectedNutrients.length} nutrient(s).`,
        type: "success",
        duration: 5000,
      });

      // Redirect to grows list or detail page
      router.push(`/grows`);
    } catch (error) {
      toaster.create({
        title: "Error creating grow",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        type: "error",
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container maxW="container.lg" py={8} data-testid="create-grow-page">
      <VStack gap={8} align="stretch">
        {/* Navigation */}
        <HStack gap={3} flexWrap="wrap">
          <Button
            asChild
            size="sm"
            variant="outline"
            colorPalette="green"
          >
            <NextLink href="/grows">
              <List size={16} />
              All Grows
            </NextLink>
          </Button>
          <Button
            asChild
            size="sm"
            variant="solid"
            colorPalette="green"
          >
            <NextLink href="/grows/new">
              <Plus size={16} />
              New Grow
            </NextLink>
          </Button>
        </HStack>

        {/* Page Header */}
        <Box>
          <Heading size="2xl" mb={2}>
            Create New Grow
          </Heading>
          <Text color="gray.600">
            Start tracking a new cannabis cultivation cycle. Fill in the grow details
            and optionally select nutrients with dosing configurations.
          </Text>
        </Box>

        {/* Grow Form Section */}
        <Box>
          <Heading size="lg" mb={4}>
            Grow Details
          </Heading>
          <GrowForm
            onSubmit={handleSubmit}
            isLoading={isSubmitting}
          />
        </Box>

        <Separator />

        {/* Nutrient Selection Section */}
        <NutrientSelector
          selectedNutrients={selectedNutrients}
          onNutrientsChange={setSelectedNutrients}
        />
      </VStack>
    </Container>
  );
}
