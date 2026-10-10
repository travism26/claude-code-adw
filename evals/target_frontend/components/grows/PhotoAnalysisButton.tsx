"use client";

/**
 * Photo Analysis Button Component
 *
 * Button for selecting and analyzing plant photos for deficiency detection.
 * Shows photo thumbnails in dropdown menu and displays results in modal.
 * Handles loading states and rate limiting.
 */

import type React from "react";
import { useState } from "react";
import {
  Button,
  MenuRoot,
  MenuTrigger,
  MenuContent,
  MenuItem,
  Text,
  VStack,
  HStack,
  Box,
  Image,
  DialogRoot,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogTitle,
  Textarea,
  Badge,
  Flex,
} from "@chakra-ui/react";
import { Camera, ChevronDown, Sparkles } from "lucide-react";
import {
  useRequestPhotoAnalysis,
  useAnalysisUsage,
  usePhotoAnalysisWebSocket,
} from "../../hooks/useGrowAI";
import { useGrowLogs } from "../../hooks/useGrowLogs";
import type { GrowLogPhoto, PhotoAnalysisResult } from "../../types";
import { toaster } from "../ChakraProvider";

interface PhotoAnalysisButtonProps {
  /** Grow ID to fetch photos from */
  growId: string;
}

/**
 * Formats date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Photo Analysis Button Component
 */
