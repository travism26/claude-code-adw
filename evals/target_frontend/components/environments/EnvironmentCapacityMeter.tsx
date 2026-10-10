"use client";

import React from 'react';
import { Box, Progress, Text, HStack, VStack } from '@chakra-ui/react';
import type { CapacityStatus } from '@/types';

interface EnvironmentCapacityMeterProps {
  currentPlants: number;
  maxPlants: number | null;
  capacityStatus: CapacityStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showText?: boolean;
}

const STATUS_COLORS = {
  normal: 'green',
  warning: 'orange',
  over: 'red',
};

const SIZE_CONFIG = {
  sm: { height: '4px', fontSize: 'xs' },
  md: { height: '8px', fontSize: 'sm' },
  lg: { height: '12px', fontSize: 'md' },
};

export const EnvironmentCapacityMeter: React.FC<EnvironmentCapacityMeterProps> = ({
  currentPlants,
  maxPlants,
  capacityStatus,
  size = 'md',
  showLabel = true,
  showText = true,
}) => {
  const config = SIZE_CONFIG[size];
  const colorScheme = STATUS_COLORS[capacityStatus];

  // Calculate percentage
  const percentage = maxPlants && maxPlants > 0
    ? Math.min(Math.round((currentPlants / maxPlants) * 100), 100)
    : 0;

  // Handle null maxPlants
  if (maxPlants === null || maxPlants === 0) {
    return (
      <VStack align="stretch" gap={1} data-testid="capacity-meter">
        {showLabel && (
          <Text fontSize={config.fontSize} color="gray.600">
            Capacity
          </Text>
        )}
        <Box
          bg="gray.100"
          borderRadius="sm"
          h={config.height}
          aria-label="Capacity not set"
        />
        {showText && (
          <HStack justify="space-between">
            <Text fontSize={config.fontSize} color="gray.500">
              {currentPlants} plants
            </Text>
            <Text fontSize={config.fontSize} color="gray.500" fontStyle="italic">
              No limit set
            </Text>
          </HStack>
        )}
      </VStack>
    );
  }

  return (
    <VStack align="stretch" gap={1} data-testid="capacity-meter">
      {showLabel && (
        <Text fontSize={config.fontSize} color="gray.600">
          Capacity
        </Text>
      )}
      <Progress.Root
        value={percentage}
        colorPalette={colorScheme}
        size={size}
        borderRadius="sm"
        aria-label={`${percentage}% capacity utilized`}
        data-testid="capacity-progress"
      >
        <Progress.Track>
          <Progress.Range />
        </Progress.Track>
      </Progress.Root>
      {showText && (
        <HStack justify="space-between">
          <Text fontSize={config.fontSize} color="gray.700">
            {currentPlants} / {maxPlants} plants
          </Text>
          <Text
            fontSize={config.fontSize}
            color={`${colorScheme}.600`}
            fontWeight="medium"
          >
            {percentage}%
          </Text>
        </HStack>
      )}
    </VStack>
  );
};
