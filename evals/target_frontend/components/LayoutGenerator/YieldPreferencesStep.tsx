"use client";

import type React from "react";
import {
  Box,
  VStack,
  Text,
  Input,
  RadioGroup,
  Field,
  NativeSelectRoot,
  NativeSelectField,
} from "@chakra-ui/react";
import { Users, Target, LayoutGrid } from "lucide-react";

interface YieldPreferencesStepProps {
  householdSize: number;
  yieldGoal: string;
  layoutStyle: string;
  onHouseholdSizeChange: (value: number) => void;
  onYieldGoalChange: (value: string) => void;
  onLayoutStyleChange: (value: string) => void;
}

export const YieldPreferencesStep: React.FC<YieldPreferencesStepProps> = ({
  householdSize,
  yieldGoal,
  layoutStyle,
  onHouseholdSizeChange,
  onYieldGoalChange,
  onLayoutStyleChange,
}) => {
  return (
    <VStack gap={6} align="stretch" data-testid="yield-preferences-step">
      <Text fontSize="md" color="gray.700">
        Let&apos;s customize your garden layout based on your goals and household needs:
      </Text>

      {/* Household Size */}
      <Field.Root>
        <Field.Label display="flex" alignItems="center" gap={2}>
          <Box as={Users} boxSize="4" color="green.500" />
          Household Size
        </Field.Label>
        <Input
          type="number"
          min={1}
          max={10}
          value={householdSize}
          onChange={(e) => onHouseholdSizeChange(Number(e.target.value))}
          data-testid="household-size-input"
          placeholder="Number of people"
        />
        <Field.HelperText>
          How many people are you growing food for?
        </Field.HelperText>
      </Field.Root>

      {/* Yield Goal */}
      <Field.Root>
        <Field.Label display="flex" alignItems="center" gap={2}>
          <Box as={Target} boxSize="4" color="green.500" />
          What&apos;s your goal for this garden?
        </Field.Label>
        <RadioGroup.Root
          value={yieldGoal}
          onValueChange={(e) => onYieldGoalChange(e.value as string)}
          data-testid="yield-goal-radio-group"
        >
          <VStack align="stretch" gap={3}>
            <RadioGroup.Item value="fresh_eating">
              <RadioGroup.ItemHiddenInput />
              <RadioGroup.ItemControl />
              <VStack align="start" gap={0} ml={2}>
                <Text fontWeight="medium">Fresh Eating Only</Text>
                <Text fontSize="sm" color="gray.600">
                  Seasonal salads and fresh use throughout the growing season
                </Text>
              </VStack>
            </RadioGroup.Item>

            <RadioGroup.Item value="light_preservation">
              <RadioGroup.ItemHiddenInput />
              <RadioGroup.ItemControl />
              <VStack align="start" gap={0} ml={2}>
                <Text fontWeight="medium">Light Preservation</Text>
                <Text fontSize="sm" color="gray.600">
                  Some freezing and canning for a few months
                </Text>
              </VStack>
            </RadioGroup.Item>

            <RadioGroup.Item value="heavy_preservation">
              <RadioGroup.ItemHiddenInput />
              <RadioGroup.ItemControl />
              <VStack align="start" gap={0} ml={2}>
                <Text fontWeight="medium">Heavy Preservation</Text>
                <Text fontSize="sm" color="gray.600">
                  Extensive canning and freezing for year-round supply
                </Text>
              </VStack>
            </RadioGroup.Item>
          </VStack>
        </RadioGroup.Root>
      </Field.Root>

      {/* Layout Style */}
      <Field.Root>
        <Field.Label display="flex" alignItems="center" gap={2}>
          <Box as={LayoutGrid} boxSize="4" color="green.500" />
          Layout Style
        </Field.Label>
        <NativeSelectRoot>
          <NativeSelectField
            value={layoutStyle}
            onChange={(e) => onLayoutStyleChange(e.target.value)}
            data-testid="layout-style-select"
          >
            <option value="cottage">
              Cottage - Scattered, organic clusters
            </option>
            <option value="formal">
              Formal - Symmetrical, geometric design
            </option>
            <option value="four_square">
              Four-Square - Quadrants for crop rotation
            </option>
            <option value="block">
              Block Planting - Efficient, organized rectangles
            </option>
            <option value="scattered">
              Scattered - Natural, wild appearance
            </option>
          </NativeSelectField>
        </NativeSelectRoot>
        <Field.HelperText>
          Choose a visual style that matches your gardening preferences
        </Field.HelperText>
      </Field.Root>
    </VStack>
  );
};
