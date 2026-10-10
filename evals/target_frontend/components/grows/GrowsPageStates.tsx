/**
 * GrowsPageStates Component
 *
 * Loading, error, and empty states for the grows page
 */

import React from "react";
import { Box, Grid, Heading, Text, VStack, Skeleton } from "@chakra-ui/react";
import { Search, Sprout } from "lucide-react";
import { GrowsNavigation } from "./GrowsNavigation";

interface GrowsLoadingStateProps {}

export function GrowsLoadingState({}: GrowsLoadingStateProps) {
  return (
    <Box maxW="1400px" mx="auto" px={{ base: 4, md: 6, lg: 8 }} py={8}>
      <VStack gap={6} align="stretch">
        <GrowsNavigation />
        <Heading size="2xl">My Grows</Heading>
        <Grid
          templateColumns={{ base: "1fr", md: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }}
          gap={6}
        >
          <Skeleton height="250px" rounded="lg" />
          <Skeleton height="250px" rounded="lg" />
          <Skeleton height="250px" rounded="lg" />
        </Grid>
      </VStack>
    </Box>
  );
}

interface GrowsErrorStateProps {
  error: Error | null;
}

export function GrowsErrorState({ error }: GrowsErrorStateProps) {
  return (
    <Box maxW="1400px" mx="auto" px={{ base: 4, md: 6, lg: 8 }} py={8}>
      <VStack gap={6} align="stretch">
        <GrowsNavigation />
        <VStack gap={4} align="center" py={12}>
          <Text color="red.600" fontSize="lg" fontWeight="semibold">
            Error loading grows
          </Text>
          <Text color="gray.600">
            {error instanceof Error ? error.message : "An unexpected error occurred"}
          </Text>
        </VStack>
      </VStack>
    </Box>
  );
}

interface GrowsEmptyStateProps {}

export function GrowsEmptyState({}: GrowsEmptyStateProps) {
  return (
    <Box maxW="1400px" mx="auto" px={{ base: 4, md: 6, lg: 8 }} py={8}>
      <VStack gap={6} align="stretch">
        <GrowsNavigation />
        <VStack gap={6} align="center" py={12}>
          <Box as={Sprout} boxSize={16} color="gray.400" />
          <Heading size="lg" color="gray.600">
            No grows yet
          </Heading>
          <Text color="gray.500" textAlign="center" maxW="md">
            Start tracking your cannabis cultivation cycles. Create your first grow to
            monitor plant count, phases, and harvest timing.
          </Text>
        </VStack>
      </VStack>
    </Box>
  );
}

interface NoResultsStateProps {}

export function NoResultsState({}: NoResultsStateProps) {
  return (
    <VStack gap={4} py={12}>
      <Box as={Search} boxSize={12} color="gray.300" />
      <Text color="gray.500" fontSize="lg">
        No grows found matching your filters
      </Text>
      <Text color="gray.400" fontSize="sm">
        Try adjusting your search or filter criteria
      </Text>
    </VStack>
  );
}
