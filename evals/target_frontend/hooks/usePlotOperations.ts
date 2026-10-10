import { useCallback } from "react";
import type { Plot, Garden, PlantProfile } from "../types";
import { useCreatePlot, useUpdatePlot, useDeletePlot } from "./useGardens";
import { checkPlotBounds, checkPlotOverlap, snapToGrid } from "../utils/gardenLayout";
import { calculateMaxExpansion, applyExpansion } from "../utils/plotResize";
import { toaster } from "../components/ChakraProvider";

interface UsePlotOperationsParams {
  garden: Garden;
  snapEnabled: boolean;
  gridSize: number;
  convertPixelsToFeet: (pixels: number) => number;
  onPlotSelect?: (plot: Plot | null) => void;
  onPlotCreated?: (plotId: string) => void;
}

export const usePlotOperations = ({
  garden,
  snapEnabled,
  gridSize,
  convertPixelsToFeet,
  onPlotSelect,
  onPlotCreated,
}: UsePlotOperationsParams) => {
  const createPlotMutation = useCreatePlot();
  const updatePlotMutation = useUpdatePlot();
  const deletePlotMutation = useDeletePlot();

  const handleCreatePlot = useCallback(
    async (e: React.MouseEvent<SVGSVGElement>, selectedPlantProfile: PlantProfile | null, isDragging: boolean) => {
      if (!selectedPlantProfile || isDragging) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const xPixels = e.clientX - rect.left;
      const yPixels = e.clientY - rect.top;

      let xFeet = convertPixelsToFeet(xPixels);
      let yFeet = convertPixelsToFeet(yPixels);

      if (snapEnabled) {
        xFeet = snapToGrid(xFeet, gridSize);
        yFeet = snapToGrid(yFeet, gridSize);
      }

      const defaultSize = 2;
      const newPlot = {
        x: xFeet,
        y: yFeet,
        width: defaultSize,
        height: defaultSize,
        plant_profile_id: selectedPlantProfile.id,
      };

      if (!checkPlotBounds(newPlot, { width: garden.width, height: garden.height })) {
        toaster.create({
          title: "Invalid placement",
          description: "Plot is outside garden boundaries",
          type: "warning",
          duration: 3000,
        });
        return;
      }

      const hasOverlap = garden.plots?.some((existingPlot) => checkPlotOverlap(newPlot, existingPlot));

      if (hasOverlap) {
        toaster.create({
          title: "Invalid placement",
          description: "Plots cannot overlap with existing plots",
          type: "error",
          duration: 3000,
        });
        return;
      }

      try {
        const created = await createPlotMutation.mutateAsync({
          gardenId: garden.id,
          data: newPlot,
        });
        if (created?.id) onPlotCreated?.(created.id);
        toaster.create({
          title: "Plot added",
          description: `${selectedPlantProfile.common_name || selectedPlantProfile.name} added to garden`,
          type: "success",
          duration: 2000,
        });
      } catch (error) {
        toaster.create({
          title: "Error adding plot",
          description: error instanceof Error ? error.message : "An error occurred",
          type: "error",
          duration: 5000,
        });
      }
    },
    [convertPixelsToFeet, snapEnabled, gridSize, garden, createPlotMutation, onPlotCreated]
  );

  const handleUpdatePlot = useCallback(
    async (plotId: string, data: { x: number; y: number; width: number; height: number }) => {
      try {
        await updatePlotMutation.mutateAsync({
          gardenId: garden.id,
          plotId,
          data,
        });
        return true;
      } catch (error) {
        toaster.create({
          title: "Error updating plot",
          description: error instanceof Error ? error.message : "An error occurred",
          type: "error",
          duration: 5000,
        });
        return false;
      }
    },
    [updatePlotMutation, garden.id]
  );

  const handleDeletePlot = useCallback(
    async (plot: Plot) => {
      try {
        await deletePlotMutation.mutateAsync({
          gardenId: garden.id,
          plotId: plot.id,
        });
        toaster.create({
          title: "Plot removed",
          type: "success",
          duration: 2000,
        });
        onPlotSelect?.(null);
      } catch (error) {
        toaster.create({
          title: "Error removing plot",
          description: error instanceof Error ? error.message : "An error occurred",
          type: "error",
          duration: 5000,
        });
      }
    },
    [deletePlotMutation, garden.id, onPlotSelect]
  );

  const handleExpandPlot = useCallback(
    async (plot: Plot, direction: "up" | "down" | "left" | "right") => {
      const maxExpansion = calculateMaxExpansion(
        plot,
        direction,
        { width: garden.width, height: garden.height },
        garden.plots || []
      );

      if (maxExpansion <= 0) {
        toaster.create({
          title: "Cannot expand",
          description: `No space available to expand ${direction}`,
          type: "warning",
          duration: 3000,
        });
        return;
      }

      const expansionAmount = Math.min(1, maxExpansion);
      const expanded = applyExpansion(plot, direction, expansionAmount);

      try {
        await updatePlotMutation.mutateAsync({
          gardenId: garden.id,
          plotId: plot.id,
          data: { x: expanded.x, y: expanded.y, width: expanded.width, height: expanded.height },
        });
        toaster.create({
          title: "Plot expanded",
          description: `Expanded ${expansionAmount.toFixed(1)} ft ${direction}`,
          type: "success",
          duration: 2000,
        });
      } catch (error) {
        toaster.create({
          title: "Error expanding plot",
          description: error instanceof Error ? error.message : "An error occurred",
          type: "error",
          duration: 5000,
        });
      }
    },
    [garden, updatePlotMutation]
  );

  return {
    handleCreatePlot,
    handleUpdatePlot,
    handleDeletePlot,
    handleExpandPlot,
    isCreating: createPlotMutation.isPending,
  };
};
