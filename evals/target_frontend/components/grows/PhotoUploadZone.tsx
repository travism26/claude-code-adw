"use client";

import React from "react";
import { Box, Input, Text, VStack } from "@chakra-ui/react";
import { Upload } from "lucide-react";

interface PhotoUploadZoneProps {
  onFileSelect: (files: FileList | null) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  photoErrors?: string[];
}

/**
 * PhotoUploadZone component
 * Drag-and-drop zone for uploading photos
 */
export const PhotoUploadZone: React.FC<PhotoUploadZoneProps> = ({
  onFileSelect,
  onDragOver,
  onDrop,
  photoErrors = [],
}) => {
  return (
    <>
      <Box
        borderWidth="2px"
        borderStyle="dashed"
        borderRadius="md"
        borderColor="gray.300"
        p={8}
        textAlign="center"
        cursor="pointer"
        _hover={{ borderColor: "green.500", bg: "gray.50" }}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onClick={() => document.getElementById("photo-input")?.click()}
        data-testid="photo-drop-zone"
      >
        <VStack gap={2}>
          <Upload size={32} color="gray" />
          <Text fontWeight="medium">Drop photos here or click to upload</Text>
          <Text fontSize="sm" color="gray.600">
            JPEG, PNG, WebP up to 10MB each (max 10 photos)
          </Text>
        </VStack>
        <Input
          id="photo-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          multiple
          display="none"
          onChange={(e) => onFileSelect(e.target.files)}
        />
      </Box>

      {/* Photo Errors */}
      {photoErrors.length > 0 && (
        <Box mt={2}>
          {photoErrors.map((error, index) => (
            <Text key={index} fontSize="sm" color="red.500">
              {error}
            </Text>
          ))}
        </Box>
      )}
    </>
  );
};
