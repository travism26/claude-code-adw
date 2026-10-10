"use client"

import type React from "react"
import { useState, useMemo } from "react"
import {
  Box,
  VStack,
  HStack,
  Flex,
  Input,
  InputGroup,
  NativeSelectRoot,
  NativeSelectField,
  Button,
  Field,
  Text,
  Grid,
  Badge,
  Spinner,
  Alert,
  IconButton,
} from "@chakra-ui/react"
import { Search, Filter, X } from "lucide-react"
import { usePlantProfiles } from "../hooks/usePlantProfiles"
import { PlantProfileCard } from "./PlantProfileCard"
import type { PlantProfile, PlantProfileFilters } from "../types"

interface PlantProfileSelectorProps {
  onSelect: (profile: PlantProfile) => void
  selectedProfileId?: string
  userZone?: number
}

export const PlantProfileSelector: React.FC<PlantProfileSelectorProps> = ({
  onSelect,
  selectedProfileId,
  userZone,
}) => {
  const [searchQuery, setSearchQuery] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<PlantProfileFilters>({
    zone: userZone,
  })

  const { data: response, isLoading, error } = usePlantProfiles(filters)

  const filteredProfiles = useMemo(() => {
    if (!response?.plantProfiles) return []
    if (!searchQuery) return response.plantProfiles

    const query = searchQuery.toLowerCase()
    return response.plantProfiles.filter(
      (profile: PlantProfile) =>
        profile.common_name?.toLowerCase().includes(query) ||
        profile.name?.toLowerCase().includes(query) ||
        profile.species?.toLowerCase().includes(query) ||
        profile.type?.toLowerCase().includes(query)
    )
  }, [response, searchQuery])

  const handleFilterChange = (key: keyof PlantProfileFilters, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
    }))
  }

  const clearFilters = () => {
    setFilters({ zone: userZone })
    setSearchQuery("")
  }

  const activeFilterCount = Object.values(filters).filter((v) => v !== undefined && v !== "").length

  return (
    <VStack gap={4} align="stretch">
      <Flex gap={2}>
        <Box flex="1" position="relative">
          <InputGroup startElement={<Box as={Search} boxSize="4" color="gray.400" />}>
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search plants..."
            />
          </InputGroup>
        </Box>
        <Button
          onClick={() => setShowFilters(!showFilters)}
          bg={showFilters ? "green.50" : "white"}
          borderColor={showFilters ? "green.500" : "gray.300"}
          color={showFilters ? "green.700" : "gray.700"}
          borderWidth="1px"
          _hover={{ bg: showFilters ? "green.100" : "gray.50" }}
        >
          <Box as={Filter} boxSize="4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge ml={2} bg="green.600" color="white">{activeFilterCount}</Badge>
          )}
        </Button>
        {activeFilterCount > 0 && (
          <IconButton
            aria-label="Clear filters"
            onClick={clearFilters}
            color="gray.600"
            variant="ghost"
            _hover={{ color: "gray.900" }}
            title="Clear filters"
          >
            <Box as={X} boxSize="5" />
          </IconButton>
        )}
      </Flex>

      {showFilters && (
        <Box bg="gray.50" border="1px" borderColor="gray.200" borderRadius="lg" p={4}>
          <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={3}>
            <Field.Root>
              <Field.Label fontSize="sm" fontWeight="medium" color="gray.700" mb={1}>Plant Type</Field.Label>
              <NativeSelectRoot fontSize="sm">
                <NativeSelectField
                  value={filters.type || ""}
                  onChange={(e) => handleFilterChange("type", e.target.value)}
                >
                  <option value="">All Types</option>
                  <option value="vegetable">Vegetable</option>
                  <option value="herb">Herb</option>
                  <option value="flower">Flower</option>
                  <option value="houseplant">Houseplant</option>
                  <option value="fruit">Fruit</option>
                  <option value="tree">Tree</option>
                </NativeSelectField>
              </NativeSelectRoot>
            </Field.Root>

            <Field.Root>
              <Field.Label fontSize="sm" fontWeight="medium" color="gray.700" mb={1}>Difficulty</Field.Label>
              <NativeSelectRoot fontSize="sm">
                <NativeSelectField
                  value={filters.difficulty || ""}
                  onChange={(e) => handleFilterChange("difficulty", e.target.value)}
                >
                  <option value="">All Levels</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </NativeSelectField>
              </NativeSelectRoot>
            </Field.Root>

            <Field.Root>
              <Field.Label fontSize="sm" fontWeight="medium" color="gray.700" mb={1}>
                Zone {userZone && `(Your zone: ${userZone})`}
              </Field.Label>
              <NativeSelectRoot fontSize="sm">
                <NativeSelectField
                  value={filters.zone || ""}
                  onChange={(e) => handleFilterChange("zone", e.target.value ? Number.parseInt(e.target.value) : undefined)}
                >
                  <option value="">All Zones</option>
                  {Array.from({ length: 13 }, (_, i) => i + 1).map((zone) => (
                    <option key={zone} value={zone}>
                      Zone {zone}
                    </option>
                  ))}
                </NativeSelectField>
              </NativeSelectRoot>
            </Field.Root>
          </Grid>
        </Box>
      )}

      {isLoading ? (
        <Flex align="center" justify="center" py={12}>
          <Spinner size="xl" color="gray.400" />
        </Flex>
      ) : error ? (
        <Alert.Root status="error" borderRadius="lg">
          <Alert.Indicator />
          <Alert.Title>Failed to load plant profiles. Please try again.</Alert.Title>
        </Alert.Root>
      ) : filteredProfiles.length === 0 ? (
        <Box textAlign="center" py={12}>
          <Text color="gray.500">No plants found matching your criteria.</Text>
          <Button
            onClick={clearFilters}
            mt={4}
            color="green.600"
            variant="plain"
            fontWeight="medium"
            _hover={{ color: "green.700" }}
          >
            Clear filters
          </Button>
        </Box>
      ) : (
        <>
          <Flex align="center" justify="space-between">
            <Text fontSize="sm" color="gray.600">
              Showing {filteredProfiles.length} {filteredProfiles.length === 1 ? "plant" : "plants"}
            </Text>
          </Flex>
          <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }} gap={4}>
            {filteredProfiles.map((profile) => (
              <PlantProfileCard
                key={profile.id}
                profile={profile}
                onSelect={onSelect}
                selected={profile.id === selectedProfileId}
              />
            ))}
          </Grid>
        </>
      )}
    </VStack>
  )
}
