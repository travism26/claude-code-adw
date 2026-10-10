"use client";

import React, { useState } from "react";
import {
  Box,
  Button,
  Flex,
  Grid,
  Heading,
  HStack,
  Icon as ChakraIcon,
  IconButton,
  Skeleton,
  Text,
  VStack,
} from "@chakra-ui/react";
import { Edit2, Grid3x3, Plus, Trash2 } from "lucide-react";
import { useGardens, useDeleteGarden } from "../hooks/useGardens";
import { useNavigate } from "react-router-dom";
import { CreateGardenModal } from "./CreateGardenModal";
import { EditGardenModal } from "./EditGardenModal";
import type { Garden } from "../types";
import { toaster } from "./ChakraProvider";

export const GardenList: React.FC = () => {
  const { data: gardens, isLoading } = useGardens();
  const deleteGardenMutation = useDeleteGarden();
  const navigate = useNavigate();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingGarden, setEditingGarden] = useState<Garden | null>(null);

  const handleDeleteGarden = async (gardenId: string, gardenName: string) => {
    if (!confirm(`Are you sure you want to delete "${gardenName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteGardenMutation.mutateAsync(gardenId);
      toaster.create({
        title: "Garden deleted",
        description: `${gardenName} has been removed.`,
        type: "success",
        duration: 3000,
      });
    } catch (error) {
      toaster.create({
        title: "Error deleting garden",
        description: error instanceof Error ? error.message : "An error occurred",
        type: "error",
        duration: 5000,
      });
    }
  };

  const handleViewGarden = (gardenId: string) => {
    navigate(`/garden-planner/${gardenId}`);
  };

  if (isLoading) {
    return (
      <VStack gap={4} align="stretch">
        <Skeleton height="120px" rounded="lg" />
        <Skeleton height="120px" rounded="lg" />
        <Skeleton height="120px" rounded="lg" />
      </VStack>
    );
  }

  if (!gardens || gardens.length === 0) {
    return (
      <Box textAlign="center" py={12}>
        <ChakraIcon as={Grid3x3} boxSize={16} color="gray.400" mx="auto" mb={4} />
        <Heading size="md" color="gray.600" mb={2}>
          No gardens yet
        </Heading>
        <Text color="gray.500" mb={6}>
          Create your first garden to start planning your layout
        </Text>
        <Button
          onClick={() => setIsCreateModalOpen(true)}
          colorScheme="green"
          size="lg"
        >
          <ChakraIcon as={Plus} mr={2} />
          Create Garden
        </Button>
        <CreateGardenModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
        />
      </Box>
    );
  }

  return (
    <VStack gap={6} align="stretch">
      <Flex justify="space-between" align="center">
        <Heading size="lg">My Gardens</Heading>
        <Button
          onClick={() => setIsCreateModalOpen(true)}
          colorScheme="green"
        >
          <ChakraIcon as={Plus} mr={2} />
          New Garden
        </Button>
      </Flex>

      <Grid
        templateColumns={{ base: "1fr", md: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }}
        gap={6}
      >
        {gardens.map((garden) => (
          <Box
            key={garden.id}
            p={6}
            rounded="lg"
            borderWidth="1px"
            borderColor="gray.200"
            bg="white"
            shadow="sm"
            _hover={{ shadow: "md", borderColor: "green.300" }}
            transition="all 0.2s"
            cursor="pointer"
            onClick={() => handleViewGarden(garden.id)}
          >
            <VStack align="stretch" gap={3}>
              <Flex justify="space-between" align="start">
                <Heading size="md" color="gray.900">
                  {garden.name}
                </Heading>
                <HStack gap={1} onClick={(e) => e.stopPropagation()}>
                  <IconButton
                    aria-label="Edit garden"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingGarden(garden);
                    }}
                  >
                    <ChakraIcon as={Edit2} boxSize={4} />
                  </IconButton>
                  <IconButton
                    aria-label="Delete garden"
                    variant="ghost"
                    size="sm"
                    colorScheme="red"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteGarden(garden.id, garden.name);
                    }}
                  >
                    <ChakraIcon as={Trash2} boxSize={4} />
                  </IconButton>
                </HStack>
              </Flex>

              <VStack align="stretch" gap={1}>
                <Text fontSize="sm" color="gray.600">
                  <strong>Dimensions:</strong> {garden.width} × {garden.height} ft
                </Text>
                {garden.zone && (
                  <Text fontSize="sm" color="gray.600">
                    <strong>Zone:</strong> {garden.zone}
                  </Text>
                )}
                <Text fontSize="sm" color="gray.600">
                  <strong>Plots:</strong> {garden.plots?.length || 0}
                </Text>
              </VStack>

              {garden.notes && (
                <Text fontSize="sm" color="gray.500" lineClamp={2}>
                  {garden.notes}
                </Text>
              )}

              <Text fontSize="xs" color="gray.400">
                Updated {new Date(garden.updated_at).toLocaleDateString()}
              </Text>
            </VStack>
          </Box>
        ))}
      </Grid>

      <CreateGardenModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      {editingGarden && (
        <EditGardenModal
          isOpen={!!editingGarden}
          onClose={() => setEditingGarden(null)}
          garden={editingGarden}
        />
      )}
    </VStack>
  );
};
