"use client";

/**
 * EventForm Component
 *
 * Form component for creating and editing scheduled events.
 * Supports entity selection, recurrence patterns, and validation.
 */

import React, { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Box,
  Button,
  Field,
  Grid,
  HStack,
  Input,
  NativeSelectField,
  NativeSelectRoot,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import { Switch } from "@chakra-ui/react";
import {
  Droplet,
  Leaf,
  TrendingUp,
  Package,
  Plus,
} from "lucide-react";
import { RecurrenceBuilder } from "./RecurrenceBuilder";
import { useGrows } from "@/hooks/useGrows";
import { useGardens } from "@/hooks/useGardens";
import { usePlants } from "@/hooks/usePlants";
import type {
  CreateEventInput,
  ScheduledEvent,
  EntityType,
  EventType,
} from "@/types/schedule";

/**
 * Zod validation schema for event form
 */
const eventFormSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or less"),
  entityType: z.enum(["grow", "garden", "plant"]),
  entityId: z.string().uuid("Invalid entity ID"),
  eventType: z.enum(["feeding", "watering", "phase_change", "harvest", "custom"]),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional().nullable(),
  allDay: z.boolean().optional(),
  isRecurring: z.boolean().optional(),
  recurrenceRule: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  description: z
    .string()
    .max(1000, "Description must be 1000 characters or less")
    .optional()
    .nullable(),
});

type EventFormData = z.infer<typeof eventFormSchema>;

interface EventFormProps {
  onSubmit: (data: CreateEventInput) => void;
  onCancel: () => void;
  initialData?: Partial<ScheduledEvent>;
  isSubmitting?: boolean;
}

/**
 * Event type icons
 */
const EVENT_TYPE_ICONS: Record<EventType, React.ReactNode> = {
  feeding: <Leaf size={16} />,
  watering: <Droplet size={16} />,
  phase_change: <TrendingUp size={16} />,
  harvest: <Package size={16} />,
  custom: <Plus size={16} />,
};

/**
 * EventForm component
 * Displays all event fields with validation and entity selectors
 */
