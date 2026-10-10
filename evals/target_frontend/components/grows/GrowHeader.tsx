"use client";

import type React from "react";
import { useState } from "react";
import {
  Box,
  Flex,
  Heading,
  Text,
  Badge,
  Button,
  VStack,
  HStack,
  Grid,
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogActionTrigger,
  DialogCloseTrigger,
  createToaster,
} from "@chakra-ui/react";

const toaster = createToaster({
  placement: "top",
  duration: 5000,
});
import { Edit, Trash2, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Grow, GrowPhase } from "../../types";
import { PhaseBadge } from "./PhaseBadge";
import { useUpdateGrowPhase, useDeleteGrow } from "../../hooks/useGrows";
import { ConfirmationDialog } from "./ConfirmationDialog";

interface GrowHeaderProps {
  grow: Grow;
}

function getStrainTypeColor(strainType: string | null): string {
  if (!strainType) return "gray";

  const strainColors: Record<string, string> = {
    indica: "purple",
    sativa: "green",
    hybrid: "blue",
    ruderalis: "orange",
  };
  return strainColors[strainType] || "gray";
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function calculateDaysSinceStart(startedAt: string): number {
  const startDate = new Date(startedAt);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - startDate.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

function calculateDaysInPhase(phaseStartedAt: string | null): number | null {
  if (!phaseStartedAt) return null;

  const startDate = new Date(phaseStartedAt);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - startDate.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

function getValidNextPhases(currentPhase: GrowPhase): GrowPhase[] {
  const phaseFlow: Record<GrowPhase, GrowPhase[]> = {
    germination: ["vegetative", "archived"],
    vegetative: ["flowering", "archived"],
    flowering: ["harvest", "archived"],
    harvest: ["archived"],
    archived: [],
  };

  return phaseFlow[currentPhase] || [];
}

/**
 * Formats grow method for display
 */
function formatGrowMethod(method: string | null): string {
  if (!method) return "Not specified";

  const methodLabels: Record<string, string> = {
    soil: "Soil",
    coco: "Coco Coir",
    hydro: "Hydroponic",
    dwc: "Deep Water Culture",
    aero: "Aeroponic",
    other: "Other",
  };
  return methodLabels[method] || capitalize(method);
}

/**
 * Formats light type for display
 */
function formatLightType(lightType: string | null): string {
  if (!lightType) return "Not specified";

  const lightLabels: Record<string, string> = {
    led: "LED",
    hps: "HPS",
    mh: "Metal Halide",
    cfl: "CFL",
    sun: "Natural Sunlight",
    other: "Other",
  };
  return lightLabels[lightType] || capitalize(lightType);
}

/**
 * Grow Header Component
 * Renders the header section with grow details and actions
 */
export const GrowHeader: React.FC<GrowHeaderProps> = ({ grow }) => {
  const router = useRouter();
  const [isPhaseDialogOpen, setIsPhaseDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<GrowPhase | null>(null);

  const updatePhaseMutation = useUpdateGrowPhase();
  const deleteMutation = useDeleteGrow();

  const strainColor = getStrainTypeColor(grow.strain_type);
  const daysSinceStart = calculateDaysSinceStart(grow.started_at);
  const daysInPhase = calculateDaysInPhase(grow.phase_started_at);
  const validNextPhases = getValidNextPhases(grow.phase);
  const canTransitionPhase = validNextPhases.length > 0;

  const handlePhaseTransition = async () => {
    if (!selectedPhase) return;

    try {
      await updatePhaseMutation.mutateAsync({
        id: grow.id,
        data: {
          phase: selectedPhase,
          phase_started_at: new Date().toISOString(),
        },
      });

      toaster.create({
        title: "Phase updated",
        description: `Successfully transitioned to ${selectedPhase}`,
        type: "success",
        duration: 3000,
      });

      setIsPhaseDialogOpen(false);
      setSelectedPhase(null);
    } catch (error) {
      toaster.create({
        title: "Phase transition failed",
        description: error instanceof Error ? error.message : "An error occurred",
        type: "error",
        duration: 5000,
      });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(grow.id);

      toaster.create({
        title: "Grow deleted",
        description: "Successfully deleted grow",
        type: "success",
        duration: 3000,
      });

      router.push("/grows");
    } catch (error) {
      toaster.create({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "An error occurred",
        type: "error",
        duration: 5000,
      });
    }
  };

  return (
    <Box data-testid="grow-header" mb={6}>
      <Flex justify="space-between" align="flex-start" gap={4} mb={4}>
        {/* Left Side: Strain Info and Phase */}
        <VStack align="flex-start" gap={2} flex="1">
          <Heading as="h1" size="2xl" data-testid="grow-strain-name">
            {grow.strain_name}
          </Heading>

          {grow.strain_type && (
            <Badge colorPalette={strainColor} fontSize="sm">
              {capitalize(grow.strain_type)}
            </Badge>
          )}

          <HStack gap={3} mt={2}>
            <PhaseBadge phase={grow.phase} size="lg" />
            {canTransitionPhase && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsPhaseDialogOpen(true)}
                data-testid="phase-transition-btn"
                aria-label="Transition to next phase"
              >
                <ArrowRight />
                Transition Phase
              </Button>
            )}
          </HStack>
        </VStack>

        {/* Right Side: Action Buttons */}
        <HStack gap={2}>
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push(`/grows/${grow.id}/edit`)}
            data-testid="edit-grow-btn"
            aria-label="Edit grow"
          >
            <Edit />
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            colorPalette="red"
            onClick={() => setIsDeleteDialogOpen(true)}
            data-testid="delete-grow-btn"
            aria-label="Delete grow"
          >
            <Trash2 />
            Delete
          </Button>
        </HStack>
      </Flex>

      {/* Stats Grid */}
      <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }} gap={4}>
        <Box p={3} borderWidth="1px" borderRadius="md" borderColor="gray.200">
          <Text fontSize="sm" color="gray.600" mb={1}>
            Days Since Start
          </Text>
          <Text fontSize="xl" fontWeight="semibold">
            {daysSinceStart}
          </Text>
        </Box>

        <Box p={3} borderWidth="1px" borderRadius="md" borderColor="gray.200">
          <Text fontSize="sm" color="gray.600" mb={1}>
            Days in {capitalize(grow.phase)}
          </Text>
          <Text fontSize="xl" fontWeight="semibold">
            {daysInPhase !== null ? daysInPhase : "N/A"}
          </Text>
        </Box>

        <Box p={3} borderWidth="1px" borderRadius="md" borderColor="gray.200">
          <Text fontSize="sm" color="gray.600" mb={1}>
            Plant Count
          </Text>
          <Text fontSize="xl" fontWeight="semibold">
            {grow.plant_count}
          </Text>
        </Box>

        <Box p={3} borderWidth="1px" borderRadius="md" borderColor="gray.200">
          <Text fontSize="sm" color="gray.600" mb={1}>
            Grow Method
          </Text>
          <Text fontSize="xl" fontWeight="semibold" lineClamp={1}>
            {formatGrowMethod(grow.grow_method)}
          </Text>
        </Box>

        <Box p={3} borderWidth="1px" borderRadius="md" borderColor="gray.200">
          <Text fontSize="sm" color="gray.600" mb={1}>
            Light Type
          </Text>
          <Text fontSize="xl" fontWeight="semibold" lineClamp={1}>
            {formatLightType(grow.light_type)}
          </Text>
        </Box>

        {grow.grow_space_sqft && (
          <Box p={3} borderWidth="1px" borderRadius="md" borderColor="gray.200">
            <Text fontSize="sm" color="gray.600" mb={1}>
              Grow Space
            </Text>
            <Text fontSize="xl" fontWeight="semibold">
              {grow.grow_space_sqft} sq ft
            </Text>
          </Box>
        )}
      </Grid>

      {/* Phase Transition Dialog */}
      <DialogRoot
        open={isPhaseDialogOpen}
        onOpenChange={(e) => setIsPhaseDialogOpen(e.open)}
        data-testid="phase-dialog"
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transition Growth Phase</DialogTitle>
            <DialogCloseTrigger />
          </DialogHeader>
          <DialogBody>
            <VStack align="stretch" gap={4}>
              <Text>
                Are you sure you want to transition from{" "}
                <strong>{capitalize(grow.phase)}</strong> to a new phase?
                This will update the phase start date.
              </Text>

              <Text fontSize="sm" color="gray.600">
                Select the new phase:
              </Text>

              <VStack gap={2} align="stretch" data-testid="phase-select">
                {validNextPhases.map((phase) => (
                  <Button
                    key={phase}
                    variant={selectedPhase === phase ? "solid" : "outline"}
                    colorPalette={selectedPhase === phase ? "green" : "gray"}
                    onClick={() => setSelectedPhase(phase)}
                    justifyContent="flex-start"
                  >
                    {capitalize(phase)}
                  </Button>
                ))}
              </VStack>
            </VStack>
          </DialogBody>
          <DialogFooter>
            <DialogActionTrigger asChild>
              <Button variant="outline">Cancel</Button>
            </DialogActionTrigger>
            <Button
              colorPalette="green"
              onClick={handlePhaseTransition}
              disabled={!selectedPhase || updatePhaseMutation.isPending}
              loading={updatePhaseMutation.isPending}
              data-testid="confirm-transition-btn"
            >
              Confirm Transition
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="Delete Grow"
        message={
          <Text>
            Are you sure you want to delete <strong>{grow.strain_name}</strong>?
            This action cannot be undone and will delete all associated log entries, photos, and data.
          </Text>
        }
        confirmText="Delete Grow"
        confirmColorPalette="red"
        isLoading={deleteMutation.isPending}
      />
    </Box>
  );
};
