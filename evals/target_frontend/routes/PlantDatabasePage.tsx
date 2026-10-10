"use client"

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, BookOpen } from "lucide-react"
import { Box, VStack, Flex, IconButton, Heading, Text } from "@chakra-ui/react"
import { PlantProfileSelector } from "../components/PlantProfileSelector"
import { useUserZone } from "../hooks/useZone"
import type { PlantProfile } from "../types"

export function PlantDatabasePage() {
  const navigate = useNavigate()
  const { data: userZone } = useUserZone()
  const [selectedProfile, setSelectedProfile] = useState<PlantProfile | null>(null)

  const handleSelectProfile = (profile: PlantProfile) => {
    setSelectedProfile(profile)
    // TODO: Navigate to add plant page with the selected profile
  }

  return (
    <VStack gap={6} align="stretch">
      <Flex align="center" gap={3}>
        <IconButton
          aria-label="Go back"
          onClick={() => navigate("/")}
          variant="ghost"
          size="md"
        >
          <ArrowLeft className="h-5 w-5" />
        </IconButton>
        <Box>
          <Heading size="xl" display="flex" alignItems="center" gap={2}>
            <Box as={BookOpen} boxSize="6" color="green.600" />
            Plant Database
          </Heading>
          <Text fontSize="sm" color="gray.600" mt={1}>
            Browse our collection of plants and add them to your garden
          </Text>
        </Box>
      </Flex>

      <PlantProfileSelector
        onSelect={handleSelectProfile}
        selectedProfileId={selectedProfile?.id}
        userZone={userZone?.zone}
      />
    </VStack>
  )
}
