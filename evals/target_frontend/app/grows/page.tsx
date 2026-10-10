"use client";

/**
 * Grows List Page
 *
 * Main page for viewing and managing cannabis cultivation cycles.
 * Features:
 * - Responsive grid layout (1/2/3 columns)
 * - Search by strain name with debouncing
 * - Filter by cultivation phase
 * - Loading states with skeleton cards
 * - Empty state for new users
 */

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  Grid,
  Heading,
  HStack,
  Input,
  Text,
  VStack,
  Flex,
  NativeSelectRoot,
  NativeSelectField,
} from "@chakra-ui/react";
import { Search } from "lucide-react";
import { useGrows } from "../../hooks/useGrows";
import { GrowCard } from "../../components/grows/GrowCard";
import { GrowsNavigation } from "../../components/grows/GrowsNavigation";
import {
  GrowsLoadingState,
  GrowsErrorState,
  GrowsEmptyState,
  NoResultsState,
} from "../../components/grows/GrowsPageStates";
import type { GrowPhase, Grow } from "../../types";

/** Grows shown per page (3-column grid → 4 rows) */
const PAGE_SIZE = 12;

export default function GrowsPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [phaseFilter, setPhaseFilter] = useState<GrowPhase | "">("");
  const [page, setPage] = useState(0);

  // Navigate to grow detail page
  const handleViewGrow = (grow: Grow) => {
    router.push(`/grows/${grow.id}`);
  };

  // Debounce search input (500ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset to the first page whenever search or phase filter changes
  useEffect(() => {
    setPage(0);
  }, [debouncedSearchTerm, phaseFilter]);

  // Build filters for API query
  const filters = {
    phase: phaseFilter || undefined,
    strain_name: debouncedSearchTerm || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  };

  // Fetch grows with filters
  const { data: growsResponse, isLoading, isError, error, isPlaceholderData } =
    useGrows(filters);

  const total = growsResponse?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Clamp page if the last page disappears (e.g. a grow was deleted)
  useEffect(() => {
    if (growsResponse && page > 0 && page >= totalPages) {
      setPage(totalPages - 1);
    }
  }, [growsResponse, page, totalPages]);

  // Loading state
  if (isLoading) {
    return <GrowsLoadingState />;
  }

  // Error state
  if (isError) {
    return <GrowsErrorState error={error} />;
  }

  const grows = growsResponse?.grows || [];

  // Empty state
  if (total === 0 && !searchTerm && !phaseFilter) {
    return <GrowsEmptyState />;
  }

  return (
    <Box maxW="1400px" mx="auto" px={{ base: 4, md: 6, lg: 8 }} py={8}>
      <VStack gap={6} align="stretch">
        <GrowsNavigation />
        <Heading size="2xl">My Grows</Heading>

        {/* Search and Filter Controls */}
        <Flex
          gap={4}
          flexDirection={{ base: "column", md: "row" }}
          align={{ base: "stretch", md: "center" }}
        >
          {/* Search Input */}
          <Box position="relative" flex="1">
            <Box
              position="absolute"
              left={3}
              top="50%"
              transform="translateY(-50%)"
              pointerEvents="none"
              color="gray.400"
            >
              <Search size={20} />
            </Box>
            <Input
              placeholder="Search by strain name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              pl={10}
              data-testid="grows-search-input"
            />
          </Box>

          {/* Phase Filter */}
          <NativeSelectRoot width={{ base: "100%", md: "250px" }}>
            <NativeSelectField
              value={phaseFilter}
              onChange={(e) => setPhaseFilter(e.target.value as GrowPhase | "")}
              data-testid="grows-phase-filter"
            >
              <option value="">All Phases</option>
              <option value="germination">Germination</option>
              <option value="vegetative">Vegetative</option>
              <option value="flowering">Flowering</option>
              <option value="harvest">Harvest</option>
              <option value="archived">Archived</option>
            </NativeSelectField>
          </NativeSelectRoot>
        </Flex>

        {/* Results Count */}
        {total > 0 && (
          <Text color="gray.600" fontSize="sm" data-testid="grows-results-count">
            Showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + grows.length} of{" "}
            {total} {total === 1 ? "grow" : "grows"}
          </Text>
        )}

        {/* Grows Grid */}
        {grows.length > 0 ? (
          <Grid
            templateColumns={{ base: "1fr", md: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }}
            gap={6}
            opacity={isPlaceholderData ? 0.6 : 1}
          >
            {grows.map((grow) => (
              <GrowCard
                key={grow.id}
                grow={grow}
                onClick={handleViewGrow}
                data-testid="view-grow-detail"
              />
            ))}
          </Grid>
        ) : (
          <NoResultsState />
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <HStack justify="center" gap={4} pt={2} data-testid="grows-pagination">
            <Button
              size="sm"
              variant="outline"
              data-testid="grows-prev-page"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || isPlaceholderData}
            >
              Previous
            </Button>
            <Text fontSize="sm" color="gray.600">
              Page {page + 1} of {totalPages}
            </Text>
            <Button
              size="sm"
              variant="outline"
              data-testid="grows-next-page"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || isPlaceholderData}
            >
              Next
            </Button>
          </HStack>
        )}
      </VStack>
    </Box>
  );
}
