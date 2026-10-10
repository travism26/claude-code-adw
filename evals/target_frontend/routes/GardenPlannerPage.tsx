"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { GardenList } from "../components/GardenList";
import { GardenCanvas } from "../components/GardenCanvas";
import { PlantPalette } from "../components/PlantPalette";
import { EditPlotModal } from "../components/EditPlotModal";
import { GardenSuggestionsPanel } from "../components/GardenSuggestionsPanel";
import { LayoutGeneratorModal } from "../components/LayoutGenerator/LayoutGeneratorModal";
import { useGarden } from "../hooks/useGardens";
import {
  Box,
  Button,
  Container,
  Flex,
  Grid,
  Heading,
  Icon as ChakraIcon,
  Skeleton,
  Text,
} from "@chakra-ui/react";
import { ArrowLeft, Sparkles, Sprout } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { PlantProfile, Plot } from "../types";

export function GardenPlannerPage() {
  const params = useParams();
  const navigate = useNavigate();
  const gardenId = params.id as string | undefined;
  const { data: garden, isLoading, isError, error } = useGarden(gardenId || null);
  const [selectedPlantProfile, setSelectedPlantProfile] = useState<PlantProfile | null>(null);
  const [selectedPlot, setSelectedPlot] = useState<Plot | null>(null);
  const [isEditPlotModalOpen, setIsEditPlotModalOpen] = useState(false);
  const [layoutModalOpen, setLayoutModalOpen] = useState(false);
  const [highlightedPlotIds, setHighlightedPlotIds] = useState<string[]>([]);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  // Update selectedPlot when garden data changes (e.g., after plot update)
  useEffect(() => {
    if (selectedPlot && garden?.plots) {
      const updatedPlot = garden.plots.find(p => p.id === selectedPlot.id);
      if (updatedPlot) {
        setSelectedPlot(updatedPlot);
      } else {
        // Plot was deleted
        setSelectedPlot(null);
      }
    }
  }, [garden?.plots, selectedPlot?.id]); // Only depend on plots array and selected plot ID

  // Compass direction mappings
  const compassArrows: Record<string, string> = {
    N: '↑',
    NE: '↗',
    E: '→',
    SE: '↘',
    S: '↓',
    SW: '↙',
    W: '←',
    NW: '↖',
  };

  const compassNames: Record<string, string> = {
    N: 'North',
    NE: 'Northeast',
    E: 'East',
    SE: 'Southeast',
    S: 'South',
    SW: 'Southwest',
    W: 'West',
    NW: 'Northwest',
  };

  // If no garden ID, show garden list
  if (!gardenId) {
    return (
      <Container maxW="container.xl" py={8}>
        <Box mb={8}>
          <Heading size="xl" mb={2}>
            Garden Planner
          </Heading>
        </Box>
        <GardenList />
      </Container>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <Container maxW="container.xl" py={8}>
        <Skeleton height="600px" />
      </Container>
    );
  }

  // Garden not found or error loading
  if (isError || !garden) {
    return (
      <Container maxW="container.xl" py={8}>
        <Box textAlign="center" py={12}>
          <Heading size="md" color="gray.600" mb={4}>
            Garden not found
          </Heading>
          <Text color="gray.500" mb={4}>
            {error ? 'The garden you are looking for does not exist or has been deleted.' : 'This garden could not be loaded.'}
          </Text>
          <Button onClick={() => navigate("/garden-planner")}>
            Back to Gardens
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxW="container.xl" py={8}>
      {/* Header */}
      <Flex justify="space-between" align="center" mb={6}>
        <Box>
          <Button
            variant="ghost"
            onClick={() => navigate("/garden-planner")}
            mb={2}
          >
            <ChakraIcon as={ArrowLeft} mr={2} />
            Back to Gardens
          </Button>
          <Heading size="xl">{garden.name}</Heading>
          <Text color="gray.600">
            {garden.width} × {garden.height} ft
            {garden.zone && ` • Zone ${garden.zone}`}
          </Text>
        </Box>
        <Button
          colorPalette="green"
          onClick={() => setLayoutModalOpen(true)}
          data-testid="generate-layout-button"
        >
          <ChakraIcon as={Sparkles} mr={2} />
          Generate Layout
        </Button>
      </Flex>

      {/* Mobile-only palette toggle (sidebar is always visible on lg+) */}
      <Button
        display={{ base: "inline-flex", lg: "none" }}
        size="sm"
        variant="outline"
        mb={3}
        onClick={() => setIsPaletteOpen((open) => !open)}
      >
        <ChakraIcon as={Sprout} mr={2} />
        {isPaletteOpen ? "Hide plants" : "Browse plants"}
      </Button>

      {/* Main Content */}
      <Grid templateColumns={{ base: "1fr", lg: "250px 1fr" }} gap={6}>
        {/* Left Sidebar - Plant Palette */}
        <Box
          borderWidth="1px"
          borderColor="gray.200"
          rounded="lg"
          bg="white"
          p={4}
          height={{ base: "auto", lg: "600px" }}
          maxH={{ base: "55vh", lg: "600px" }}
          overflowY="auto"
          display={{ base: isPaletteOpen ? "block" : "none", lg: "block" }}
        >
          <PlantPalette
            onPlantSelect={(plant) => {
              setSelectedPlantProfile(plant);
              setSelectedPlot(null);
              setIsPaletteOpen(false);
            }}
            selectedZone={garden.zone ? parseInt(garden.zone) : undefined}
          />
        </Box>

        {/* Main Canvas Area */}
        <Box borderWidth="1px" borderColor="gray.200" rounded="lg" bg="white" p={6}>
          <GardenCanvas
            garden={garden}
            selectedPlantProfile={selectedPlantProfile}
            highlightedPlotIds={highlightedPlotIds}
            onPlotSelect={(plot) => {
              setSelectedPlot(plot);
              setSelectedPlantProfile(null);
            }}
          />

          {/* Selected Item Info */}
          {selectedPlantProfile && (
            <Box mt={4} p={4} bg="green.50" rounded="md" borderWidth="1px" borderColor="green.200">
              <Text fontWeight="bold" color="green.800">
                Selected: {selectedPlantProfile.common_name}
              </Text>
              <Text fontSize="sm" color="green.700">
                Click on the canvas to place this plant
              </Text>
            </Box>
          )}

          {selectedPlot && (
            <Box mt={4} p={4} bg="blue.50" rounded="md" borderWidth="1px" borderColor="blue.200">
              <Flex justify="space-between" align="center" mb={2}>
                <Text fontWeight="bold" color="blue.800">
                  Plot Selected
                </Text>
                <Button
                  size="sm"
                  colorScheme="blue"
                  onClick={() => setIsEditPlotModalOpen(true)}
                >
                  Edit Plot
                </Button>
              </Flex>

              {selectedPlot.compass_direction && (
                <Text fontSize="sm" color="blue.700" mb={1}>
                  {compassArrows[selectedPlot.compass_direction]} Facing {compassNames[selectedPlot.compass_direction]} ({selectedPlot.compass_direction})
                </Text>
              )}

              <Text fontSize="sm" color="blue.700">
                Position: ({selectedPlot.x.toFixed(1)}, {selectedPlot.y.toFixed(1)}) ft
              </Text>
              <Text fontSize="sm" color="blue.700">
                Size: {selectedPlot.width.toFixed(1)} × {selectedPlot.height.toFixed(1)} ft
              </Text>

              {selectedPlot.notes && (
                <Text fontSize="sm" color="blue.700" mt={2}>
                  Notes: {selectedPlot.notes}
                </Text>
              )}

              <Text fontSize="sm" color="blue.700" mt={2}>
                Press Delete to remove this plot
              </Text>
            </Box>
          )}

          {/* Edit Plot Modal */}
          {selectedPlot && gardenId && (
            <EditPlotModal
              isOpen={isEditPlotModalOpen}
              onClose={() => setIsEditPlotModalOpen(false)}
              plot={selectedPlot}
              gardenId={gardenId}
              garden={garden}
            />
          )}
        </Box>
      </Grid>

      {/* AI Suggestions Panel */}
      {garden.plots && garden.plots.length > 0 && (
        <Box mt={8}>
          <GardenSuggestionsPanel
            gardenId={gardenId}
            onPlotHighlight={(plotIds) => setHighlightedPlotIds(plotIds)}
          />
        </Box>
      )}

      {/* Layout Generator Modal */}
      <LayoutGeneratorModal
        isOpen={layoutModalOpen}
        onClose={() => setLayoutModalOpen(false)}
        garden={garden}
      />
    </Container>
  );
}
