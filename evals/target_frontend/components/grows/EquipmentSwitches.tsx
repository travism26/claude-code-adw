"use client";

/**
 * EquipmentSwitches Component
 *
 * Renders equipment toggle switches for grow environments
 */

import React from "react";
import { Control, Controller } from "react-hook-form";
import { Box, Grid, HStack, Heading, Switch, Text } from "@chakra-ui/react";
import type { EnvironmentFormData } from "../../hooks/useEnvironmentForm";

interface EquipmentSwitchesProps {
  control: Control<EnvironmentFormData>;
}

export const EquipmentSwitches: React.FC<EquipmentSwitchesProps> = ({ control }) => {
  return (
    <Box>
      <Heading size="sm" mb={2}>
        Equipment
      </Heading>
      <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" }} gap={4}>
        <Controller
          name="has_carbon_filter"
          control={control}
          render={({ field }) => (
            <HStack>
              <Switch.Root
                checked={field.value}
                onCheckedChange={(e) => field.onChange(e.checked)}
                data-testid="has-carbon-filter-switch"
              >
                <Switch.HiddenInput />
                <Switch.Control />
              </Switch.Root>
              <Text>Carbon Filter</Text>
            </HStack>
          )}
        />

        <Controller
          name="has_humidifier"
          control={control}
          render={({ field }) => (
            <HStack>
              <Switch.Root
                checked={field.value}
                onCheckedChange={(e) => field.onChange(e.checked)}
                data-testid="has-humidifier-switch"
              >
                <Switch.HiddenInput />
                <Switch.Control />
              </Switch.Root>
              <Text>Humidifier</Text>
            </HStack>
          )}
        />

        <Controller
          name="has_dehumidifier"
          control={control}
          render={({ field }) => (
            <HStack>
              <Switch.Root
                checked={field.value}
                onCheckedChange={(e) => field.onChange(e.checked)}
                data-testid="has-dehumidifier-switch"
              >
                <Switch.HiddenInput />
                <Switch.Control />
              </Switch.Root>
              <Text>Dehumidifier</Text>
            </HStack>
          )}
        />

        <Controller
          name="has_ac"
          control={control}
          render={({ field }) => (
            <HStack>
              <Switch.Root
                checked={field.value}
                onCheckedChange={(e) => field.onChange(e.checked)}
                data-testid="has-ac-switch"
              >
                <Switch.HiddenInput />
                <Switch.Control />
              </Switch.Root>
              <Text>Air Conditioning</Text>
            </HStack>
          )}
        />

        <Controller
          name="has_heater"
          control={control}
          render={({ field }) => (
            <HStack>
              <Switch.Root
                checked={field.value}
                onCheckedChange={(e) => field.onChange(e.checked)}
                data-testid="has-heater-switch"
              >
                <Switch.HiddenInput />
                <Switch.Control />
              </Switch.Root>
              <Text>Heater</Text>
            </HStack>
          )}
        />
      </Grid>
    </Box>
  );
};
