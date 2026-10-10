"use client";

import React, { useState, useMemo } from 'react';
import { Box, VStack, SimpleGrid, Text, HStack, Button, Spinner, Alert } from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import { useEnvironmentOverview } from '@/hooks/useEnvironmentOverview';
import { EnvironmentSummaryBar } from './EnvironmentSummaryBar';
import { EnvironmentOverviewCard } from './EnvironmentOverviewCard';
import type { EnvironmentFilter, EnvironmentWithCapacity } from '@/types';

export const EnvironmentDashboard: React.FC = () => {
  const router = useRouter();
  const [filter, setFilter] = useState<EnvironmentFilter>('all');
  const { data, isLoading, error } = useEnvironmentOverview();

  // Filter environments based on selected filter
  const filteredEnvironments = useMemo(() => {
    if (!data?.environments) return [];

    switch (filter) {
      case 'active':
        return data.environments.filter((env) => env.isActive);
      case 'warning':
        return data.environments.filter((env) => env.capacityStatus === 'warning');
      case 'over':
        return data.environments.filter((env) => env.capacityStatus === 'over');
      default:
        return data.environments;
    }
  }, [data?.environments, filter]);

  const handleEnvironmentClick = (environment: EnvironmentWithCapacity) => {
    router.push(`/grows?environment=${environment.id}`);
  };

  // Loading state
  if (isLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minH="400px"
        data-testid="loading-spinner"
      >
        <Spinner size="xl" color="green.500" />
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Alert.Root status="error" borderRadius="md">
        <Alert.Indicator />
        <VStack align="start" gap={2}>
          <Alert.Title>Error loading environment overview</Alert.Title>
          <Text fontSize="sm">{error.message || 'An unexpected error occurred'}</Text>
        </VStack>
      </Alert.Root>
    );
  }

  // Empty state
  if (!data || data.environments.length === 0) {
    return (
      <VStack gap={6} py={12} data-testid="empty-state">
        <Box textAlign="center">
          <Text fontSize="2xl" fontWeight="bold" color="gray.700" mb={2}>
            No Environments Yet
          </Text>
          <Text color="gray.600" mb={6}>
            Create your first grow environment to start tracking capacity and organizing your grows.
          </Text>
          <Button
            colorScheme="green"
            onClick={() => router.push('/grows')}
          >
            Create Environment
          </Button>
        </Box>
      </VStack>
    );
  }

  return (
    <VStack align="stretch" gap={6} data-testid="environment-dashboard">
      {/* Summary Bar */}
      <EnvironmentSummaryBar summary={data.summary} />

      {/* Filter Tabs */}
      <HStack gap={2} flexWrap="wrap">
        <Button
          size="sm"
          variant={filter === 'all' ? 'solid' : 'outline'}
          colorScheme={filter === 'all' ? 'green' : 'gray'}
          onClick={() => setFilter('all')}
        >
          All ({data.environments.length})
        </Button>
        <Button
          size="sm"
          variant={filter === 'active' ? 'solid' : 'outline'}
          colorScheme={filter === 'active' ? 'green' : 'gray'}
          onClick={() => setFilter('active')}
        >
          Active ({data.summary.activeEnvironments})
        </Button>
        <Button
          size="sm"
          variant={filter === 'warning' ? 'solid' : 'outline'}
          colorScheme={filter === 'warning' ? 'orange' : 'gray'}
          onClick={() => setFilter('warning')}
        >
          Warning ({data.summary.warningCount})
        </Button>
        <Button
          size="sm"
          variant={filter === 'over' ? 'solid' : 'outline'}
          colorScheme={filter === 'over' ? 'red' : 'gray'}
          onClick={() => setFilter('over')}
        >
          Over Capacity ({data.summary.overCapacityCount})
        </Button>
      </HStack>

      {/* Environment Grid */}
      {filteredEnvironments.length > 0 ? (
        <SimpleGrid
          columns={{ base: 1, md: 2, lg: 3 }}
          gap={6}
        >
          {filteredEnvironments.map((environment) => (
            <EnvironmentOverviewCard
              key={environment.id}
              environment={environment}
              onClick={handleEnvironmentClick}
            />
          ))}
        </SimpleGrid>
      ) : (
        <Box
          p={12}
          bg="gray.50"
          borderRadius="lg"
          textAlign="center"
        >
          <Text color="gray.600" fontSize="lg">
            No environments match the selected filter
          </Text>
          <Button
            size="sm"
            variant="ghost"
            colorScheme="green"
            mt={4}
            onClick={() => setFilter('all')}
          >
            Show All Environments
          </Button>
        </Box>
      )}
    </VStack>
  );
};
