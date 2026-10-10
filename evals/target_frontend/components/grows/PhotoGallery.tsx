"use client";

/**
 * Photo Gallery Component
 *
 * Modal image viewer with swipe navigation for viewing full-size photos.
 * Supports keyboard navigation (arrow keys, escape) and displays captions.
 * Shared component used by both grow detail page and log entry forms.
 */

import type React from "react";
import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Flex,
  Text,
  Button,
  Badge,
  Image,
  DialogRoot,
  DialogContent,
  DialogBody,
  DialogCloseTrigger,
} from "@chakra-ui/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { GrowLogPhoto } from "../../types";

interface PhotoGalleryProps {
  /** Array of photos to display */
  photos: GrowLogPhoto[];
  /** Initial photo index to display */
  initialIndex?: number;
  /** Whether the gallery is open */
  isOpen: boolean;
  /** Handler for closing the gallery */
  onClose: () => void;
}

/**
 * Photo Gallery Component
 * Renders a modal with full-size photo viewer and navigation
 */
export const PhotoGallery: React.FC<PhotoGalleryProps> = ({
  photos,
  initialIndex = 0,
  isOpen,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const currentPhoto = photos[currentIndex];
  const hasMultiplePhotos = photos.length > 1;

  // Update current index when initialIndex changes
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  // Navigate to previous photo
  const handlePrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
  }, [photos.length]);

  // Navigate to next photo
  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
  }, [photos.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowLeft":
          handlePrevious();
          break;
        case "ArrowRight":
          handleNext();
          break;
        case "Escape":
          onClose();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handlePrevious, handleNext, onClose]);

  if (!currentPhoto) return null;

  return (
    <DialogRoot
      open={isOpen}
      onOpenChange={(e) => !e.open && onClose()}
      size="full"
      data-testid="photo-gallery"
    >
      <DialogContent bg="blackAlpha.900" maxW="100vw" maxH="100vh">
        <DialogCloseTrigger
          position="absolute"
          top={4}
          right={4}
          color="white"
          zIndex={10}
          data-testid="close-gallery"
        />

        <DialogBody p={0}>
          <Flex
            direction="column"
            align="center"
            justify="center"
            height="100vh"
            position="relative"
          >
            {/* Photo Counter */}
            {hasMultiplePhotos && (
              <Badge
                position="absolute"
                top={4}
                left="50%"
                transform="translateX(-50%)"
                colorPalette="gray"
                fontSize="sm"
                zIndex={10}
              >
                {currentIndex + 1} / {photos.length}
              </Badge>
            )}

            {/* Main Image Container */}
            <Box
              position="relative"
              maxW="90vw"
              maxH="80vh"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Image
                src={currentPhoto.file_path}
                alt={currentPhoto.caption || `Photo ${currentIndex + 1}`}
                objectFit="contain"
                maxW="100%"
                maxH="80vh"
                borderRadius="md"
              />

              {/* Cover Photo Badge */}
              {currentPhoto.is_cover && (
                <Badge
                  position="absolute"
                  top={4}
                  right={4}
                  colorPalette="green"
                  fontSize="sm"
                >
                  Cover Photo
                </Badge>
              )}
            </Box>

            {/* Navigation Arrows */}
            {hasMultiplePhotos && (
              <>
                <Button
                  position="absolute"
                  left={4}
                  top="50%"
                  transform="translateY(-50%)"
                  onClick={handlePrevious}
                  variant="solid"
                  size="lg"
                  borderRadius="full"
                  bg="blackAlpha.700"
                  color="white"
                  _hover={{ bg: "blackAlpha.800" }}
                  aria-label="Previous photo"
                  data-testid="photo-nav-left"
                >
                  <ChevronLeft />
                </Button>

                <Button
                  position="absolute"
                  right={4}
                  top="50%"
                  transform="translateY(-50%)"
                  onClick={handleNext}
                  variant="solid"
                  size="lg"
                  borderRadius="full"
                  bg="blackAlpha.700"
                  color="white"
                  _hover={{ bg: "blackAlpha.800" }}
                  aria-label="Next photo"
                  data-testid="photo-nav-right"
                >
                  <ChevronRight />
                </Button>
              </>
            )}

            {/* Caption */}
            {currentPhoto.caption && (
              <Box
                position="absolute"
                bottom={4}
                left="50%"
                transform="translateX(-50%)"
                maxW="80%"
                bg="blackAlpha.800"
                px={4}
                py={2}
                borderRadius="md"
              >
                <Text color="white" textAlign="center" fontSize="sm">
                  {currentPhoto.caption}
                </Text>
              </Box>
            )}

            {/* Filename Display */}
            <Box
              position="absolute"
              top={16}
              left={4}
              bg="blackAlpha.700"
              px={3}
              py={1}
              borderRadius="md"
            >
              <Text color="gray.300" fontSize="xs">
                {currentPhoto.original_filename}
              </Text>
            </Box>
          </Flex>
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
};
