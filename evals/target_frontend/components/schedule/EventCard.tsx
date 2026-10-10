"use client";

import React from 'react';
import { Box, Badge, Button, HStack, Text, VStack } from '@chakra-ui/react';
import type { ScheduledEvent } from '@/types';

interface EventCardProps {
  event: ScheduledEvent;
  onComplete?: (id: string) => void;
  onSkip?: (id: string) => void;
  onClick?: (event: ScheduledEvent) => void;
}

const EVENT_TYPE_COLORS = {
  feeding: '#3B82F6',
  watering: '#06B6D4',
  phase_change: '#8B5CF6',
  harvest: '#10B981',
  custom: '#6B7280',
};

const STATUS_COLORS = {
  pending: 'yellow',
  completed: 'green',
  skipped: 'gray',
  cancelled: 'red',
};

export const EventCard: React.FC<EventCardProps> = ({
  event,
  onComplete,
  onSkip,
  onClick,
}) => {
  const borderColor = event.environment?.displayColor || event.color || EVENT_TYPE_COLORS[event.eventType];

  return (
    <Box
      p={4}
      bg="white"
      borderRadius="md"
      borderLeft="4px solid"
      borderLeftColor={borderColor}
      boxShadow="sm"
      cursor={onClick ? 'pointer' : 'default'}
      onClick={() => onClick?.(event)}
      data-testid="event-card"
      _hover={{ boxShadow: onClick ? 'md' : 'sm' }}
    >
      <VStack align="stretch" gap={2}>
        <HStack justify="space-between">
          <Text fontWeight="bold" fontSize="lg">
            {event.title}
          </Text>
          <Badge colorScheme={STATUS_COLORS[event.status]}>
            {event.status}
          </Badge>
        </HStack>

        <Text fontSize="sm" color="gray.600">
          {new Date(event.startDate).toLocaleString()}
        </Text>

        {event.description && (
          <Text fontSize="sm" color="gray.700">
            {event.description}
          </Text>
        )}

        <HStack>
          <Badge colorScheme="blue">{event.eventType}</Badge>
          <Badge>{event.entityType}</Badge>
        </HStack>

        {event.status === 'pending' && (onComplete || onSkip) && (
          <HStack gap={2} mt={2}>
            {onComplete && (
              <Button
                size="sm"
                colorScheme="green"
                onClick={(e) => {
                  e.stopPropagation();
                  onComplete(event.id);
                }}
                data-testid="complete-button"
              >
                Complete
              </Button>
            )}
            {onSkip && (
              <Button
                size="sm"
                colorScheme="gray"
                onClick={(e) => {
                  e.stopPropagation();
                  onSkip(event.id);
                }}
              >
                Skip
              </Button>
            )}
          </HStack>
        )}
      </VStack>
    </Box>
  );
};
