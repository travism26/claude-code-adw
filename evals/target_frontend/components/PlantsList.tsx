"use client"

import React from "react"
import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  HStack,
  Image,
  Menu,
  SimpleGrid,
  Skeleton,
  SkeletonText,
  Text,
  VStack,
  IconButton,
  Alert,
} from "@chakra-ui/react"
import { Leaf, MapPin, Calendar, MoreVertical, Edit, Trash2 } from "lucide-react"
import { usePlants } from "../hooks/usePlants"
import type { Plant } from "../types"

interface PlantCardProps {
  plant: Plant
  onEdit: (plant: Plant) => void
  onDelete: (plantId: string) => void
  onView: (plant: Plant) => void
}

const PlantCard: React.FC<PlantCardProps> = ({ plant, onEdit, onDelete, onView }) => {
  return (
    <Card.Root overflow="hidden" variant="outline">
      {plant.photo_url && (
        <Image src={plant.photo_url || "/placeholder.svg"} alt={plant.name} width="100%" height="128px" objectFit="cover" />
      )}

      <Card.Body>
        <Flex alignItems="flex-start" justifyContent="space-between" mb={2}>
          <Box>
            <Heading as="h3" size="sm" fontWeight="semibold" color="gray.900">
              {plant.name}
            </Heading>
            {plant.species && (
              <Text fontSize="sm" color="gray.500" fontStyle="italic">
                {plant.species}
              </Text>
            )}
          </Box>

          <Menu.Root>
            <Menu.Trigger asChild>
              <IconButton
                aria-label="Options"
                variant="ghost"
                size="sm"
                color="gray.400"
                _hover={{ color: "gray.600" }}
              >
                <MoreVertical size={16} />
              </IconButton>
            </Menu.Trigger>
            <Menu.Content minW="32">
              <Menu.Item value="edit" onClick={() => onEdit(plant)} fontSize="sm">
                <Edit size={12} />
                Edit
              </Menu.Item>
              <Menu.Item value="delete" onClick={() => onDelete(plant.id)} fontSize="sm" color="red.600" _hover={{ bg: "red.50" }}>
                <Trash2 size={12} />
                Delete
              </Menu.Item>
            </Menu.Content>
          </Menu.Root>
        </Flex>

        <VStack gap={2} alignItems="flex-start">
          <HStack gap={2}>
            <MapPin size={12} />
            <Text fontSize="sm" color="gray.600" textTransform="capitalize">
              {plant.type}
            </Text>
          </HStack>

          <HStack gap={2}>
            <Calendar size={12} />
            <Text fontSize="sm" color="gray.600">
              Water every {plant.water_interval_days} days
            </Text>
          </HStack>

          {plant.fert_interval_days && (
            <HStack gap={2}>
              <Leaf size={12} />
              <Text fontSize="sm" color="gray.600">
                Fertilize every {plant.fert_interval_days} days
              </Text>
            </HStack>
          )}
        </VStack>

        <Button onClick={() => onView(plant)} width="100%" mt={3} colorScheme="green" size="md">
          View Details
        </Button>
      </Card.Body>
    </Card.Root>
  )
}

interface PlantsListProps {
  onAddPlant: () => void
  onEditPlant: (plant: Plant) => void
  onViewPlant: (plant: Plant) => void
}

export const PlantsList: React.FC<PlantsListProps> = ({ onAddPlant, onEditPlant, onViewPlant }) => {
  const { plants, isLoading, error, deletePlant } = usePlants()

  const handleDelete = async (plantId: string) => {
    if (window.confirm("Are you sure you want to delete this plant?")) {
      try {
        await deletePlant(plantId)
      } catch {
        // Error handled by usePlants hook
      }
    }
  }

  if (isLoading) {
    return (
      <VStack gap={4} align="stretch">
        {[1, 2, 3].map((i) => (
          <Card.Root key={i} p={4}>
            <Skeleton height="128px" mb={4} />
            <SkeletonText noOfLines={1} width="75%" mb={2} />
            <SkeletonText noOfLines={1} width="50%" />
          </Card.Root>
        ))}
      </VStack>
    )
  }

  if (error) {
    return (
      <Alert.Root status="error" borderRadius="lg">
        <Alert.Indicator />
        <Alert.Title>{String(error)}</Alert.Title>
      </Alert.Root>
    )
  }

  if (!plants || plants.length === 0) {
    return (
      <VStack gap={4} py={12} textAlign="center">
        <Box color="gray.300">
          <Leaf size={64} />
        </Box>
        <Heading as="h3" size="md" fontWeight="medium" color="gray.900">
          No plants yet
        </Heading>
        <Text color="gray.500">Add your first plant to get started!</Text>
        <Button onClick={onAddPlant} colorScheme="green" size="lg" px={6}>
          Add Your First Plant
        </Button>
      </VStack>
    )
  }

  return (
    <VStack gap={4} align="stretch">
      <Flex alignItems="center" justifyContent="space-between">
        <Heading as="h2" size="lg" fontWeight="semibold" color="gray.900">
          My Plants ({plants?.length || 0})
        </Heading>
        <Button onClick={onAddPlant} colorScheme="green" size="md">
          Add Plant
        </Button>
      </Flex>

      <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} gap={4}>
        {plants?.map((plant) => (
          <PlantCard key={plant.id} plant={plant} onEdit={onEditPlant} onDelete={handleDelete} onView={onViewPlant} />
        ))}
      </SimpleGrid>
    </VStack>
  )
}
