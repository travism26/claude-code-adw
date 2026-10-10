"use client"

import type React from "react"
import { useMemo } from "react"
import {
  Box,
  VStack,
  HStack,
  Text,
  Spinner,
  Alert,
  Card,
  CardHeader,
  CardBody,
  Heading,
  Badge,
  Flex,
} from "@chakra-ui/react"
import { Lightbulb, Calendar } from "lucide-react"
import { useSeasonalTips } from "../hooks/useSeasonalTips"
import { useUserZone } from "../hooks/useZone"

interface SeasonalTipsProps {
  zone?: number
  season?: "spring" | "summer" | "fall" | "winter"
  compact?: boolean
}

const getCurrentSeason = (): "spring" | "summer" | "fall" | "winter" => {
  const month = new Date().getMonth()
  if (month >= 2 && month <= 4) return "spring"
  if (month >= 5 && month <= 7) return "summer"
  if (month >= 8 && month <= 10) return "fall"
  return "winter"
}

const getSeasonColorScheme = (season: string): string => {
  switch (season) {
    case "spring":
      return "green"
    case "summer":
      return "yellow"
    case "fall":
      return "orange"
    case "winter":
      return "blue"
    default:
      return "gray"
  }
}

export const SeasonalTips: React.FC<SeasonalTipsProps> = ({ zone, season, compact = false }) => {
  const { data: userZone } = useUserZone()
  const currentSeason = season || getCurrentSeason()
  const effectiveZone = zone || userZone?.zone

  const { data: response, isLoading, error } = useSeasonalTips(effectiveZone, currentSeason)

  const tips = response?.tips || []

  const groupedTips = useMemo(() => {
    const currentTips = response?.tips || []
    if (!currentTips || currentTips.length === 0) return {}
    return currentTips.reduce((acc: Record<string, typeof currentTips>, tip) => {
      const plantName = (tip as any).plant_profile?.common_name || "Unknown"
      if (!acc[plantName]) {
        acc[plantName] = []
      }
      acc[plantName].push(tip)
      return acc
    }, {} as Record<string, typeof currentTips>)
  }, [response])

  if (isLoading) {
    return (
      <Flex align="center" justify="center" py={8}>
        <Spinner size="md" color="gray.400" />
      </Flex>
    )
  }

  if (error) {
    return (
      <Alert.Root status="error" borderRadius="md">
        <Alert.Indicator />
        <Alert.Title fontSize="sm">Failed to load seasonal tips</Alert.Title>
      </Alert.Root>
    )
  }

  if (!tips || tips.length === 0) {
    return (
      <VStack py={8} gap={3}>
        <Box as={Lightbulb} boxSize={12} color="gray.300" />
        <Text color="gray.500">No seasonal tips available</Text>
        {!effectiveZone && (
          <Text fontSize="sm" color="gray.400">
            Set your growing zone to see personalized tips
          </Text>
        )}
      </VStack>
    )
  }

  if (compact) {
    return (
      <VStack gap={3} align="stretch">
        {tips.slice(0, 3).map((tip) => (
          <Box key={tip.id} borderLeftWidth={4} borderLeftColor="green.500" pl={3} py={2}>
            <Text fontSize="sm" fontWeight="medium" color="gray.900">
              {(tip as any).plant_profile?.common_name || 'General'}
            </Text>
            <Text fontSize="sm" color="gray.600" mt={1}>
              {tip.tip}
            </Text>
          </Box>
        ))}
        {tips.length > 3 && (
          <Text fontSize="xs" color="gray.500" textAlign="center" pt={2}>
            +{tips.length - 3} more tips
          </Text>
        )}
      </VStack>
    )
  }

  return (
    <Card.Root>
      <Card.Header>
        <Flex justify="space-between" align="flex-start">
          <Box>
            <HStack gap={2} mb={1}>
              <Box as={Lightbulb} boxSize={5} color="yellow.500" />
              <Heading size="md">Seasonal Growing Tips</Heading>
            </HStack>
            <Text fontSize="sm" color="gray.600">
              {effectiveZone
                ? `Personalized tips for Zone ${effectiveZone}`
                : "Set your zone for personalized tips"}
            </Text>
          </Box>
          <Badge colorScheme={getSeasonColorScheme(currentSeason)}>
            <HStack gap={1}>
              <Box as={Calendar} boxSize={3} />
              <Text>{currentSeason.charAt(0).toUpperCase() + currentSeason.slice(1)}</Text>
            </HStack>
          </Badge>
        </Flex>
      </Card.Header>
      <Card.Body>
        <VStack gap={6} align="stretch">
          {Object.entries(groupedTips).map(([plantName, plantTips]) => (
            <VStack key={plantName} gap={2} align="stretch">
              <HStack gap={2}>
                <Heading size="sm" color="gray.900">
                  {plantName}
                </Heading>
                <Badge variant="outline" fontSize="xs">
                  {plantTips.length} {plantTips.length === 1 ? "tip" : "tips"}
                </Badge>
              </HStack>
              <VStack gap={2} align="stretch">
                {plantTips.map((tip) => (
                  <Box
                    key={tip.id}
                    borderLeftWidth={4}
                    borderLeftColor="green.500"
                    pl={4}
                    py={2}
                    bg="green.50"
                    opacity={0.9}
                  >
                    <Text fontSize="sm" color="gray.700">
                      {tip.tip}
                    </Text>
                    {(tip as any).applies_to_zones && (
                      <Text fontSize="xs" color="gray.500" mt={1}>
                        Zones: {(tip as any).applies_to_zones}
                      </Text>
                    )}
                  </Box>
                ))}
              </VStack>
            </VStack>
          ))}
        </VStack>
      </Card.Body>
    </Card.Root>
  )
}
