"use client";

/**
 * Create Log Entry Page
 *
 * Page component for creating a new log entry for a grow.
 * Implements two-step submission flow:
 * 1. Create log entry via POST /api/grows/:id/logs
 * 2. Upload photos if any selected via POST /api/grow-logs/:logId/photos
 */

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { Container, VStack } from "@chakra-ui/react";
import { ArrowLeft, Calendar } from "lucide-react";
import { LogEntryForm } from "../../../../components/grows/LogEntryForm";
import { useCreateLog, useUploadPhotos } from "../../../../hooks/useGrowLogs";
import { toaster } from "../../../../components/ChakraProvider";
import { PageNavigation } from "../../../../components/grows/PageNavigation";
import { PageHeader } from "../../../../components/grows/PageHeader";
import type { CreateGrowLogRequest } from "../../../../types";

/**
 * CreateLogEntryPage component
 * Displays form for creating new log entry with photo upload
 */
export default function CreateLogEntryPage() {
  const params = useParams();
  const router = useRouter();
  const growId = params.id as string;

  const createLogMutation = useCreateLog();
  const uploadPhotosMutation = useUploadPhotos();

  const handleSubmit = async (
    data: any,
    photos: Array<{ file: File; caption: string }>
  ) => {
    try {
      // Step 1: Create log entry with environment data
      const logData: CreateGrowLogRequest = {
        logged_at: data.logged_at,
        height_inches: data.height_inches || null,
        notes: data.notes || null,
        // Include environment data if any fields are provided
        environment:
          data.temperature_f ||
          data.humidity_percent ||
          data.ph ||
          data.ec ||
          data.ppm ||
          data.co2_ppm ||
          data.light_hours ||
          data.light_distance_inches ||
          data.vpd
            ? {
                temperature_f: data.temperature_f || null,
                humidity_percent: data.humidity_percent || null,
                ph: data.ph || null,
                ec: data.ec || null,
                ppm: data.ppm || null,
                co2_ppm: data.co2_ppm || null,
                light_hours: data.light_hours || null,
                light_distance_inches: data.light_distance_inches || null,
                vpd: data.vpd || null,
              }
            : undefined,
      };

      const newLog = await createLogMutation.mutateAsync({
        growId,
        data: logData,
      });

      // Step 2: Upload photos if any selected
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
            logId: newLog.id,
            formData,
          });

          photoCount = uploadedPhotos.length;
        } catch {
          toaster.create({
            title: "Warning",
            description: "Log entry created but photo upload failed. You can add photos by editing the entry.",
            type: "warning",
            duration: 7000,
          });
        }
      }

      // Success message
      const message =
        photoCount > 0
          ? `Log entry created with ${photoCount} photo${photoCount > 1 ? "s" : ""}`
          : "Log entry created successfully";

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
        title: "Error creating log entry",
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

  return (
    <Container maxW="container.lg" py={8} data-testid="create-log-page">
      <VStack gap={8} align="stretch">
        <PageNavigation items={navigationItems} />

        <PageHeader
          title="Add Log Entry"
          description="Document plant progress with observations, measurements, environment data, and photos."
          icon={Calendar}
        />

        <LogEntryForm
          onSubmit={handleSubmit}
          isLoading={createLogMutation.isPending || uploadPhotosMutation.isPending}
        />
      </VStack>
    </Container>
  );
}
