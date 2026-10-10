"use client";

/**
 * Edit Log Entry Page
 *
 * Page component for editing an existing log entry.
 * Fetches log data, pre-populates form, and handles updates including
 * adding new photos and managing existing photos.
 */

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Container, VStack, Text } from "@chakra-ui/react";
import { ArrowLeft, Calendar } from "lucide-react";
import { LogEntryForm } from "../../../../../components/grows/LogEntryForm";
import {
  useGrowLog,
  useUpdateLog,
  useUpdateEnvironment,
  useUploadPhotos,
  useDeletePhoto,
  useSetCoverPhoto,
} from "../../../../../hooks/useGrowLogs";
import { toaster } from "../../../../../components/ChakraProvider";
import { PageStateContainer } from "../../../../../components/grows/PageStateContainer";
import { PageNavigation } from "../../../../../components/grows/PageNavigation";
import { PageHeader } from "../../../../../components/grows/PageHeader";
import { ConfirmationDialog } from "../../../../../components/grows/ConfirmationDialog";
import type { UpdateGrowLogRequest } from "../../../../../types";

/**
 * EditLogEntryPage component
 * Displays form for editing log entry with photo management
 */
export default function EditLogEntryPage() {
  const params = useParams();
  const router = useRouter();
  const growId = params.id as string;
  const logId = params.logId as string;

  const { data: log, isLoading, isError, error } = useGrowLog(logId);
  const updateLogMutation = useUpdateLog();
  const updateEnvironmentMutation = useUpdateEnvironment();
  const uploadPhotosMutation = useUploadPhotos();
  const deletePhotoMutation = useDeletePhoto();
  const setCoverPhotoMutation = useSetCoverPhoto();

  const [deletePhotoId, setDeletePhotoId] = useState<string | null>(null);

  const handleSubmit = async (
    data: any,
    photos: Array<{ file: File; caption: string }>
  ) => {
    try {
      // Step 1: Update log entry with environment data
      const logData: UpdateGrowLogRequest = {
        logged_at: data.logged_at,
        height_inches: data.height_inches || null,
        notes: data.notes || null,
      };

      // Update environment data separately if any fields changed
      // Note: The backend handles environment data through the log update endpoint
      await updateLogMutation.mutateAsync({
        logId,
        data: logData,
      });

      // Update environment data if any fields are provided
      const hasEnvironmentData =
        data.temperature_f != null ||
        data.humidity_percent != null ||
        data.ph != null ||
        data.ec != null ||
        data.ppm != null ||
        data.co2_ppm != null ||
        data.light_hours != null ||
        data.light_distance_inches != null ||
        data.vpd != null;

      let environmentUpdated = false;
      if (hasEnvironmentData) {
        try {
          await updateEnvironmentMutation.mutateAsync({
            logId,
            data: {
              temperature_f: data.temperature_f ?? null,
              humidity_percent: data.humidity_percent ?? null,
              ph: data.ph ?? null,
              ec: data.ec ?? null,
              ppm: data.ppm ?? null,
              co2_ppm: data.co2_ppm ?? null,
              light_hours: data.light_hours ?? null,
              light_distance_inches: data.light_distance_inches ?? null,
              vpd: data.vpd ?? null,
            },
          });
          environmentUpdated = true;
        } catch {
          // Don't block the success flow
        }
      }

      // Step 2: Upload new photos if any selected
      let photoCount = 0;
      if (photos.length > 0) {
        try {
          const formData = new FormData();

          // Append all photo files
          photos.forEach((photo) => {
            formData.append("photos", photo.file);
          });

          // Append captions array as JSON string
          const captions = photos.map((p) => p.caption);
          formData.append("captions", JSON.stringify(captions));

          const uploadedPhotos = await uploadPhotosMutation.mutateAsync({
            logId,
            formData,
          });

          photoCount = uploadedPhotos.length;
        } catch {
          toaster.create({
            title: "Warning",
            description: "Log entry updated but photo upload failed.",
            type: "warning",
            duration: 7000,
          });
        }
      }

      // Success message
      let message = "Log entry updated successfully";
      if (environmentUpdated && photoCount > 0) {
        message = `Log entry updated with environment data and ${photoCount} new photo${photoCount > 1 ? "s" : ""}`;
      } else if (environmentUpdated) {
        message = "Log entry updated with environment data";
      } else if (photoCount > 0) {
        message = `Log entry updated with ${photoCount} new photo${photoCount > 1 ? "s" : ""}`;
      }

      toaster.create({
        title: "Success",
        description: message,
        type: "success",
        duration: 5000,
      });

      // Redirect to grow detail page
      router.push(`/grows/${growId}`);
    } catch (error) {
      toaster.create({
        title: "Error updating log entry",
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
        type: "error",
        duration: 5000,
      });
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    setDeletePhotoId(photoId);
  };

  const confirmDeletePhoto = async () => {
    if (!deletePhotoId) return;

    try {
      await deletePhotoMutation.mutateAsync({
        photoId: deletePhotoId,
        logId,
      });

      toaster.create({
        title: "Photo deleted",
        description: "Photo has been removed from this log entry",
        type: "success",
        duration: 3000,
      });

      setDeletePhotoId(null);
    } catch (error) {
      toaster.create({
        title: "Error deleting photo",
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
        type: "error",
        duration: 5000,
      });
    }
  };

  const handleSetCoverPhoto = async (photoId: string) => {
    try {
      await setCoverPhotoMutation.mutateAsync({
        photoId,
        logId,
      });

      toaster.create({
        title: "Cover photo updated",
        description: "Cover photo has been set successfully",
        type: "success",
        duration: 3000,
      });
    } catch (error) {
      toaster.create({
        title: "Error setting cover photo",
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
        type: "error",
        duration: 5000,
      });
    }
  };

  const navigationItems = [
    { href: `/grows/${growId}`, label: "Back to Grow", icon: ArrowLeft, testId: "cancel-btn" },
  ];

  if (isLoading || isError || !log) {
    return (
      <PageStateContainer
        isLoading={isLoading}
        error={isError ? (error instanceof Error ? error : new Error("Failed to load log entry")) : null}
        isEmpty={!log && !isLoading && !isError}
        errorTitle="Log Entry Not Found"
        emptyTitle="Log Entry Not Found"
        emptyMessage="The log entry you're looking for doesn't exist or has been deleted."
        backLink={`/grows/${growId}`}
        backLinkText="Back to Grow"
        maxW="container.lg"
        testId="edit-log-page"
        loadingVariant="form"
      >
        {null}
      </PageStateContainer>
    );
  }

  // Transform log data to form format
  const initialData = {
    logged_at: log.logged_at,
    height_inches: log.height_inches || undefined,
    notes: log.notes || "",
    temperature_f: log.environment?.temperature_f || undefined,
    humidity_percent: log.environment?.humidity_percent || undefined,
    ph: log.environment?.ph || undefined,
    ec: log.environment?.ec || undefined,
    ppm: log.environment?.ppm || undefined,
    co2_ppm: log.environment?.co2_ppm || undefined,
    light_hours: log.environment?.light_hours || undefined,
    light_distance_inches: log.environment?.light_distance_inches || undefined,
    vpd: log.environment?.vpd || undefined,
  };

  return (
    <Container maxW="container.lg" py={8} data-testid="edit-log-page">
      <VStack gap={8} align="stretch">
        <PageNavigation items={navigationItems} />

        <PageHeader
          title="Edit Log Entry"
          description="Update observations, measurements, environment data, and photos."
          icon={Calendar}
        />

        <LogEntryForm
          onSubmit={handleSubmit}
          initialData={initialData}
          existingPhotos={log.photos || []}
          onDeletePhoto={handleDeletePhoto}
          onSetCoverPhoto={handleSetCoverPhoto}
          isLoading={
            updateLogMutation.isPending ||
            updateEnvironmentMutation.isPending ||
            uploadPhotosMutation.isPending ||
            deletePhotoMutation.isPending ||
            setCoverPhotoMutation.isPending
          }
        />
      </VStack>

      <ConfirmationDialog
        isOpen={!!deletePhotoId}
        onClose={() => setDeletePhotoId(null)}
        onConfirm={confirmDeletePhoto}
        title="Delete Photo"
        message={
          <Text>
            Are you sure you want to delete this photo? This action cannot be
            undone.
          </Text>
        }
        confirmText="Delete Photo"
        confirmColorPalette="red"
      />
    </Container>
  );
}
