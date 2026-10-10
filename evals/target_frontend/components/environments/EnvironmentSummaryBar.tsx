"use client";

import React from 'react';
import { Box, HStack, VStack, Text, Badge, SimpleGrid } from '@chakra-ui/react';
import { Warehouse, Sprout, AlertTriangle, TrendingUp } from 'lucide-react';
import type { CapacitySummary } from '@/types';

interface EnvironmentSummaryBarProps {
  summary: CapacitySummary;
}

export const EnvironmentSummaryBar: React.FC<EnvironmentSummaryBarProps> = ({
  summary,
}) => {
  const utilizationColor =
    summary.utilizationPercent === null ? 'gray' :
    summary.utilizationPercent >= 100 ? 'red' :
    summary.utilizationPercent >= 80 ? 'orange' :
    'green';

  return (
    <Box
      bg="white"
      borderRadius="lg"
      p={6}
      boxShadow="sm"
      border="1px solid"
      borderColor="gray.200"
      data-testid="environment-summary-bar"
    >
      <SimpleGrid
        columns={{ base: 1, sm: 2, md: 4 }}
        gap={6}
      >
        {/* Total Environments */}
        <VStack align="start" gap={1}>
          <HStack color="gray.600">
            <Warehouse size={18} />
            <Text fontSize="sm" fontWeight="medium">
              Total Environments
            </Text>
          </HStack>
          <Text fontSize="2xl" fontWeight="bold" color="gray.800">
            {summary.totalEnvironments}
          </Text>
          <Text fontSize="xs" color="gray.500">
            {summary.activeEnvironments} active
          </Text>
        </VStack>

        {/* Plants / Capacity */}
        <VStack align="start" gap={1}>
          <HStack color="gray.600">
            <Sprout size={18} />
            <Text fontSize="sm" fontWeight="medium">
              Plant Capacity
            </Text>
          </HStack>
          <HStack gap={1} align="baseline">
            <Text fontSize="2xl" fontWeight="bold" color="gray.800">
              {summary.totalPlants}
            </Text>
            <Text fontSize="lg" color="gray.500">
              / {summary.totalCapacity}
            </Text>
          </HStack>
          <Text fontSize="xs" color="gray.500">
            total plants
          </Text>
        </VStack>

        {/* Overall Utilization */}
        <VStack align="start" gap={1}>
          <HStack color="gray.600">
            <TrendingUp size={18} />
            <Text fontSize="sm" fontWeight="medium">
              Utilization
            </Text>
          </HStack>
          <HStack gap={2}>
            <Text fontSize="2xl" fontWeight="bold" color="gray.800">
              {summary.utilizationPercent ?? 'N/A'}
              {summary.utilizationPercent !== null && '%'}
            </Text>
            <Badge colorScheme={utilizationColor} fontSize="sm">
              {utilizationColor === 'green' ? 'Normal' :
               utilizationColor === 'orange' ? 'Warning' :
               utilizationColor === 'red' ? 'Over' : 'N/A'}
            </Badge>
          </HStack>
          <Text fontSize="xs" color="gray.500">
            overall capacity
          </Text>
        </VStack>

        {/* Warnings & Alerts */}
        <VStack align="start" gap={1}>
          <HStack color="gray.600">
            <AlertTriangle size={18} />
            <Text fontSize="sm" fontWeight="medium">
              Alerts
            </Text>
          </HStack>
          <HStack gap={3}>
            {summary.warningCount > 0 && (
              <VStack gap={0} align="center">
                <Text fontSize="xl" fontWeight="bold" color="orange.600">
                  {summary.warningCount}
                </Text>
                <Text fontSize="xs" color="gray.500">
                  warning
                </Text>
              </VStack>
            )}
            {summary.overCapacityCount > 0 && (
              <VStack gap={0} align="center">
                <Text fontSize="xl" fontWeight="bold" color="red.600">
                  {summary.overCapacityCount}
                </Text>
                <Text fontSize="xs" color="gray.500">
                  over
                </Text>
              </VStack>
            )}
            {summary.warningCount === 0 && summary.overCapacityCount === 0 && (
              <Text fontSize="sm" color="green.600" fontWeight="medium">
                All good
              </Text>
            )}
          </HStack>
        </VStack>
      </SimpleGrid>
    </Box>
  );
};
