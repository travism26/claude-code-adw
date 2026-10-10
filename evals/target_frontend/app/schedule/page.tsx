"use client";

import React from "react";
import {
  Box,
  Container,
  Heading,
  Button,
  VStack,
  HStack,
  NativeSelectField,
  NativeSelectRoot,
  Spinner,
  Text,
} from "@chakra-ui/react";
import {
  DialogBackdrop,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogHeader,
  DialogPositioner,
  DialogRoot,
  DialogTitle,
} from "@chakra-ui/react";
import { Alert } from "@chakra-ui/react";
import { Plus, Calendar, List } from "lucide-react";
import { ScheduleAgenda } from "@/components/schedule/ScheduleAgenda";
import { ScheduleCalendar } from "@/components/schedule/ScheduleCalendar";
import { EventForm } from "@/components/schedule/EventForm";
import { QuickScheduleModal } from "@/components/schedule/QuickScheduleModal";
import {
  useScheduleEvents,
  useCreateScheduleEvent,
  useUpdateScheduleEvent,
} from "@/hooks/useSchedule";
import { toaster } from "@/components/ChakraProvider";
import { useScheduleUIStore } from "@/stores/useScheduleUIStore";
import type {
  ScheduledEvent,
  CreateEventInput,
} from "@/types/schedule";

