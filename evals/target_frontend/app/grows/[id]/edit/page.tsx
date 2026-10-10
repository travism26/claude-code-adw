"use client";

/**
 * Edit Grow Page
 *
 * Page component for editing an existing cannabis grow cycle.
 * Loads current grow data and nutrients, allows modifications,
 * and handles updating both grow details and nutrient configurations.
 */

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Box,
  Container,
  Heading,
  VStack,
  Separator,
} from "@chakra-ui/react";
import { List, Plus, Pencil } from "lucide-react";
import { GrowForm } from "../../../../components/grows/GrowForm";
import { NutrientSelector } from "../../../../components/grows/NutrientSelector";
import { useGrow, useUpdateGrow } from "../../../../hooks/useGrows";
import {
  useGrowNutrients,
  useAddGrowNutrient,
  useUpdateGrowNutrient,
  useRemoveGrowNutrient,
} from "../../../../hooks/useNutrients";
import { toaster } from "../../../../components/ChakraProvider";
import { PageStateContainer } from "../../../../components/grows/PageStateContainer";
import { PageNavigation } from "../../../../components/grows/PageNavigation";
import { PageHeader } from "../../../../components/grows/PageHeader";
import type { UpdateGrowRequest, SelectedNutrient } from "../../../../types";

/**
 * EditGrowPage component
 * Displays form for editing existing grow with nutrient management
 */
