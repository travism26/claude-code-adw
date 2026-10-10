"use client";

import React from "react";
import {
  Box,
  Grid,
  GridItem,
  IconButton,
  Image,
  Input,
  Text,
} from "@chakra-ui/react";
import { X } from "lucide-react";
import type { PhotoWithPreview } from "../../hooks/usePhotoUpload";

interface NewPhotosPreviewProps {
  photos: PhotoWithPreview[];
  onRemovePhoto: (index: number) => void;
  onCaptionChange: (index: number, caption: string) => void;
}

/**
 * NewPhotosPreview component
 * Displays preview grid of newly uploaded photos with captions
 */
export const NewPhotosPreview: React.FC<NewPhotosPreviewProps> = ({
  photos,
  onRemovePhoto,
  onCaptionChange,
}) => {
  if (photos.length === 0) return null;

  return (
    <Box mt={4}>
      <Text fontSize="sm" fontWeight="medium" mb={2}>
        New Photos ({photos.length})
      </Text>
      <Grid
        templateColumns={{
          base: "repeat(2, 1fr)",
          md: "repeat(4, 1fr)",
        }}
        gap={4}
      >
        {photos.map((photo, index) => (
          <GridItem key={index} position="relative">
            <Box borderWidth="1px" borderRadius="md" overflow="hidden">
              <Image
                src={photo.preview}
                alt={`Preview ${index + 1}`}
                width="100%"
                height="150px"
                objectFit="cover"
              />
              <IconButton
                aria-label="Remove photo"
                position="absolute"
                top={2}
                right={2}
                size="sm"
                colorPalette="red"
                onClick={() => onRemovePhoto(index)}
                data-testid={`remove-photo-${index}`}
              >
                <X size={14} />
              </IconButton>
            </Box>
            <Input
              placeholder="Add caption..."
              size="sm"
              mt={2}
              value={photo.caption}
              onChange={(e) => onCaptionChange(index, e.target.value)}
              data-testid={`photo-caption-${index}`}
            />
          </GridItem>
        ))}
      </Grid>
    </Box>
  );
};
