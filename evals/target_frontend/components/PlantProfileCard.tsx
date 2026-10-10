"use client"

import type React from "react"
import { Box, Flex, Text, Badge, Grid, VStack, Card } from "@chakra-ui/react"
import type { PlantProfile } from "../types"
import { Leaf, Sun, Droplet, Calendar, Check } from "lucide-react"

interface PlantProfileCardProps {
  profile: PlantProfile
  onSelect?: (profile: PlantProfile) => void
  selected?: boolean
}

export const PlantProfileCard: React.FC<PlantProfileCardProps> = ({ profile, onSelect, selected }) => {
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return { bg: "green.100", color: "green.800", borderColor: "green.200" }
      case "medium":
        return { bg: "yellow.100", color: "yellow.800", borderColor: "yellow.200" }
      case "hard":
        return { bg: "red.100", color: "red.800", borderColor: "red.200" }
      default:
        return { bg: "gray.100", color: "gray.800", borderColor: "gray.200" }
    }
  }

  const getSunlightIcon = (sunlight: string) => {
    if (sunlight.includes("full")) return <Box as={Sun} boxSize="4" color="yellow.500" />
    if (sunlight.includes("partial")) return <Box as={Sun} boxSize="4" color="yellow.400" />
    return <Box as={Sun} boxSize="4" color="gray.400" />
  }

  const difficultyColors = getDifficultyColor(profile.difficulty || "medium")

  return (
    <Card.Root
      cursor="pointer"
      transition="all 0.2s"
      _hover={{ shadow: "md", transform: "translateY(-2px)" }}
      border={selected ? "2px" : "1px"}
      borderColor={selected ? "green.500" : "gray.200"}
      bg={selected ? "green.50" : "white"}
      onClick={() => onSelect?.(profile)}
      position="relative"
      data-testid={selected ? "plant-card-selected" : "plant-card"}
    >
      {selected && (
        <Box
          position="absolute"
          top={2}
          right={2}
          bg="green.500"
          color="white"
          borderRadius="full"
          p={1}
          boxSize={6}
          display="flex"
          alignItems="center"
          justifyContent="center"
          zIndex={1}
          transition="all 0.2s"
        >
          <Box as={Check} boxSize="4" />
        </Box>
      )}
      <Card.Header pb={3}>
        <Flex align="flex-start" justify="space-between">
          <Box flex="1">
            <Text fontSize="lg" fontWeight="semibold">{profile.common_name || profile.name}</Text>
            {profile.species && (
              <Text fontSize="sm" fontStyle="italic" color="gray.600">{profile.species}</Text>
            )}
          </Box>
          <Badge
            bg={difficultyColors.bg}
            color={difficultyColors.color}
            borderColor={difficultyColors.borderColor}
            borderWidth="1px"
          >
            {profile.difficulty || "medium"}
          </Badge>
        </Flex>
      </Card.Header>
      <Card.Body>
        <VStack gap={3} align="stretch">
          <Flex flexWrap="wrap" gap={2}>
            <Badge variant="outline" fontSize="xs">
              <Flex align="center" gap={1}>
                <Box as={Leaf} boxSize="3" />
                {profile.type}
              </Flex>
            </Badge>
            {profile.indoor_outdoor === "indoor" && (
              <Badge variant="outline" fontSize="xs" bg="blue.50" color="blue.700" borderColor="blue.200">
                Indoor
              </Badge>
            )}
            {profile.indoor_outdoor === "outdoor" && (
              <Badge variant="outline" fontSize="xs" bg="green.50" color="green.700" borderColor="green.200">
                Outdoor
              </Badge>
            )}
            {profile.indoor_outdoor === "both" && (
              <Badge variant="outline" fontSize="xs" bg="purple.50" color="purple.700" borderColor="purple.200">
                Indoor/Outdoor
              </Badge>
            )}
          </Flex>

          <Grid templateColumns="repeat(2, 1fr)" gap={2} fontSize="sm">
            <Flex align="center" gap={2} color="gray.600">
              {getSunlightIcon(profile.sunlight_requirements || "")}
              <Text fontSize="xs">{profile.sunlight_requirements || "Unknown"}</Text>
            </Flex>
            <Flex align="center" gap={2} color="gray.600">
              <Box as={Droplet} boxSize="4" color="blue.500" />
              <Text fontSize="xs">Every {profile.default_water_interval_days}d</Text>
            </Flex>
          </Grid>

          {(profile.zone_min || profile.zone_max) && (
            <Flex align="center" gap={2} fontSize="sm" color="gray.600" pt={2} borderTop="1px" borderColor="gray.200">
              <Box as={Calendar} boxSize="4" />
              <Text fontSize="xs">
                Zones {profile.zone_min || "?"}-{profile.zone_max || "?"}
              </Text>
            </Flex>
          )}

          {profile.description && (
            <Text fontSize="xs" color="gray.600" lineClamp={2} pt={2}>{profile.description}</Text>
          )}
        </VStack>
      </Card.Body>
    </Card.Root>
  )
}