export default function EditGrowPage() {
  const router = useRouter();
  const params = useParams();
  const growId = params.id as string;

  const { data: grow, isLoading: isLoadingGrow, error: growError } = useGrow(growId);
  const { data: growNutrientsResponse, isLoading: isLoadingNutrients } = useGrowNutrients(growId);
  const updateGrowMutation = useUpdateGrow();
  const addGrowNutrientMutation = useAddGrowNutrient();
  const updateGrowNutrientMutation = useUpdateGrowNutrient();
  const removeGrowNutrientMutation = useRemoveGrowNutrient();

  const [selectedNutrients, setSelectedNutrients] = useState<SelectedNutrient[]>([]);
  const [originalNutrientIds, setOriginalNutrientIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize selected nutrients from existing grow nutrients
  useEffect(() => {
    if (growNutrientsResponse?.grow_nutrients) {
      const nutrients: SelectedNutrient[] = growNutrientsResponse.grow_nutrients.map((gn) => ({
        nutrient: gn.nutrient!,
        dosage_ml_per_gallon: gn.dosage_ml_per_gallon ?? undefined,
        frequency: gn.frequency ?? undefined,
        phase_used: gn.phase_used ?? undefined,
        notes: gn.notes ?? undefined,
        // Store the grow_nutrient id for updates
        growNutrientId: gn.id,
      }));
      setSelectedNutrients(nutrients);
      setOriginalNutrientIds(new Set(nutrients.map((n) => n.nutrient.id)));
    }
  }, [growNutrientsResponse]);

  const handleSubmit = async (data: UpdateGrowRequest) => {
    setIsSubmitting(true);

    try {
      // Step 1: Update the grow details
      await updateGrowMutation.mutateAsync({ id: growId, data });

      // Step 2: Handle nutrient changes
      // Identify added, removed, and updated nutrients
      const currentNutrientIds = new Set(selectedNutrients.map((n) => n.nutrient.id));

      // Find nutrients to add (new selections)
      const nutrientsToAdd = selectedNutrients.filter(
        (n) => !originalNutrientIds.has(n.nutrient.id)
      );

      // Find nutrients to remove (deselected)
      const nutrientIdsToRemove = Array.from(originalNutrientIds).filter(
        (id) => !currentNutrientIds.has(id)
      );

      // Find nutrients to update (existing selections with changes)
      const nutrientsToUpdate = selectedNutrients.filter(
        (n) => originalNutrientIds.has(n.nutrient.id) && (n as any).growNutrientId
      );

      // Add new nutrients
      for (const selected of nutrientsToAdd) {
        try {
          await addGrowNutrientMutation.mutateAsync({
            growId,
            data: {
              nutrient_id: selected.nutrient.id,
              dosage_ml_per_gallon: selected.dosage_ml_per_gallon,
              frequency: selected.frequency,
              phase_used: selected.phase_used,
              notes: selected.notes,
            },
          });
        } catch {
          // Continue processing remaining nutrients
        }
      }

      // Remove deselected nutrients
      for (const nutrientId of nutrientIdsToRemove) {
        // Find the grow_nutrient id from the original response
        const growNutrient = growNutrientsResponse?.grow_nutrients.find(
          (gn) => gn.nutrient!.id === nutrientId
        );
        if (growNutrient) {
          try {
            await removeGrowNutrientMutation.mutateAsync(growNutrient.id);
          } catch {
            // Continue processing remaining nutrients
          }
        }
      }

      // Update existing nutrients (dosage/frequency/phase changes)
      for (const selected of nutrientsToUpdate) {
        const growNutrientId = (selected as any).growNutrientId;
        if (growNutrientId) {
          try {
            await updateGrowNutrientMutation.mutateAsync({
              id: growNutrientId,
              data: {
                dosage_ml_per_gallon: selected.dosage_ml_per_gallon,
                frequency: selected.frequency,
                phase_used: selected.phase_used,
                notes: selected.notes,
              },
            });
          } catch {
            // Continue processing remaining nutrients
          }
        }
      }

      // Success!
      toaster.create({
        title: "Grow updated successfully",
        description: `${data.strain_name || grow?.strain_name} has been updated.`,
        type: "success",
        duration: 5000,
      });

      // Redirect to grow detail page or list
      router.push(`/grows`);
    } catch (error) {
      toaster.create({
        title: "Error updating grow",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        type: "error",
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const navigationItems = [
    { href: "/grows", label: "All Grows", icon: List },
    { href: "/grows/new", label: "New Grow", icon: Plus },
    { href: `/grows/${growId}/edit`, label: "Edit Grow", icon: Pencil, isActive: true },
  ];

  const isLoading = isLoadingGrow || isLoadingNutrients;

  if (isLoading || growError || !grow) {
    return (
      <PageStateContainer
        isLoading={isLoading}
        error={growError}
        isEmpty={!grow && !isLoading && !growError}
        errorTitle="Grow Not Found"
        emptyTitle="Grow Not Found"
        emptyMessage="The requested grow could not be found."
        backLink="/grows"
        backLinkText="Return to Grows"
        maxW="container.lg"
        testId="edit-grow-page"
        loadingVariant="form"
        loadingHeader={<PageNavigation items={navigationItems} />}
      >
        {null}
      </PageStateContainer>
    );
  }

  // Prepare initial form data from grow
  const initialData = {
    strain_name: grow.strain_name,
    strain_type: (grow.strain_type as any) || ("" as const),
    grow_method: (grow.grow_method as any) || ("" as const),
    grow_medium: grow.grow_medium || "",
    light_type: (grow.light_type as any) || ("" as const),
    light_wattage: grow.light_wattage ?? undefined,
    grow_space_sqft: grow.grow_space_sqft ?? undefined,
    pot_size_gallons: grow.pot_size_gallons ?? undefined,
    plant_count: grow.plant_count,
    started_at: grow.started_at.split("T")[0], // Convert to YYYY-MM-DD format
    notes: grow.notes || "",
  };

  return (
    <Container maxW="container.lg" py={8} data-testid="edit-grow-page">
      <VStack gap={8} align="stretch">
        <PageNavigation items={navigationItems} />

        <PageHeader
          title="Edit Grow"
          description={`Update grow details and nutrient configurations for ${grow.strain_name}.`}
        />

        {/* Grow Form Section */}
        <Box>
          <Heading size="lg" mb={4}>
            Grow Details
          </Heading>
          <GrowForm
            onSubmit={handleSubmit}
            initialData={initialData}
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
