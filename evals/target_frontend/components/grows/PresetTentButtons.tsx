"use client";

/**
 * PresetTentButtons Component
 *
 * Displays quick-select buttons for common tent sizes
 */

import React from "react";
import { Box, Button, HStack, Heading } from "@chakra-ui/react";
import { TENT_PRESETS, type TentPreset } from "../../utils/tentCapacity";

interface PresetTentButtonsProps {
  onPresetSelect: (preset: TentPreset) => void;
}

export const PresetTentButtons: React.FC<PresetTentButtonsProps> = ({
  onPresetSelect,
}) => {
  return (
    <Box>
      <Heading size="sm" mb={2}>
        Quick Select Tent Size
      </Heading>
      <HStack gap={2} flexWrap="wrap">
        {TENT_PRESETS.map((preset) => (
          <Button
            key={preset.label}
            size="sm"
            variant="outline"
            onClick={() => onPresetSelect(preset)}
            data-testid={`preset-${preset.label}`}
          >
            {preset.label}
          </Button>
        ))}
      </HStack>
    </Box>
  );
};