export const PhotoAnalysisButton: React.FC<PhotoAnalysisButtonProps> = ({
  growId,
}) => {
  const [selectedPhoto, setSelectedPhoto] = useState<{
    photoId: string;
    logId: string;
    filePath: string;
  } | null>(null);
  const [context, setContext] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [analysisResult, setAnalysisResult] =
    useState<PhotoAnalysisResult | null>(null);

  const { data: logsData } = useGrowLogs(growId);
  const requestMutation = useRequestPhotoAnalysis();
  const { data: usage } = useAnalysisUsage();

  const remainingAnalyses = usage?.photoAnalysisRemaining ?? 0;
  const canAnalyze = remainingAnalyses > 0;

  // Collect all photos from logs
  const photos: Array<GrowLogPhoto & { logId: string; logDate: string }> = [];
  if (logsData?.logs) {
    logsData.logs.forEach((log) => {
      if (log.photos && log.photos.length > 0) {
        log.photos.forEach((photo) => {
          photos.push({
            ...photo,
            logId: log.id,
            logDate: log.logged_at,
          });
        });
      }
    });
  }

  // Listen for photo analysis completion
  usePhotoAnalysisWebSocket((event) => {
    if (event.result && selectedPhoto?.photoId === event.photoId) {
      setAnalysisResult(event.result);
      setIsResultModalOpen(true);

      toaster.create({
        title: "Photo Analysis Complete",
        description: `Health score: ${event.result.overallHealth}/100`,
        type: "success",
      });
    }
  });

  /**
   * Handle photo analysis request
   */
  const handleAnalyze = async () => {
    if (!selectedPhoto) return;

    try {
      await requestMutation.mutateAsync({
        logId: selectedPhoto.logId,
        request: {
          photoId: selectedPhoto.photoId,
          context: context.trim() || undefined,
        },
      });

      toaster.create({
        title: "Photo Analysis Requested",
        description:
          "Analyzing photo for deficiencies. You'll be notified when complete.",
        type: "success",
      });

      // Reset context
      setContext("");
    } catch (error) {
      toaster.create({
        title: "Analysis Failed",
        description:
          error instanceof Error ? error.message : "Failed to analyze photo",
        type: "error",
      });
    }
  };

  /**
   * Handle photo selection
   */
  const handlePhotoSelect = (photo: {
    photoId: string;
    logId: string;
    filePath: string;
  }) => {
    setSelectedPhoto(photo);
    setIsMenuOpen(false);
  };

  return (
    <Box data-testid="photo-analysis-button">
      <VStack align="stretch" gap={3}>
        {/* Photo Selector */}
        <MenuRoot open={isMenuOpen} onOpenChange={(e) => setIsMenuOpen(e.open)}>
          <MenuTrigger asChild>
            <Button
              variant="outline"
              colorPalette="blue"
              disabled={photos.length === 0 || requestMutation.isPending}
              data-testid="photo-selector"
            >
              <Camera size={16} />
              {selectedPhoto ? "Photo Selected" : "Select Photo"}
              <ChevronDown size={16} />
            </Button>
          </MenuTrigger>
          <MenuContent maxH="400px" overflowY="auto">
            {photos.length === 0 ? (
              <Box p={4} textAlign="center">
                <Text color="gray.500" fontSize="sm">
                  No photos available. Add photos to your grow logs first.
                </Text>
              </Box>
            ) : (
              photos.map((photo) => (
                <MenuItem
                  key={photo.id}
                  value={photo.id}
                  onClick={() =>
                    handlePhotoSelect({
                      photoId: photo.id,
                      logId: photo.logId,
                      filePath: photo.file_path,
                    })
                  }
                  data-testid={`photo-option-${photo.id}`}
                >
                  <HStack gap={3}>
                    <Image
                      src={photo.file_path}
                      alt={photo.caption || "Plant photo"}
                      boxSize="50px"
                      objectFit="cover"
                      borderRadius="md"
                    />
                    <VStack align="start" gap={0}>
                      <Text fontSize="sm" fontWeight="medium">
                        {photo.caption || "Untitled"}
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        {formatDate(photo.logDate)}
                      </Text>
                    </VStack>
                  </HStack>
                </MenuItem>
              ))
            )}
          </MenuContent>
        </MenuRoot>

        {/* Selected Photo Preview */}
        {selectedPhoto && (
          <Box
            borderWidth="1px"
            borderColor="gray.200"
            borderRadius="md"
            p={3}
          >
            <Image
              src={selectedPhoto.filePath}
              alt="Selected photo"
              maxH="200px"
              objectFit="contain"
              borderRadius="md"
              mx="auto"
            />
          </Box>
        )}

        {/* Context Input */}
        {selectedPhoto && (
          <Textarea
            placeholder="Optional: Describe specific concerns or symptoms..."
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={2}
            data-testid="photo-context-input"
          />
        )}

        {/* Analyze Button */}
        {selectedPhoto && (
          <Button
            onClick={handleAnalyze}
            loading={requestMutation.isPending}
            disabled={!canAnalyze || requestMutation.isPending}
            colorPalette="blue"
            data-testid="submit-photo-analysis"
          >
            <Sparkles size={16} />
            {requestMutation.isPending ? "Analyzing..." : "Analyze Photo"}
          </Button>
        )}

        {/* Usage Counter */}
        <Text fontSize="xs" color="gray.500" textAlign="center">
          {canAnalyze
            ? `${remainingAnalyses} photo analyses remaining today`
            : "Daily photo analysis limit reached"}
        </Text>
      </VStack>

      {/* Results Modal */}
      {analysisResult && (
        <DialogRoot
          open={isResultModalOpen}
          onOpenChange={(e) => setIsResultModalOpen(e.open)}
          size="lg"
        >
          <DialogContent data-testid="photo-analysis-result-modal">
            <DialogHeader>
              <DialogTitle>Photo Analysis Results</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <VStack align="stretch" gap={4}>
                {/* Health Score */}
                <Box>
                  <Text fontSize="sm" color="gray.600" mb={1}>
                    Overall Health
                  </Text>
                  <Flex align="center" gap={2}>
                    <Badge
                      colorPalette={
                        analysisResult.overallHealth >= 80
                          ? "green"
                          : analysisResult.overallHealth >= 60
                            ? "yellow"
                            : "red"
                      }
                      size="lg"
                    >
                      {analysisResult.overallHealth}/100
                    </Badge>
                  </Flex>
                </Box>

                {/* Summary */}
                {analysisResult.summary && (
                  <Box>
                    <Text fontSize="sm" fontWeight="semibold" mb={1}>
                      Summary
                    </Text>
                    <Text fontSize="sm" color="gray.700">
                      {analysisResult.summary}
                    </Text>
                  </Box>
                )}

                {/* Deficiencies */}
                {analysisResult.deficiencies &&
                  analysisResult.deficiencies.length > 0 && (
                    <Box>
                      <Text fontSize="sm" fontWeight="semibold" mb={2}>
                        Detected Issues
                      </Text>
                      <VStack align="stretch" gap={2}>
                        {analysisResult.deficiencies.map((deficiency, index) => (
                          <Box
                            key={index}
                            p={3}
                            borderWidth="1px"
                            borderColor="gray.200"
                            borderRadius="md"
                          >
                            <Flex justify="space-between" mb={1}>
                              <Text fontWeight="medium" fontSize="sm">
                                {deficiency.type}
                              </Text>
                              <Badge
                                colorPalette={
                                  deficiency.severity === "high"
                                    ? "red"
                                    : deficiency.severity === "medium"
                                      ? "orange"
                                      : "yellow"
                                }
                                size="sm"
                              >
                                {deficiency.severity}
                              </Badge>
                            </Flex>
                            <Text fontSize="xs" color="gray.600">
                              {deficiency.description}
                            </Text>
                            <Text fontSize="xs" color="gray.500" mt={1}>
                              Confidence: {Math.round(deficiency.confidence * 100)}%
                            </Text>
                          </Box>
                        ))}
                      </VStack>
                    </Box>
                  )}
              </VStack>
            </DialogBody>
          </DialogContent>
        </DialogRoot>
      )}
    </Box>
  );
};
