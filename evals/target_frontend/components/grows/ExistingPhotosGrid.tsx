"use client";

import React from "react";
import {
  Box,
  Grid,
  GridItem,
  HStack,
  IconButton,
  Image,
  Text,
} from "@chakra-ui/react";
import { Star, X } from "lucide-react";
import type { GrowLogPhoto } from "../../types";

interface ExistingPhotosGridProps {
  photos: GrowLogPhoto[];
  onDeletePhoto?: (photoId: string) => Promise<void>;
  onSetCoverPhoto?: (photoId: string) => Promise<void>;
}

/**
 * ExistingPhotosGrid component
 * Displays grid of existing photos with cover photo indicator and delete button
 */
export const ExistingPhotosGrid: React.FC<ExistingPhotosGridProps> = ({
  photos,
  onDeletePhoto,
  onSetCoverPhoto,
}) => {
  if (photos.length === 0) return null;

  return (
    <Box mb={4}>
      <Text fontSize="sm" fontWeight="medium" mb={2}>
        Existing Photos ({photos.length})
      </Text>
      <Grid
        templateColumns={{
          base: "repeat(2, 1fr)",
          md: "repeat(4, 1fr)",
        }}
        gap={4}
      >
        {photos.map((photo) => (
          <GridItem key={photo.id} position="relative">
            <Box
              borderWidth="1px"
              borderRadius="md"
              overflow="hidden"
              position="relative"
            >
              <Image
                src={photo.thumbnail_path || photo.file_path}
                alt={photo.caption || photo.original_filename}
                width="100%"
                height="150px"
                objectFit="cover"
              />
              {photo.is_cover && (
                <Box
                  position="absolute"
                  top={2}
                  left={2}
                  bg="yellow.400"
                  color="white"
                  p={1}
                  borderRadius="sm"
                >
                  <Star size={16} fill="white" />
                </Box>
              )}
              <HStack position="absolute" top={2} right={2} gap={1}>
                {!photo.is_cover && onSetCoverPhoto && (
                  <IconButton
                    aria-label="Set as cover photo"
                    size="sm"
                    colorPalette="yellow"
                    onClick={() => onSetCoverPhoto(photo.id)}
                  >
                    <Star size={14} />
                  </IconButton>
                )}
                {onDeletePhoto && (
                  <IconButton
                    aria-label="Delete photo"
                    size="sm"
                    colorPalette="red"
                    onClick={() => onDeletePhoto(photo.id)}
                    data-testid={`delete-existing-photo-${photo.id}`}
                  >
                    <X size={14} />
                  </IconButton>
                )}
              </HStack>
            </Box>
            {photo.caption && (
              <Text fontSize="xs" mt={1} lineClamp={2}>
                {photo.caption}
              </Text>
            )}
          </GridItem>
        ))}
      </Grid>
    </Box>
  );
};
