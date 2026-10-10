"use client";

import React from "react";
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
import { useCreateGarden } from "../hooks/useGardens";
import type { CreateGardenRequest } from "../types";
import { toaster } from "./ChakraProvider";

const gardenSchema = z.object({
  name: z.string().min(1, "Garden name is required").max(100, "Name must be less than 100 characters"),
  width: z.number().min(0.1, "Width must be greater than 0").max(10000, "Width cannot exceed 10000 feet"),
  height: z.number().min(0.1, "Height must be greater than 0").max(10000, "Height cannot exceed 10000 feet"),
  zone: z.string().regex(/^([0-9]|1[0-3])[ab]?$/i, "Invalid USDA hardiness zone (e.g., 5a, 10b)").optional().or(z.literal("")),
  notes: z.string().optional(),
});

type GardenFormData = z.infer<typeof gardenSchema>;

interface CreateGardenModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateGardenModal: React.FC<CreateGardenModalProps> = ({
  isOpen,
  onClose,
}) => {
  const createGardenMutation = useCreateGarden();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GardenFormData>({
    resolver: zodResolver(gardenSchema),
    defaultValues: {
      name: "",
      width: 10,
      height: 10,
      zone: "",
      notes: "",
    },
  });

  const onSubmit = async (data: GardenFormData) => {
    try {
      const gardenData: CreateGardenRequest = {
        name: data.name,
        width: data.width,
        height: data.height,
        zone: data.zone || undefined,
        notes: data.notes || undefined,
      };

      await createGardenMutation.mutateAsync(gardenData);

      toaster.create({
        title: "Garden created",
        description: `${data.name} has been successfully created.`,
        type: "success",
        duration: 3000,
      });

      reset();
      onClose();
    } catch (error) {
      toaster.create({
        title: "Error creating garden",
        description: error instanceof Error ? error.message : "An error occurred",
        type: "error",
        duration: 5000,
      });
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => e.open ? undefined : handleClose()} size="lg">
      <Dialog.Backdrop bg="blackAlpha.600" />
      <Dialog.Positioner>
        <Dialog.Content bg="white" boxShadow="lg" borderRadius="lg">
          <form onSubmit={handleSubmit(onSubmit)}>
            <Dialog.Header>Create New Garden</Dialog.Header>
            <Dialog.CloseTrigger />
            <Dialog.Body>
              <VStack gap={4}>
                <Field.Root invalid={!!errors.name}>
                  <Field.Label>Garden Name</Field.Label>
                  <Input
                    {...register("name")}
                    placeholder="e.g., Backyard Vegetable Garden"
                    autoFocus
                  />
                  <Field.ErrorText>{errors.name?.message}</Field.ErrorText>
                </Field.Root>

                <Field.Root invalid={!!errors.width}>
                  <Field.Label>Width (feet)</Field.Label>
                  <Input
                    {...register("width", { valueAsNumber: true })}
                    type="number"
                    step="0.1"
                    placeholder="10"
                  />
                  <Field.ErrorText>{errors.width?.message}</Field.ErrorText>
                </Field.Root>

                <Field.Root invalid={!!errors.height}>
                  <Field.Label>Height (feet)</Field.Label>
                  <Input
                    {...register("height", { valueAsNumber: true })}
                    type="number"
                    step="0.1"
                    placeholder="10"
                  />
                  <Field.ErrorText>{errors.height?.message}</Field.ErrorText>
                </Field.Root>

                <Field.Root invalid={!!errors.zone}>
                  <Field.Label>USDA Hardiness Zone (optional)</Field.Label>
                  <Input
                    {...register("zone")}
                    placeholder="e.g., 5a, 10b"
                  />
                  <Field.ErrorText>{errors.zone?.message}</Field.ErrorText>
                </Field.Root>

                <Field.Root invalid={!!errors.notes}>
                  <Field.Label>Notes (optional)</Field.Label>
                  <Textarea
                    {...register("notes")}
                    placeholder="Add any notes about this garden..."
                    rows={3}
                  />
                  <Field.ErrorText>{errors.notes?.message}</Field.ErrorText>
                </Field.Root>
              </VStack>
            </Dialog.Body>

            <Dialog.Footer>
              <Button variant="ghost" mr={3} onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                colorScheme="green"
                loading={isSubmitting}
              >
                Create Garden
              </Button>
            </Dialog.Footer>
          </form>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
