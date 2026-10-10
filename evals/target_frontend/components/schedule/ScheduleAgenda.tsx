"use client";

import React from 'react';
import { Box, Heading, VStack, Text, Spinner } from '@chakra-ui/react';
import { Alert } from '@chakra-ui/react';
import { useScheduleAgenda, useCompleteScheduleEvent, useSkipScheduleEvent } from '@/hooks/useSchedule';
import { EventCard } from './EventCard';

interface ScheduleAgendaProps {
  days?: number;
}

export const ScheduleAgenda: React.FC<ScheduleAgendaProps> = ({ days = 7 }) => {
  const { data: agenda, isLoading, error } = useScheduleAgenda(days);
  const completeEvent = useCompleteScheduleEvent();
  const skipEvent = useSkipScheduleEvent();

  const handleComplete = (id: string) => {
    completeEvent.mutate(id);
  };

  const handleSkip = (id: string) => {
    skipEvent.mutate(id);
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" p={8}>
        <Spinner size="xl" />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert.Root status="error">
        <Alert.Indicator />
        <Alert.Title>Failed to load agenda: {error.message}</Alert.Title>
      </Alert.Root>
    );
  }

  if (!agenda) {
    return null;
  }

  const hasEvents =
    agenda.overdue.length > 0 || agenda.today.length > 0 || agenda.upcoming.length > 0;

  if (!hasEvents) {
    return (
      <Box p={8} textAlign="center">
        <Text color="gray.500">No scheduled events</Text>
      </Box>
    );
  }

  return (
    <VStack align="stretch" gap={6} data-testid="schedule-agenda">
      {agenda.overdue.length > 0 && (
        <Box>
          <Heading size="md" mb={3} color="red.600" data-testid="overdue-section">
            Overdue ({agenda.overdue.length})
          </Heading>
          <VStack align="stretch" gap={3}>
            {agenda.overdue.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onComplete={handleComplete}
                onSkip={handleSkip}
              />
            ))}
          </VStack>
        </Box>
      )}

      {agenda.today.length > 0 && (
        <Box>
          <Heading size="md" mb={3} color="green.600" data-testid="today-section">
            Today ({agenda.today.length})
          </Heading>
          <VStack align="stretch" gap={3}>
            {agenda.today.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onComplete={handleComplete}
                onSkip={handleSkip}
              />
            ))}
          </VStack>
        </Box>
      )}

      {agenda.upcoming.length > 0 && (
        <Box>
          <Heading size="md" mb={3} data-testid="upcoming-section">
            Upcoming ({agenda.upcoming.length})
          </Heading>
          <VStack align="stretch" gap={3}>
            {agenda.upcoming.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onComplete={handleComplete}
                onSkip={handleSkip}
              />
            ))}
          </VStack>
        </Box>
      )}
    </VStack>
  );
};
