"use client";

/**
 * LogEntryForm Component
 *
 * Comprehensive form for creating and editing grow log entries.
 * Supports basic fields (date, height, notes), environment data,
 * and photo upload with drag-and-drop.
 */

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Button,
  Field,
  Input,
  Textarea,
  VStack,
  HStack,
  Box,
  Heading,
} from "@chakra-ui/react";
import type { GrowLogPhoto } from "../../types";
import { usePhotoUpload } from "../../hooks/usePhotoUpload";
import type { PhotoWithPreview } from "../../hooks/usePhotoUpload";
import { ExistingPhotosGrid } from "./ExistingPhotosGrid";
import { PhotoUploadZone } from "./PhotoUploadZone";
import { NewPhotosPreview } from "./NewPhotosPreview";
import { EnvironmentFieldsSection } from "./EnvironmentFieldsSection";

/**
 * Zod validation schema for log entry form
 * Includes date validation, environment field ranges, and photo validation
 */
const logEntryFormSchema = z
  .object({
    logged_at: z
      .string()
      .min(1, "Date and time are required")
      .refine((val) => {
        const date = new Date(val);
        const now = new Date();
        return date <= now;
      }, "Cannot log entries in the future"),
    height_inches: z
      .number()
      .positive("Height must be greater than 0")
      .optional()
      .nullable(),
    notes: z
      .string()
      .max(5000, "Notes must be 5000 characters or less")
      .optional()
      .nullable(),
    // Environment fields (all optional)
    temperature_f: z.number().optional().nullable(),
    humidity_percent: z
      .number()
      .min(0, "Humidity must be between 0-100%")
      .max(100, "Humidity must be between 0-100%")
      .optional()
      .nullable(),
    ph: z
      .number()
      .min(0, "pH must be between 0-14")
      .max(14, "pH must be between 0-14")
      .optional()
      .nullable(),
    ec: z.number().positive("EC must be greater than 0").optional().nullable(),
    ppm: z
      .number()
      .positive("PPM must be greater than 0")
      .optional()
      .nullable(),
    co2_ppm: z
      .number()
      .positive("CO2 PPM must be greater than 0")
      .optional()
      .nullable(),
    light_hours: z
      .number()
      .min(0, "Light hours must be between 0-24")
      .max(24, "Light hours must be between 0-24")
      .optional()
      .nullable(),
    light_distance_inches: z
      .number()
      .positive("Light distance must be greater than 0")
      .optional()
      .nullable(),
    vpd: z
      .number()
      .positive("VPD must be greater than 0")
      .optional()
      .nullable(),
  });

type LogEntryFormData = z.infer<typeof logEntryFormSchema>;

interface LogEntryFormProps {
  onSubmit: (
    data: LogEntryFormData,
    photos: PhotoWithPreview[]
  ) => Promise<void>;
  initialData?: Partial<LogEntryFormData>;
  existingPhotos?: GrowLogPhoto[];
  onDeletePhoto?: (photoId: string) => Promise<void>;
  onSetCoverPhoto?: (photoId: string) => Promise<void>;
  isLoading?: boolean;
}

/**
 * LogEntryForm component
 * Displays all log entry fields with validation, photo upload, and error handling
 */
export const LogEntryForm: React.FC<LogEntryFormProps> = ({
  onSubmit,
  initialData,
  existingPhotos = [],
  onDeletePhoto,
  onSetCoverPhoto,
  isLoading = false,
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LogEntryFormData>({
    resolver: zodResolver(logEntryFormSchema),
    defaultValues: initialData || {
      logged_at: "",
      height_inches: undefined,
      notes: "",
      temperature_f: undefined,
      humidity_percent: undefined,
      ph: undefined,
      ec: undefined,
      ppm: undefined,
      co2_ppm: undefined,
      light_hours: undefined,
      light_distance_inches: undefined,
      vpd: undefined,
    },
  });

  const [environmentOpen, setEnvironmentOpen] = useState(false);

  const {
    photos,
    photoErrors,
    handleFileSelect,
    handleRemovePhoto,
    handleCaptionChange,
    handleDragOver,
    handleDrop,
  } = usePhotoUpload({ existingPhotos });

  const onFormSubmit = async (data: LogEntryFormData) => {
    await onSubmit(data, photos);
  };

  return (
    <form noValidate onSubmit={handleSubmit(onFormSubmit)} data-testid="log-entry-form">
      <VStack gap={6} align="stretch">
        {/* Basic Fields Section */}
        <Box>
          <Heading size="md" mb={4}>
            Log Entry Details
          </Heading>

          <VStack gap={4} align="stretch">
            {/* Date/Time - Required */}
            <Field.Root invalid={!!errors.logged_at} required>
              <Field.Label>Date & Time</Field.Label>
              <Input
                {...register("logged_at")}
                type="datetime-local"
                data-testid="log-date-input"
              />
              <Field.ErrorText>{errors.logged_at?.message}</Field.ErrorText>
              <Field.HelperText>
                Date and time when this observation was made
              </Field.HelperText>
            </Field.Root>

            {/* Height - Optional */}
            <Field.Root invalid={!!errors.height_inches}>
              <Field.Label>Plant Height (inches)</Field.Label>
              <Input
                {...register("height_inches", {
                  setValueAs: (v) => (v === "" ? undefined : Number(v)),
                })}
                type="number"
                step="0.1"
                min="0"
                placeholder="e.g., 12.5"
                data-testid="log-height-input"
              />
              <Field.ErrorText>{errors.height_inches?.message}</Field.ErrorText>
            </Field.Root>

            {/* Notes - Optional */}
            <Field.Root invalid={!!errors.notes}>
              <Field.Label>Notes</Field.Label>
              <Textarea
                {...register("notes")}
                placeholder="Add observations, changes, or any notes about the plant..."
                rows={4}
                data-testid="log-notes-input"
              />
              <Field.ErrorText>{errors.notes?.message}</Field.ErrorText>
              <Field.HelperText>
                Record observations, changes, or issues (max 5000 characters)
              </Field.HelperText>
            </Field.Root>
          </VStack>
        </Box>

        {/* Environment Section - Collapsible */}
        <EnvironmentFieldsSection
          register={register}
          errors={errors}
          isOpen={environmentOpen}
          onToggle={setEnvironmentOpen}
        />

        {/* Photo Upload Section */}
        <Box data-testid="photo-upload-panel">
          <Heading size="md" mb={4}>
            Photos (Optional)
          </Heading>

          <ExistingPhotosGrid
            photos={existingPhotos}
            onDeletePhoto={onDeletePhoto}
            onSetCoverPhoto={onSetCoverPhoto}
          />

          <PhotoUploadZone
            onFileSelect={handleFileSelect}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            photoErrors={photoErrors}
          />

          <NewPhotosPreview
            photos={photos}
            onRemovePhoto={handleRemovePhoto}
            onCaptionChange={handleCaptionChange}
          />
        </Box>

        {/* Submit Button */}
        <HStack gap={3} justifyContent="flex-end">
          <Button
            type="submit"
            colorPalette="green"
            size="lg"
            loading={isSubmitting || isLoading}
            loadingText="Saving..."
            data-testid="submit-log-btn"
          >
            Save Log Entry
          </Button>
        </HStack>
      </VStack>
    </form>
  );
};
