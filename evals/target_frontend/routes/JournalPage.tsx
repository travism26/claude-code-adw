"use client"

import { useLocation } from "react-router-dom"
import { Box, Heading, Text, VStack } from "@chakra-ui/react"
import type { Plant } from "../types"

export function JournalPage() {
  const location = useLocation()
  const plant = location.state?.plant as Plant | undefined

  return (
    <Box textAlign="center" py={12}>
      <VStack gap={4}>
        <Heading size="lg">Journal Feature</Heading>
        {plant && (
          <Text color="gray.600">Viewing journal for: {plant.name}</Text>
        )}
        <Text color="gray.600">Journal functionality coming soon!</Text>
      </VStack>
    </Box>
  )
}