export const EventForm: React.FC<EventFormProps> = ({
  onSubmit,
  onCancel,
  initialData,
  isSubmitting = false,
}) => {
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EventFormData>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: initialData?.title || "",
      entityType: initialData?.entityType || "grow",
      entityId: initialData?.entityId || "",
      eventType: initialData?.eventType || "watering",
      startDate: initialData?.startDate
        ? new Date(initialData.startDate).toISOString().slice(0, 16)
        : "",
      endDate: initialData?.endDate
        ? new Date(initialData.endDate).toISOString().slice(0, 16)
        : "",
      allDay: initialData?.allDay || false,
      isRecurring: initialData?.isRecurring || false,
      recurrenceRule: initialData?.recurrenceRule || null,
      color: initialData?.color || "#3B82F6",
      description: initialData?.description || "",
    },
  });

  const entityType = watch("entityType");
  const isRecurring = watch("isRecurring");

  // Fetch entities based on selected type
  const { data: growsData } = useGrows();
  const { data: gardensData } = useGardens();
  const { plants } = usePlants();

  // Get available entities based on entity type
  const getEntityOptions = () => {
    switch (entityType) {
      case "grow":
        return growsData?.grows || [];
      case "garden":
        return gardensData || [];
      case "plant":
        return plants || [];
      default:
        return [];
    }
  };

  const entityOptions = getEntityOptions();

  // Reset entity ID when entity type changes
  useEffect(() => {
    if (!initialData?.entityId) {
      setValue("entityId", "");
    }
  }, [entityType, setValue, initialData]);

  const handleFormSubmit = (data: EventFormData) => {
    // Convert datetime-local format to ISO8601
    const submitData: CreateEventInput = {
      ...data,
      startDate: new Date(data.startDate).toISOString(),
      endDate: data.endDate ? new Date(data.endDate).toISOString() : null,
    };
    onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} data-testid="event-form">
      <VStack align="stretch" gap={4} pb={8}>
        {/* Title */}
        <Field.Root invalid={!!errors.title}>
          <Field.Label>Title</Field.Label>
          <Input
            {...register("title")}
            placeholder="Event title"
            data-testid="event-title-input"
          />
          {errors.title && (
            <Field.ErrorText>{errors.title.message}</Field.ErrorText>
          )}
        </Field.Root>

        {/* Entity Type */}
        <Field.Root invalid={!!errors.entityType}>
          <Field.Label>Entity Type</Field.Label>
          <NativeSelectRoot>
            <NativeSelectField {...register("entityType")}>
              <option value="grow">Grow</option>
              <option value="garden">Garden</option>
              <option value="plant">Plant</option>
            </NativeSelectField>
          </NativeSelectRoot>
          {errors.entityType && (
            <Field.ErrorText>{errors.entityType.message}</Field.ErrorText>
          )}
        </Field.Root>

        {/* Entity ID */}
        <Field.Root invalid={!!errors.entityId}>
          <Field.Label>
            {entityType === "grow" && "Select Grow"}
            {entityType === "garden" && "Select Garden"}
            {entityType === "plant" && "Select Plant"}
          </Field.Label>
          <NativeSelectRoot>
            <NativeSelectField {...register("entityId")}>
              <option value="">-- Select --</option>
              {entityOptions.map((entity: any) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name || entity.title || entity.id}
                </option>
              ))}
            </NativeSelectField>
          </NativeSelectRoot>
          {errors.entityId && (
            <Field.ErrorText>{errors.entityId.message}</Field.ErrorText>
          )}
        </Field.Root>

        {/* Event Type */}
        <Field.Root invalid={!!errors.eventType}>
          <Field.Label>Event Type</Field.Label>
          <NativeSelectRoot>
            <NativeSelectField {...register("eventType")}>
              <option value="watering">Watering</option>
              <option value="feeding">Feeding</option>
              <option value="phase_change">Phase Change</option>
              <option value="harvest">Harvest</option>
              <option value="custom">Custom</option>
            </NativeSelectField>
          </NativeSelectRoot>
          {errors.eventType && (
            <Field.ErrorText>{errors.eventType.message}</Field.ErrorText>
          )}
        </Field.Root>

        {/* Date/Time Inputs */}
        <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
          <Field.Root invalid={!!errors.startDate}>
            <Field.Label>Start Date/Time</Field.Label>
            <Input {...register("startDate")} type="datetime-local" />
            {errors.startDate && (
              <Field.ErrorText>{errors.startDate.message}</Field.ErrorText>
            )}
          </Field.Root>

          <Field.Root invalid={!!errors.endDate}>
            <Field.Label>End Date/Time (Optional)</Field.Label>
            <Input {...register("endDate")} type="datetime-local" />
            {errors.endDate && (
              <Field.ErrorText>{errors.endDate.message}</Field.ErrorText>
            )}
          </Field.Root>
        </Grid>

        {/* All Day Toggle */}
        <Field.Root>
          <HStack justify="space-between">
            <Field.Label>All Day Event</Field.Label>
            <Controller
              name="allDay"
              control={control}
              render={({ field }) => (
                <Switch.Root
                  checked={field.value}
                  onCheckedChange={(e: { checked: boolean }) => field.onChange(e.checked)}
                >
                  <Switch.HiddenInput />
                  <Switch.Control />
                </Switch.Root>
              )}
            />
          </HStack>
        </Field.Root>

        {/* Recurrence Toggle */}
        <Field.Root>
          <HStack justify="space-between">
            <Field.Label>Recurring Event</Field.Label>
            <Controller
              name="isRecurring"
              control={control}
              render={({ field }) => (
                <Switch.Root
                  checked={field.value}
                  onCheckedChange={(e: { checked: boolean }) => field.onChange(e.checked)}
                >
                  <Switch.HiddenInput />
                  <Switch.Control />
                </Switch.Root>
              )}
            />
          </HStack>
        </Field.Root>

        {/* Recurrence Builder */}
        {isRecurring && (
          <Box borderWidth={1} borderRadius="md" p={4} bg="gray.50">
            <Controller
              name="recurrenceRule"
              control={control}
              render={({ field }) => (
                <RecurrenceBuilder
                  value={field.value || null}
                  onChange={field.onChange}
                />
              )}
            />
          </Box>
        )}

        {/* Color Picker */}
        <Field.Root invalid={!!errors.color}>
          <Field.Label>Event Color</Field.Label>
          <Input {...register("color")} type="color" maxW="100px" />
          {errors.color && (
            <Field.ErrorText>{errors.color.message}</Field.ErrorText>
          )}
        </Field.Root>

        {/* Description */}
        <Field.Root invalid={!!errors.description}>
          <Field.Label>Description (Optional)</Field.Label>
          <Textarea
            {...register("description")}
            placeholder="Add event details..."
            rows={4}
          />
          {errors.description && (
            <Field.ErrorText>{errors.description.message}</Field.ErrorText>
          )}
        </Field.Root>

        {/* Form Actions */}
        <HStack justify="flex-end" gap={3} mt={4}>
          <Button
            onClick={onCancel}
            variant="outline"
            data-testid="cancel-button"
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            colorScheme="blue"
            data-testid="submit-button"
            loading={isSubmitting}
          >
            {initialData ? "Update Event" : "Create Event"}
          </Button>
        </HStack>
      </VStack>
    </form>
  );
};