export default function SchedulePage() {
  // Zustand store for UI state
  const {
    viewMode,
    setViewMode,
    entityTypeFilter,
    setEntityTypeFilter,
    statusFilter,
    setStatusFilter,
    selectedEvent,
    isEventFormOpen,
    isQuickScheduleOpen,
    openEventForm,
    closeEventForm,
    openQuickSchedule,
    closeQuickSchedule,
  } = useScheduleUIStore();

  // Fetch events with filters
  const filters = {
    ...(entityTypeFilter !== "all" && { entityType: entityTypeFilter }),
    ...(statusFilter !== "all" && { status: statusFilter }),
  };

  const { data, isLoading, error } = useScheduleEvents(filters);
  const createEvent = useCreateScheduleEvent();
  const updateEvent = useUpdateScheduleEvent();

  // Handle event creation
  const handleCreateEvent = async (data: CreateEventInput) => {
    try {
      await createEvent.mutateAsync(data);
      toaster.create({
        title: "Event Created",
        description: "Your event has been created successfully",
        type: "success",
      });
      closeEventForm();
    } catch (error: any) {
      toaster.create({
        title: "Failed to Create Event",
        description: error.message || "An error occurred",
        type: "error",
      });
    }
  };

  // Handle event update
  const handleUpdateEvent = async (data: CreateEventInput) => {
    if (!selectedEvent) return;

    try {
      await updateEvent.mutateAsync({
        id: selectedEvent.id,
        data,
      });
      toaster.create({
        title: "Event Updated",
        description: "Your event has been updated successfully",
        type: "success",
      });
      closeEventForm();
    } catch (error: any) {
      toaster.create({
        title: "Failed to Update Event",
        description: error.message || "An error occurred",
        type: "error",
      });
    }
  };

  // Simplified handlers using Zustand actions
  const handleAddEvent = () => openEventForm();
  const handleEventClick = (event: ScheduledEvent) => openEventForm(event);
  const handleSelectSlot = (slotInfo: { start: Date; end: Date }) => openQuickSchedule(slotInfo);

  const events = data?.events || [];

  return (
    <Container maxW="container.xl" py={8} pb={12} data-testid="schedule-page">
      <VStack align="stretch" gap={6}>
        {/* Header */}
        <HStack justify="space-between" flexWrap="wrap" gap={3}>
          <Heading size="xl">Schedule</Heading>
          <HStack gap={2}>
            {/* View Toggle */}
            <Button
              variant={viewMode === "calendar" ? "solid" : "outline"}
              onClick={() => setViewMode("calendar")}
              size="sm"
            >
              <Calendar size={16} />
              <Box ml={1}>Calendar</Box>
            </Button>
            <Button
              variant={viewMode === "agenda" ? "solid" : "outline"}
              onClick={() => setViewMode("agenda")}
              size="sm"
            >
              <List size={16} />
              <Box ml={1}>Agenda</Box>
            </Button>

            {/* Add Event Button */}
            <Button
              colorScheme="blue"
              onClick={handleAddEvent}
              data-testid="add-event-button"
            >
              <Plus size={16} />
              <Box ml={2}>Add Event</Box>
            </Button>
          </HStack>
        </HStack>

        {/* Filters */}
        <HStack gap={3} flexWrap="wrap">
          <Box minW="150px">
            <NativeSelectRoot size="sm">
              <NativeSelectField
                value={entityTypeFilter}
                onChange={(e) => setEntityTypeFilter(e.target.value as any)}
              >
                <option value="all">All Entities</option>
                <option value="grow">Grows</option>
                <option value="garden">Gardens</option>
                <option value="plant">Plants</option>
              </NativeSelectField>
            </NativeSelectRoot>
          </Box>

          <Box minW="150px">
            <NativeSelectRoot size="sm">
              <NativeSelectField
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="skipped">Skipped</option>
                <option value="cancelled">Cancelled</option>
              </NativeSelectField>
            </NativeSelectRoot>
          </Box>
        </HStack>

        {/* Loading State */}
        {isLoading && (
          <Box display="flex" justifyContent="center" p={8}>
            <Spinner size="xl" />
          </Box>
        )}

        {/* Error State */}
        {error && (
          <Alert.Root status="error">
            <Alert.Indicator />
            <Alert.Title>Failed to load events: {error.message}</Alert.Title>
          </Alert.Root>
        )}

        {/* Calendar/Agenda View - Always show calendar even when empty */}
        {!isLoading && !error && (
          <>
            {viewMode === "calendar" && (
              <ScheduleCalendar
                events={events}
                onEventClick={handleEventClick}
                onSelectSlot={handleSelectSlot}
              />
            )}

            {viewMode === "agenda" && (
              events.length === 0 ? (
                <Box p={8} textAlign="center">
                  <Text fontSize="lg" color="gray.600" mb={4}>
                    No scheduled events yet
                  </Text>
                  <Text color="gray.500" mb={6}>
                    Create your first event to start scheduling your grow activities
                  </Text>
                  <Button colorScheme="blue" onClick={handleAddEvent}>
                    <Plus size={16} />
                    <Box ml={2}>Create First Event</Box>
                  </Button>
                </Box>
              ) : (
                <ScheduleAgenda days={7} />
              )
            )}
          </>
        )}
      </VStack>

      {/* Event Form Modal */}
      <DialogRoot
        open={isEventFormOpen}
        onOpenChange={(e) => {
          if (!e.open) {
            closeEventForm();
          }
        }}
        size="xl"
        scrollBehavior="inside"
        placement="center"
      >
        <DialogBackdrop />
        <DialogPositioner>
          <DialogContent maxH="85vh" my={4}>
            <DialogHeader>
              <DialogTitle>
                {selectedEvent ? "Edit Event" : "Create Event"}
              </DialogTitle>
              <DialogCloseTrigger />
            </DialogHeader>
            <DialogBody overflowY="auto" pb={6}>
              <EventForm
                onSubmit={selectedEvent ? handleUpdateEvent : handleCreateEvent}
                onCancel={closeEventForm}
                initialData={selectedEvent || undefined}
                isSubmitting={createEvent.isPending || updateEvent.isPending}
              />
            </DialogBody>
          </DialogContent>
        </DialogPositioner>
      </DialogRoot>

      {/* Quick Schedule Modal */}
      <QuickScheduleModal
        isOpen={isQuickScheduleOpen}
        onClose={closeQuickSchedule}
        onSuccess={() => {
          toaster.create({
            title: "Event Created",
            description: "Quick schedule event created successfully",
            type: "success",
          });
        }}
      />
    </Container>
  );
}
