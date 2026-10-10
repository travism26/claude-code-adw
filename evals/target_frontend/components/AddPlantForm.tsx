"use client"

import type React from "react"
import { useState } from "react"
import { ArrowLeft, Camera, BookOpen } from "lucide-react"
import {
  Box,
  VStack,
  HStack,
  Flex,
  Button,
  Input,
  NativeSelectRoot,
  NativeSelectField,
  Field,
  IconButton,
  Text,
  Heading,
  Alert,
  Grid,
  GridItem,
} from "@chakra-ui/react"
import { usePlants } from "../hooks/usePlants"
import { useUserZone } from "../hooks/useZone"
import { PlantProfileSelector } from "./PlantProfileSelector"
import type { CreatePlantRequest, PlantProfile } from "../types"

interface AddPlantFormProps {
  onBack: () => void
  onSuccess: () => void
}

export const AddPlantForm: React.FC<AddPlantFormProps> = ({ onBack, onSuccess }) => {
  const { createPlant, isLoading, error } = usePlants()
  const { data: userZone } = useUserZone()
  const [useDatabase, setUseDatabase] = useState(true)
  const [selectedProfile, setSelectedProfile] = useState<PlantProfile | null>(null)
  const [formData, setFormData] = useState<CreatePlantRequest>({
    name: "",
    type: "indoor",
    water_interval_days: 7,
    fert_interval_days: 14,
    species: "",
    photo_url: "",
  })

  const handleProfileSelect = (profile: PlantProfile) => {
    setSelectedProfile(profile)
    setFormData((prev) => ({
      ...prev,
      name: profile.common_name || profile.name,
      species: profile.species || "",
      type: profile.indoor_outdoor === "both" ? "outdoor" : (profile.indoor_outdoor as "indoor" | "outdoor"),
      water_interval_days: profile.default_water_interval_days || 7,
      fert_interval_days: profile.default_fert_interval_days || 14,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const plantData = {
        ...formData,
        plant_profile_id: selectedProfile?.id,
        fert_interval_days: formData.fert_interval_days || undefined,
        species: formData.species || undefined,
        photo_url: formData.photo_url || undefined,
      }

      await createPlant(plantData)
      onSuccess()
    } catch {
      // Error handled by usePlants hook
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name.includes("interval") ? Number.parseInt(value) || 0 : value,
    }))
  }

  return (
    <VStack gap={6} align="stretch">
      <HStack gap={3}>
        <IconButton
          aria-label="Go back"
          onClick={onBack}
          variant="ghost"
          colorScheme="gray"
          size="md"
        >
          <ArrowLeft size={20} />
        </IconButton>
        <Heading as="h2" size="lg" color="gray.900">
          Add New Plant
        </Heading>
      </HStack>

      {error && (
        <Alert.Root status="error" borderRadius="lg">
          <Alert.Indicator />
          <Alert.Title>{String(error)}</Alert.Title>
        </Alert.Root>
      )}

      <Box borderBottom="1px" borderColor="gray.200">
        <HStack gap={2}>
          <Button
            variant="ghost"
            onClick={() => setUseDatabase(true)}
            px={4}
            py={2}
            fontWeight="medium"
            color={useDatabase ? "green.600" : "gray.500"}
            borderBottom={useDatabase ? "2px" : "none"}
            borderColor="green.600"
            borderRadius={0}
            _hover={{
              color: useDatabase ? "green.600" : "gray.700",
            }}
          >
            <BookOpen size={16} style={{ display: "inline", marginRight: "8px" }} />
            Browse Plant Database
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setUseDatabase(false)
              setSelectedProfile(null)
            }}
            px={4}
            py={2}
            fontWeight="medium"
            color={!useDatabase ? "green.600" : "gray.500"}
            borderBottom={!useDatabase ? "2px" : "none"}
            borderColor="green.600"
            borderRadius={0}
            _hover={{
              color: !useDatabase ? "green.600" : "gray.700",
            }}
          >
            Manual Entry
          </Button>
        </HStack>
      </Box>

      {useDatabase ? (
        <VStack gap={4} align="stretch">
          <PlantProfileSelector
            onSelect={handleProfileSelect}
            selectedProfileId={selectedProfile?.id}
            userZone={userZone?.zone}
          />
          {selectedProfile && (
            <Box bg="green.50" borderWidth="1px" borderColor="green.200" borderRadius="lg" p={4}>
              <Text fontSize="sm" color="green.800" fontWeight="medium" mb={2}>
                Selected: {selectedProfile.common_name}
              </Text>
              <Text fontSize="xs" color="green.700">
                You can customize the plant details below before adding it to your garden.
              </Text>
            </Box>
          )}
        </VStack>
      ) : null}

      {(selectedProfile || !useDatabase) && (
        <Box as="form" onSubmit={handleSubmit}>
          <VStack gap={6} align="stretch">
            <Box bg="white" borderRadius="lg" p={6} shadow="sm" borderWidth="1px" borderColor="gray.200">
              <VStack gap={4} align="stretch">
                <Field.Root required>
                  <Field.Label htmlFor="name" fontSize="sm" fontWeight="medium" color="gray.700">
                    Plant Name *
                  </Field.Label>
                  <Input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g., My Monstera"
                  />
                </Field.Root>

                <Field.Root>
                  <Field.Label htmlFor="species" fontSize="sm" fontWeight="medium" color="gray.700">
                    Species (Optional)
                  </Field.Label>
                  <Input
                    type="text"
                    id="species"
                    name="species"
                    value={formData.species}
                    onChange={handleInputChange}
                    placeholder="e.g., Monstera deliciosa"
                  />
                </Field.Root>

                <Field.Root required>
                  <Field.Label htmlFor="type" fontSize="sm" fontWeight="medium" color="gray.700">
                    Plant Type *
                  </Field.Label>
                  <NativeSelectRoot>
                    <NativeSelectField
                      id="type"
                      name="type"
                      value={formData.type}
                      onChange={handleInputChange}
                    >
                      <option value="indoor">Indoor</option>
                      <option value="outdoor">Outdoor</option>
                    </NativeSelectField>
                  </NativeSelectRoot>
                </Field.Root>

                <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                  <GridItem>
                    <Field.Root required>
                      <Field.Label htmlFor="water_interval_days" fontSize="sm" fontWeight="medium" color="gray.700">
                        Water Every (days) *
                      </Field.Label>
                      <Input
                        type="number"
                        id="water_interval_days"
                        name="water_interval_days"
                        value={formData.water_interval_days}
                        onChange={handleInputChange}
                        min={1}
                        max={365}
                          />
                    </Field.Root>
                  </GridItem>

                  <GridItem>
                    <Field.Root>
                      <Field.Label htmlFor="fert_interval_days" fontSize="sm" fontWeight="medium" color="gray.700">
                        Fertilize Every (days)
                      </Field.Label>
                      <Input
                        type="number"
                        id="fert_interval_days"
                        name="fert_interval_days"
                        value={formData.fert_interval_days || ""}
                        onChange={handleInputChange}
                        min={1}
                        max={365}
                        placeholder="Optional"
                          />
                    </Field.Root>
                  </GridItem>
                </Grid>

                <Field.Root>
                  <Field.Label htmlFor="photo_url" fontSize="sm" fontWeight="medium" color="gray.700">
                    Photo URL (Optional)
                  </Field.Label>
                  <HStack gap={2}>
                    <Input
                      type="url"
                      id="photo_url"
                      name="photo_url"
                      value={formData.photo_url}
                      onChange={handleInputChange}
                      placeholder="https://example.com/photo.jpg"
                        flex={1}
                    />
                    <IconButton
                      aria-label="Upload photo"
                      variant="outline"
                      colorScheme="gray"
                      _hover={{ bg: "gray.50" }}
                    >
                      <Camera size={16} />
                    </IconButton>
                  </HStack>
                </Field.Root>
              </VStack>
            </Box>

            <HStack gap={3}>
              <Button
                type="button"
                onClick={onBack}
                flex={1}
                variant="outline"
                colorScheme="gray"
                py={6}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={isLoading}
                loadingText="Adding..."
                flex={1}
                colorScheme="green"
                py={6}
              >
                Add Plant
              </Button>
            </HStack>
          </VStack>
        </Box>
      )}
    </VStack>
  )
}
