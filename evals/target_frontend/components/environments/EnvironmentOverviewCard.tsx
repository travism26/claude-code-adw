"use client";

import React from 'react';
import { Box, HStack, VStack, Text, Badge, Separator } from '@chakra-ui/react';
import { Tent, AlertTriangle, CheckCircle, Sprout } from 'lucide-react';
import type { EnvironmentWithCapacity } from '@/types';
import { EnvironmentCapacityMeter } from './EnvironmentCapacityMeter';

interface EnvironmentOverviewCardProps {
  environment: EnvironmentWithCapacity;
  onClick?: (environment: EnvironmentWithCapacity) => void;
}

const ENVIRONMENT_TYPE_LABELS = {
  tent: 'Tent',
  room: 'Room',
  closet: 'Closet',
  outdoor: 'Outdoor',
  greenhouse: 'Greenhouse',
};

const PHASE_COLORS = {
  germination: 'purple',
  vegetative: 'green',
  flowering: 'orange',
  harvest: 'yellow',
  archived: 'gray',
};

export const EnvironmentOverviewCard: React.FC<EnvironmentOverviewCardProps> = ({
  environment,
  onClick,
}) => {
  const isClickable = !!onClick;
  const hasWarning = environment.capacityStatus === 'warning' || environment.capacityStatus === 'over';

  return (
    <Box
      bg="white"
      borderRadius="lg"
      borderLeft="4px solid"
      borderLeftColor={environment.displayColor || '#10B981'}
      boxShadow="sm"
      p={5}
      cursor={isClickable ? 'pointer' : 'default'}
      onClick={() => onClick?.(environment)}
      _hover={isClickable ? { boxShadow: 'md', transform: 'translateY(-2px)' } : {}}
      transition="all 0.2s"
      data-testid="environment-overview-card"
    >
      <VStack align="stretch" gap={4}>
        {/* Header */}
        <HStack justify="space-between">
          <HStack gap={2}>
            <Box
              w={3}
              h={3}
              borderRadius="full"
              bg={environment.displayColor || '#10B981'}
            />
            <Text fontSize="lg" fontWeight="bold" color="gray.800">
              {environment.name}
            </Text>
          </HStack>
          <HStack gap={2}>
            <Badge colorScheme="blue" variant="subtle">
              {ENVIRONMENT_TYPE_LABELS[environment.type as keyof typeof ENVIRONMENT_TYPE_LABELS] || environment.type}
            </Badge>
            {!environment.isActive && (
              <Badge colorScheme="gray" variant="subtle">
                Inactive
              </Badge>
            )}
          </HStack>
        </HStack>

        {/* Capacity Meter */}
        <EnvironmentCapacityMeter
          currentPlants={environment.currentPlants}
          maxPlants={environment.maxPlants}
          capacityStatus={environment.capacityStatus}
          size="md"
          showLabel={false}
        />

        {/* Status Indicator */}
        {hasWarning && (
          <HStack
            p={2}
            bg={environment.capacityStatus === 'over' ? 'red.50' : 'orange.50'}
            borderRadius="md"
            gap={2}
          >
            <AlertTriangle
              size={16}
              color={environment.capacityStatus === 'over' ? '#DC2626' : '#EA580C'}
            />
            <Text
              fontSize="sm"
              fontWeight="medium"
              color={environment.capacityStatus === 'over' ? 'red.700' : 'orange.700'}
            >
              {environment.capacityStatus === 'over'
                ? 'Over capacity!'
                : 'Approaching capacity'}
            </Text>
          </HStack>
        )}

        {!hasWarning && environment.activeGrows.length > 0 && (
          <HStack
            p={2}
            bg="green.50"
            borderRadius="md"
            gap={2}
          >
            <CheckCircle size={16} color="#10B981" />
            <Text fontSize="sm" fontWeight="medium" color="green.700">
              Normal capacity
            </Text>
          </HStack>
        )}

        {/* Active Grows */}
        {environment.activeGrows.length > 0 && (
          <>
            <Separator />
            <VStack align="stretch" gap={2}>
              <HStack color="gray.600">
                <Sprout size={16} />
                <Text fontSize="sm" fontWeight="medium">
                  Active Grows ({environment.activeGrows.length})
                </Text>
              </HStack>
              {environment.activeGrows.slice(0, 3).map((grow) => (
                <HStack key={grow.id} justify="space-between" pl={6}>
                  <Text fontSize="sm" color="gray.700" lineClamp={1}>
                    {grow.name}
                  </Text>
                  <HStack gap={2}>
                    <Text fontSize="xs" color="gray.500">
                      {grow.plantCount} {grow.plantCount === 1 ? 'plant' : 'plants'}
                    </Text>
                    <Badge
                      colorScheme={PHASE_COLORS[grow.phase as keyof typeof PHASE_COLORS] || 'gray'}
                      size="sm"
                      variant="subtle"
                    >
                      {grow.phase}
                    </Badge>
                  </HStack>
                </HStack>
              ))}
              {environment.activeGrows.length > 3 && (
                <Text fontSize="xs" color="gray.500" pl={6}>
                  + {environment.activeGrows.length - 3} more
                </Text>
              )}
            </VStack>
          </>
        )}

        {/* Environment Details */}
        {(environment.dimensions.widthInches || environment.lightInfo.type) && (
          <>
            <Separator />
            <VStack align="stretch" gap={1}>
              {environment.dimensions.widthInches && environment.dimensions.depthInches && (
                <Text fontSize="xs" color="gray.600">
                  <strong>Dimensions:</strong> {environment.dimensions.widthInches}&quot; × {environment.dimensions.depthInches}&quot;
                  {environment.dimensions.heightInches && ` × ${environment.dimensions.heightInches}&quot;`}
                </Text>
              )}
              {environment.lightInfo.type && (
                <Text fontSize="xs" color="gray.600">
                  <strong>Light:</strong> {environment.lightInfo.type.toUpperCase()}
                  {environment.lightInfo.wattage && ` (${environment.lightInfo.wattage}W)`}
                </Text>
              )}
            </VStack>
          </>
        )}

        {/* Empty State */}
        {environment.activeGrows.length === 0 && (
          <Text fontSize="sm" color="gray.500" fontStyle="italic" textAlign="center" py={2}>
            No active grows
          </Text>
        )}
      </VStack>
    </Box>
  );
};
