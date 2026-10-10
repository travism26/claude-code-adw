"use client";

import type React from "react";
import { useState, useEffect } from "react";
import {
  Box,
  VStack,
  HStack,
  Flex,
  Text,
  Button,
  Spinner,
  Alert,
  Progress,
  Dialog,
} from "@chakra-ui/react";
import { ArrowLeft, ArrowRight, X, CheckCircle, Loader } from "lucide-react";
import { PlantSelector } from "./PlantSelector";
import { YieldPreferencesStep } from "./YieldPreferencesStep";
import { LayoutOptions } from "./LayoutOptions";
import { useGenerateLayout, useLayoutGenerationStatus, useApplyLayout } from "../../hooks/useLayoutGeneration";
import { toaster } from "../ChakraProvider";
import type { Garden, LayoutOption, LayoutPreferences } from "../../types";

interface LayoutGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  garden: Garden;
}

export const LayoutGeneratorModal: React.FC<LayoutGeneratorModalProps> = ({
  isOpen,
  onClose,
  garden,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedPlantIds, setSelectedPlantIds] = useState<string[]>([]);
  const [householdSize, setHouseholdSize] = useState(2);
  const [yieldGoal, setYieldGoal] = useState<'fresh_eating' | 'light_preservation' | 'heavy_preservation'>('fresh_eating');
  const [layoutStyle, setLayoutStyle] = useState<'cottage' | 'formal' | 'four_square' | 'block' | 'scattered'>('cottage');
  const [generationJobId, setGenerationJobId] = useState<string | null>(null);
  const [layoutOptions, setLayoutOptions] = useState<LayoutOption[] | null>(null);
  const [selectedLayout, setSelectedLayout] = useState<LayoutOption | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateLayoutMutation = useGenerateLayout(garden.id);
  const applyLayoutMutation = useApplyLayout(garden.id);
  const { data: jobStatus, error: jobError } = useLayoutGenerationStatus(
    generationJobId,
    garden.id
  );

  useEffect(() => {
    if (!jobStatus) return;

    if (jobStatus.status === "completed") {
      if (jobStatus.layouts && jobStatus.layouts.length > 0) {
        setLayoutOptions(jobStatus.layouts);
        setCurrentStep(4);
        setError(null);
      } else {
        setError("Failed to generate layouts. Please try again.");
        setCurrentStep(1);
        setGenerationJobId(null);
      }
    } else if (jobStatus.status === "failed") {
      setError(jobStatus.message || "Layout generation failed. Please try again.");
      setCurrentStep(1);
      setGenerationJobId(null);
    }
  }, [jobStatus]);
  useEffect(() => {
    if (jobError) {
      setError("Failed to check generation status. Please try again.");
      setCurrentStep(1);
      setGenerationJobId(null);
    }
  }, [jobError]);
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(1);
      setSelectedPlantIds([]);
      setHouseholdSize(2);
      setYieldGoal('fresh_eating');
      setLayoutStyle('cottage');
      setGenerationJobId(null);
      setLayoutOptions(null);
      setSelectedLayout(null);
      setError(null);
    }
  }, [isOpen]);
  const handleGenerateLayouts = async () => {
    try {
      setError(null);
      const response = await generateLayoutMutation.mutateAsync({
        plantProfileIds: selectedPlantIds,
        sunZones: [],
        preferences: {
          optimizationGoal: 'max_yield',
          spacingMethod: 'intensive',
          layoutStyle,
          yieldGoal,
          householdSize,
        },
      });

      setGenerationJobId(response.jobId);
      setCurrentStep(3);
    } catch (err: any) {
      setError(err.message || "Failed to start layout generation.");
      toaster.create({
        title: "Generation failed",
        description: "Could not start layout generation. Please try again.",
        type: "error",
        duration: 5000,
      });
    }
  };
  const handleLayoutSelect = (layout: LayoutOption) => setSelectedLayout(layout);
  const handleContinueToSuccess = async () => {
    if (!selectedLayout) {
      setError("Please select a layout first");
      return;
    }

    try {
      setError(null);
      // Move to step 5 with loading state
      setCurrentStep(5);

      // Apply the selected layout to the garden
      const response = await applyLayoutMutation.mutateAsync(selectedLayout);

      toaster.create({
        title: "Layout applied!",
        description: `Successfully added ${response.plotsCreated} plots to your garden.`,
        type: "success",
        duration: 5000,
      });
    } catch (err: any) {
      setError(err.message || "Failed to apply layout to garden.");
      toaster.create({
        title: "Application failed",
        description: "Could not apply layout to garden. Please try again.",
        type: "error",
        duration: 5000,
      });
      // Go back to step 4 so user can try again
      setCurrentStep(4);
    }
  };
  const handleClose = () => onClose();
  const handleBackToPlantSelection = () => {
    setCurrentStep(2);
    setGenerationJobId(null);
    setLayoutOptions(null);
    setError(null);
  };

  const canProceedFromStep2 = selectedPlantIds.length >= 2;
  const canProceedFromStep4 = selectedLayout !== null;

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(e) => !e.open && handleClose()}
      size="xl"
      placement="center"
    >
      <Dialog.Backdrop bg="blackAlpha.600" />
      <Dialog.Positioner>
        <Dialog.Content
          maxWidth="900px"
          maxHeight="90vh"
          overflow="auto"
          bg="white"
          boxShadow="lg"
          borderRadius="lg"
          data-testid="layout-generator-modal"
        >
          <Dialog.Header>
            <Dialog.Title>
              AI Garden Layout Generator
            </Dialog.Title>
            <Dialog.CloseTrigger />
          </Dialog.Header>

          <Dialog.Body>
          <VStack gap={4} align="stretch">
            <Box>
              <HStack gap={2} justify="center" mb={2}>
                {[1, 2, 3, 4, 5].map((step) => (
                  <Flex key={step} align="center" gap={1}>
                    <Box
                      width="8"
                      height="8"
                      borderRadius="full"
                      bg={currentStep >= step ? "green.500" : "gray.200"}
                      color={currentStep >= step ? "white" : "gray.500"}
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      fontSize="sm"
                      fontWeight="bold"
                    >
                      {step}
                    </Box>
                    {step < 5 && (
                      <Box
                        width="12"
                        height="1"
                        bg={currentStep > step ? "green.500" : "gray.200"}
                      />
                    )}
                  </Flex>
                ))}
              </HStack>
              <Text textAlign="center" fontSize="sm" color="gray.600">
                Step {currentStep} of 5
              </Text>
            </Box>
            {error && (
              <Alert.Root status="error" borderRadius="lg">
                <Alert.Indicator />
                <Alert.Title>{error}</Alert.Title>
              </Alert.Root>
            )}
            <Box
              data-testid={`modal-step-${currentStep}`}
              minHeight="400px"
            >
              {currentStep === 1 && (
                <YieldPreferencesStep
                  householdSize={householdSize}
                  yieldGoal={yieldGoal}
                  layoutStyle={layoutStyle}
                  onHouseholdSizeChange={setHouseholdSize}
                  onYieldGoalChange={(value) => setYieldGoal(value as typeof yieldGoal)}
                  onLayoutStyleChange={(value) => setLayoutStyle(value as typeof layoutStyle)}
                />
              )}
              {currentStep === 2 && (
                <VStack gap={3} align="stretch">
                  <Text fontSize="md" color="gray.700">
                    Select at least 2 plants you&apos;d like to grow in your garden:
                  </Text>
                  <PlantSelector
                    selectedPlantIds={selectedPlantIds}
                    onSelectionChange={setSelectedPlantIds}
                    userZone={garden.zone ? parseInt(garden.zone) : undefined}
                  />
                </VStack>
              )}
              {currentStep === 3 && (
                <VStack gap={6} align="center" justify="center" py={12}>
                  <Spinner size="xl" color="green.500" />
                  <VStack gap={2}>
                    <Text fontSize="lg" fontWeight="semibold">
                      Generating your personalized layouts...
                    </Text>
                    <Text fontSize="sm" color="gray.600">
                      This usually takes 10-30 seconds
                    </Text>
                  </VStack>
                  <Progress.Root
                    value={null}
                    width="300px"
                    colorPalette="green"
                    size="sm"
                  >
                    <Progress.Track>
                      <Progress.Range />
                    </Progress.Track>
                  </Progress.Root>
                </VStack>
              )}
              {currentStep === 4 && layoutOptions && (
                <LayoutOptions
                  layouts={layoutOptions}
                  garden={garden}
                  onLayoutSelect={handleLayoutSelect}
                />
              )}
              {currentStep === 5 && (
                <VStack gap={6} align="center" justify="center" py={12}>
                  {applyLayoutMutation.isPending ? (
                    <>
                      <Spinner size="xl" color="green.500" />
                      <VStack gap={2}>
                        <Text fontSize="lg" fontWeight="semibold">
                          Applying layout to garden...
                        </Text>
                        <Text fontSize="sm" color="gray.600">
                          Creating {selectedLayout?.placements.length} plots
                        </Text>
                      </VStack>
                    </>
                  ) : (
                    <>
                      <Box as={CheckCircle} boxSize="16" color="green.500" />
                      <VStack gap={2}>
                        <Text fontSize="xl" fontWeight="bold" color="gray.800">
                          Layout Applied Successfully!
                        </Text>
                        <Text fontSize="md" color="gray.600" textAlign="center">
                          Your garden has been updated with the new plots.
                        </Text>
                        {selectedLayout && applyLayoutMutation.data && (
                          <Text fontSize="sm" color="gray.500" textAlign="center">
                            Added {applyLayoutMutation.data.plotsCreated} plots ({selectedLayout.optimizationGoal.replace("_", " ")})
                          </Text>
                        )}
                      </VStack>
                    </>
                  )}
                </VStack>
              )}
            </Box>
          </VStack>
          </Dialog.Body>

          <Dialog.Footer>
          <HStack gap={2} width="full" justify="space-between">
            <Button
              variant="ghost"
              onClick={() => currentStep === 2 ? setCurrentStep(1) : handleBackToPlantSelection()}
              disabled={currentStep === 1 || currentStep === 3 || currentStep === 5}
              data-testid="back-button"
            >
              <Box as={ArrowLeft} boxSize="4" mr={1} />
              Back
            </Button>
            <HStack gap={2}>
              {currentStep !== 5 && (
                <Button
                  variant="outline"
                  onClick={handleClose}
                  data-testid="cancel-button"
                  disabled={currentStep === 3}
                >
                  Cancel
                </Button>
              )}
              {currentStep === 1 && (
                <Button
                  colorPalette="green"
                  onClick={() => setCurrentStep(2)}
                  data-testid="next-button"
                >
                  Next
                  <Box as={ArrowRight} boxSize="4" ml={1} />
                </Button>
              )}
              {currentStep === 2 && (
                <Button
                  colorPalette="green"
                  onClick={handleGenerateLayouts}
                  disabled={!canProceedFromStep2 || generateLayoutMutation.isPending}
                  data-testid="next-button"
                >
                  {generateLayoutMutation.isPending ? (
                    <>
                      <Box as={Loader} boxSize="4" mr={1} />
                      Generating...
                    </>
                  ) : (
                    <>
                      Generate Layouts
                      <Box as={ArrowRight} boxSize="4" ml={1} />
                    </>
                  )}
                </Button>
              )}
              {currentStep === 4 && (
                <Button
                  colorPalette="green"
                  onClick={handleContinueToSuccess}
                  disabled={!canProceedFromStep4}
                  data-testid="next-button"
                >
                  Apply Layout
                  <Box as={ArrowRight} boxSize="4" ml={1} />
                </Button>
              )}
              {currentStep === 5 && (
                <Button
                  colorPalette="green"
                  onClick={handleClose}
                  data-testid="close-button"
                  disabled={applyLayoutMutation.isPending}
                >
                  Close
                </Button>
              )}
            </HStack>
          </HStack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
