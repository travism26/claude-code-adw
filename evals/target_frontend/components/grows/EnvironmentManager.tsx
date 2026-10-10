"use client";

import React, { useState } from "react";
import {
  Box,
  Button,
  Card,
  Dialog,
  Grid,
  HStack,
  Heading,
  Spinner,
  Text,
} from "@chakra-ui/react";
import {
  Plus,
  Tent,
} from "lucide-react";
import {
  useGrowEnvironments,
  useCreateGrowEnvironment,
  useUpdateGrowEnvironment,
  useDeleteGrowEnvironment,
} from "../../hooks/useGrowEnvironments";
import { useEnvironmentOverview } from "../../hooks/useEnvironmentOverview";
import { EnvironmentForm } from "./EnvironmentForm";
import { EnvironmentCard } from "./EnvironmentCard";
import { toaster } from "../ChakraProvider";
import type {
  GrowEnvironment,
  CreateGrowEnvironmentRequest,
  UpdateGrowEnvironmentRequest,
} from "../../types/growEnvironment";

export const EnvironmentManager: React.FC = () => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingEnvironment, setEditingEnvironment] = useState<GrowEnvironment | null>(null);
  const [deletingEnvironment, setDeletingEnvironment] = useState<GrowEnvironment | null>(null);

  const { data, isLoading, error } = useGrowEnvironments();
  const { data: overviewData } = useEnvironmentOverview();
  const createMutation = useCreateGrowEnvironment();
  const updateMutation = useUpdateGrowEnvironment();
  const deleteMutation = useDeleteGrowEnvironment();

  const environments = data?.environments || [];

  // Create a map of environment IDs to capacity data for quick lookup
  const capacityMap = new Map(
    overviewData?.environments.map((env) => [
      env.id,
      {
        status: env.capacityStatus,
        currentPlants: env.currentPlants,
        maxPlants: env.maxPlants,
        utilizationPercent: env.utilizationPercent,
      },
    ]) || []
  );
  const handleCreate = async (formData: CreateGrowEnvironmentRequest | UpdateGrowEnvironmentRequest) => {
    try {
      await createMutation.mutateAsync(formData as CreateGrowEnvironmentRequest);
      toaster.create({
        title: "Environment created",
        description: `${formData.name} has been successfully created.`,
        type: "success",
        duration: 3000,
      });
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
  const handleUpdate = async (formData: UpdateGrowEnvironmentRequest) => {
    if (!editingEnvironment) return;

    try {
      await updateMutation.mutateAsync({ id: editingEnvironment.id, data: formData });
      toaster.create({
        title: "Environment updated",
        description: "Environment has been successfully updated.",
        type: "success",
        duration: 3000,
      });
      setEditingEnvironment(null);
    } catch (err) {
      toaster.create({
        title: "Error updating environment",
        description: err instanceof Error ? err.message : "An error occurred",
        type: "error",
        duration: 5000,
      });
    }
  };
  const handleDelete = async () => {
    if (!deletingEnvironment) return;

    try {
      await deleteMutation.mutateAsync(deletingEnvironment.id);
      toaster.create({
        title: "Environment deleted",
        description: `${deletingEnvironment.name} has been deleted.`,
        type: "success",
        duration: 3000,
      });
      setDeletingEnvironment(null);
    } catch (err) {
      toaster.create({
        title: "Error deleting environment",
        description: err instanceof Error ? err.message : "An error occurred",
        type: "error",
        duration: 5000,
      });
    }
  };
  if (isLoading) return <Box textAlign="center" py={8}><Spinner size="lg" /><Text mt={2}>Loading environments...</Text></Box>;
  if (error) return <Box textAlign="center" py={8} color="red.500"><Text>Error: {error.message}</Text></Box>;
  return (
    <Box>
      <HStack justify="space-between" mb={6}>
        <Heading size="lg">Grow Environments</Heading>
        <Button
          colorScheme="green"
          onClick={() => setIsCreateOpen(true)}
          data-testid="create-environment-button"
        >
          <Plus size={16} />
          <Text ml={2}>Create Environment</Text>
        </Button>
      </HStack>

      {environments.length === 0 ? (
        <Card.Root>
          <Card.Body textAlign="center" py={12}>
            <Tent size={48} style={{ margin: "0 auto", opacity: 0.5 }} />
            <Text mt={4} color="gray.500">
              No grow environments yet
            </Text>
            <Text fontSize="sm" color="gray.400">
              Create an environment to track your grow tents, rooms, or outdoor spaces.
            </Text>
            <Button
              mt={4}
              colorScheme="green"
              onClick={() => setIsCreateOpen(true)}
              data-testid="create-environment-empty-button"
            >
              Create Your First Environment
            </Button>
          </Card.Body>
        </Card.Root>
      ) : (
        <Grid
          templateColumns={{ base: "1fr", md: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }}
          gap={4}
        >
          {environments.map((env) => (
            <EnvironmentCard
              key={env.id}
              environment={env}
              onEdit={setEditingEnvironment}
              onDelete={setDeletingEnvironment}
              capacityStatus={capacityMap.get(env.id)}
            />
          ))}
        </Grid>
      )}

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

      {/* Edit Dialog */}
      <Dialog.Root
        open={!!editingEnvironment}
        onOpenChange={(e) => e.open ? undefined : setEditingEnvironment(null)}
        size="xl"
      >
        <Dialog.Backdrop bg="blackAlpha.600" />
        <Dialog.Positioner>
          <Dialog.Content bg="white" boxShadow="lg" borderRadius="lg">
            <Dialog.Header>Edit Environment</Dialog.Header>
            <Dialog.CloseTrigger />
            <Dialog.Body>
              {editingEnvironment && (
                <EnvironmentForm
                  onSubmit={handleUpdate}
                  initialData={editingEnvironment}
                  isLoading={updateMutation.isPending}
                  mode="edit"
                />
              )}
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      {/* Delete Confirmation Dialog */}
      <Dialog.Root
        open={!!deletingEnvironment}
        onOpenChange={(e) => e.open ? undefined : setDeletingEnvironment(null)}
        size="sm"
      >
        <Dialog.Backdrop bg="blackAlpha.600" />
        <Dialog.Positioner>
          <Dialog.Content bg="white" boxShadow="lg" borderRadius="lg">
            <Dialog.Header>Delete Environment</Dialog.Header>
            <Dialog.CloseTrigger />
            <Dialog.Body>
              <Text>
                Are you sure you want to delete <strong>{deletingEnvironment?.name}</strong>?
              </Text>
              <Text mt={2} fontSize="sm" color="gray.600">
                Any grows assigned to this environment will remain but will no longer be associated
                with an environment.
              </Text>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="ghost" mr={3} onClick={() => setDeletingEnvironment(null)}>
                Cancel
              </Button>
              <Button
                colorScheme="red"
                onClick={handleDelete}
                loading={deleteMutation.isPending}
                data-testid="confirm-delete-button"
              >
                Delete
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Box>
  );
};