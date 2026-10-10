"use client";

/**
 * EnvironmentSelector Component
 *
 * Dropdown selector for choosing a grow environment.
 * Includes "No Environment" option and "Create New" functionality.
 */

import React, { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  Field,
  HStack,
  NativeSelectField,
  NativeSelectRoot,
  Spinner,
  Text,
} from "@chakra-ui/react";
import { Plus } from "lucide-react";
import {
  useGrowEnvironments,
  useCreateGrowEnvironment,
} from "../../hooks/useGrowEnvironments";
import { useEnvironmentOverview } from "../../hooks/useEnvironmentOverview";
import { EnvironmentForm } from "./EnvironmentForm";
import { formatDimensions } from "../../utils/tentCapacity";
import { toaster } from "../ChakraProvider";
import type { CreateGrowEnvironmentRequest, UpdateGrowEnvironmentRequest, GrowEnvironment } from "../../types/growEnvironment";
import type { CapacityStatus } from "../../types/environmentOverview";

interface EnvironmentSelectorProps {
  value: string | null;
  onChange: (value: string | null) => void;
  label?: string;
  helperText?: string;
  error?: string;
  isDisabled?: boolean;
}

/**
 * EnvironmentSelector component
 * Provides dropdown for environment selection with create new option
 */
export const EnvironmentSelector: React.FC<EnvironmentSelectorProps> = ({
  value,
  onChange,
  label = "Growing Environment",
  helperText,
  error,
  isDisabled = false,
}) => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { data, isLoading, error: loadError } = useGrowEnvironments({ is_active: true });
  const { data: overviewData } = useEnvironmentOverview();
  const createMutation = useCreateGrowEnvironment();

  const environments = data?.environments || [];

  // Create a map of environment IDs to capacity data for quick lookup
  const capacityMap = new Map(
    overviewData?.environments.map((env) => [env.id, env]) || []
  );

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    if (selectedValue === "__create__") {
      setIsCreateOpen(true);
    } else if (selectedValue === "") {
      onChange(null);
    } else {
      onChange(selectedValue);
    }
  };

  const handleCreate = async (formData: CreateGrowEnvironmentRequest | UpdateGrowEnvironmentRequest) => {
    try {
      const newEnv = await createMutation.mutateAsync(formData as CreateGrowEnvironmentRequest);
      toaster.create({
        title: "Environment created",
        description: `${formData.name} has been successfully created.`,
        type: "success",
        duration: 3000,
      });
      onChange(newEnv.id);
      setIsCreateOpen(false);
    } catch (err) {
      toaster.create({
        title: "Error creating environment",
        description: err instanceof Error ? err.message : "An error occurred",
        type: "error",
        duration: 5000,
      });
    }
  };

  /**
   * Get capacity status indicator emoji for text-based display
   */
  const getCapacityIndicator = (status: CapacityStatus): string => {
    switch (status) {
      case "normal":
        return "✓";
      case "warning":
        return "⚠";
      case "over":
        return "⚠";
    }
  };

  const formatOptionLabel = (env: GrowEnvironment): string => {
    const parts = [env.name];

    // Add capacity information if available
    const capacityInfo = capacityMap.get(env.id);
    if (capacityInfo && capacityInfo.maxPlants !== null) {
      const indicator = getCapacityIndicator(capacityInfo.capacityStatus);
      const capacityText = `${capacityInfo.currentPlants}/${capacityInfo.maxPlants} plants`;
      parts.push(`${indicator} ${capacityText}`);
    } else if (env.width_inches && env.depth_inches) {
      parts.push(`(${formatDimensions(env.width_inches, env.depth_inches)})`);
    }

    return parts.join(" ");
  };

  if (loadError) {
    return (
      <Field.Root invalid>
        <Field.Label>{label}</Field.Label>
        <Text color="red.500" fontSize="sm">
          Error loading environments
        </Text>
      </Field.Root>
    );
  }

  return (
    <>
      <Field.Root invalid={!!error}>
        <Field.Label>
          {label}
          {isLoading && <Spinner size="xs" ml={2} />}
        </Field.Label>
        <HStack gap={2}>
          <Box flex={1}>
            <NativeSelectRoot disabled={isDisabled || isLoading}>
              <NativeSelectField
                value={value || ""}
                onChange={handleSelectChange}
                data-testid="environment-selector"
              >
                <option value="">No Environment (Optional)</option>
                {environments.map((env) => (
                  <option key={env.id} value={env.id}>
                    {formatOptionLabel(env)}
                  </option>
                ))}
                <option value="__create__">+ Create New Environment</option>
              </NativeSelectField>
            </NativeSelectRoot>
          </Box>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsCreateOpen(true)}
            disabled={isDisabled}
            data-testid="create-environment-inline-button"
          >
            <Plus size={16} />
          </Button>
        </HStack>
        {error && <Field.ErrorText>{error}</Field.ErrorText>}
        {helperText && !error && <Field.HelperText>{helperText}</Field.HelperText>}
      </Field.Root>

      {/* Create Dialog */}
      <Dialog.Root
        open={isCreateOpen}
        onOpenChange={(e) => e.open ? undefined : setIsCreateOpen(false)}
        size="xl"
      >
        <Dialog.Backdrop bg="blackAlpha.600" />
        <Dialog.Positioner>
          <Dialog.Content bg="white" boxShadow="lg" borderRadius="lg">
            <Dialog.Header>Create Grow Environment</Dialog.Header>
            <Dialog.CloseTrigger />
            <Dialog.Body>
              <EnvironmentForm
                onSubmit={handleCreate}
                isLoading={createMutation.isPending}
                mode="create"
              />
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </>
  );
};
