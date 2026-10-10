"use client";

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Button,
  Dialog,
  Field,
  Input,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import { useUpdatePlot } from "../hooks/useGardens";
import type { Plot, UpdatePlotRequest, CompassDirection, Garden } from "../types";
import { toaster } from "./ChakraProvider";

const plotSchema = z.object({
  compass_direction: z.enum(["N", "NE", "E", "SE", "S", "SW", "W", "NW"]).optional().or(z.literal("")),
  notes: z.string().optional(),
  width: z.number().min(0.1, "Width must be at least 0.1 ft").max(100, "Width cannot exceed 100 ft"),
  height: z.number().min(0.1, "Height must be at least 0.1 ft").max(100, "Height cannot exceed 100 ft"),
});

type PlotFormData = z.infer<typeof plotSchema>;

interface EditPlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  plot: Plot;
  gardenId: string;
  garden: Garden;
}

export const EditPlotModal: React.FC<EditPlotModalProps> = ({
  isOpen,
  onClose,
  plot,
  gardenId,
  garden,
}) => {
  const updatePlotMutation = useUpdatePlot();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PlotFormData>({
    resolver: zodResolver(plotSchema),
  });

  useEffect(() => {
    reset({
      compass_direction: plot.compass_direction || "",
      notes: plot.notes || "",
      width: plot.width,
      height: plot.height,
    });
  }, [plot, reset]);

  const onSubmit = async (data: PlotFormData) => {
    try {
      // Validate that resized plot stays within garden bounds
      if (plot.x + data.width > garden.width || plot.y + data.height > garden.height) {
        const errorMessages: string[] = [];
        if (plot.x + data.width > garden.width) {
          const overhang = (plot.x + data.width - garden.width).toFixed(1);
          errorMessages.push(`Plot would extend ${overhang} ft beyond the eastern boundary`);
        }
        if (plot.y + data.height > garden.height) {
          const overhang = (plot.y + data.height - garden.height).toFixed(1);
          errorMessages.push(`Plot would extend ${overhang} ft beyond the southern boundary`);
        }

        toaster.create({
          title: "Invalid dimensions",
          description: errorMessages.join(". "),
          type: "error",
          duration: 5000,
        });
        return;
      }

      // Check for overlaps with other plots
      const updatedPlot = { ...plot, width: data.width, height: data.height };
      const hasOverlap = garden.plots?.some((existingPlot) => {
        if (existingPlot.id === plot.id) return false;

        // Check for overlap
        return !(
          updatedPlot.x + updatedPlot.width <= existingPlot.x ||
          existingPlot.x + existingPlot.width <= updatedPlot.x ||
          updatedPlot.y + updatedPlot.height <= existingPlot.y ||
          existingPlot.y + existingPlot.height <= updatedPlot.y
        );
      });

      if (hasOverlap) {
        toaster.create({
          title: "Invalid dimensions",
          description: "Resized plot would overlap with another plot",
          type: "error",
          duration: 5000,
        });
        return;
      }

      const updateData: UpdatePlotRequest = {
        notes: data.notes || undefined,
        compass_direction: data.compass_direction ? (data.compass_direction as CompassDirection) : null,
        width: data.width,
        height: data.height,
      };

      await updatePlotMutation.mutateAsync({
        gardenId,
        plotId: plot.id,
        data: updateData,
      });

      toaster.create({
        title: "Plot updated",
        description: "Plot has been successfully updated.",
        type: "success",
        duration: 3000,
      });

      onClose();
    } catch (error) {
      toaster.create({
        title: "Error updating plot",
        description: error instanceof Error ? error.message : "An error occurred",
        type: "error",
        duration: 5000,
      });
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => e.open ? undefined : onClose()} size="lg">
      <Dialog.Backdrop bg="blackAlpha.600" />
      <Dialog.Positioner>
        <Dialog.Content bg="white" boxShadow="lg" borderRadius="lg">
          <form onSubmit={handleSubmit(onSubmit)}>
            <Dialog.Header>Edit Plot</Dialog.Header>
            <Dialog.CloseTrigger />
            <Dialog.Body>
              <VStack gap={4}>
                <Field.Root invalid={!!errors.width}>
                  <Field.Label>Width (feet)</Field.Label>
                  <Input
                    type="number"
                    step="0.1"
                    {...register("width", { valueAsNumber: true })}
                    placeholder="Plot width in feet"
                  />
                  <Field.ErrorText>{errors.width?.message}</Field.ErrorText>
                  <Field.HelperText>
                    Plot width in feet (0.1 - 100 ft)
                  </Field.HelperText>
                </Field.Root>

                <Field.Root invalid={!!errors.height}>
                  <Field.Label>Height (feet)</Field.Label>
                  <Input
                    type="number"
                    step="0.1"
                    {...register("height", { valueAsNumber: true })}
                    placeholder="Plot height in feet"
                  />
                  <Field.ErrorText>{errors.height?.message}</Field.ErrorText>
                  <Field.HelperText>
                    Plot height in feet (0.1 - 100 ft)
                  </Field.HelperText>
                </Field.Root>

                <Field.Root invalid={!!errors.compass_direction}>
                  <Field.Label>Compass Direction (optional)</Field.Label>
                  <select
                    {...register("compass_direction")}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.375rem',
                      borderWidth: '1px',
                      borderColor: 'var(--chakra-colors-gray-300)',
                    }}
                  >
                    <option value="">Not specified</option>
                    <option value="N">North (N)</option>
                    <option value="NE">Northeast (NE)</option>
                    <option value="E">East (E)</option>
                    <option value="SE">Southeast (SE)</option>
                    <option value="S">South (S)</option>
                    <option value="SW">Southwest (SW)</option>
                    <option value="W">West (W)</option>
                    <option value="NW">Northwest (NW)</option>
                  </select>
                  <Field.ErrorText>{errors.compass_direction?.message}</Field.ErrorText>
                  <Field.HelperText>
                    Specify the direction the plot faces to optimize sunlight exposure
                  </Field.HelperText>
                </Field.Root>

                <Field.Root invalid={!!errors.notes}>
                  <Field.Label>Notes (optional)</Field.Label>
                  <Textarea
                    {...register("notes")}
                    placeholder="Add any notes about this plot..."
                    rows={4}
                  />
                  <Field.ErrorText>{errors.notes?.message}</Field.ErrorText>
                </Field.Root>
              </VStack>
            </Dialog.Body>

            <Dialog.Footer>
              <Button variant="ghost" mr={3} onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                colorScheme="green"
                loading={isSubmitting}
              >
                Save Changes
              </Button>
            </Dialog.Footer>
          </form>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
