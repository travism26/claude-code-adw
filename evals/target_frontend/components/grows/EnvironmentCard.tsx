"use client";

import React from "react";
import {
  Badge,
  Box,
  Card,
  HStack,
  Heading,
  IconButton,
  Text,
  VStack,
} from "@chakra-ui/react";
import {
  Pencil,
  Trash2,
  Lightbulb,
  Wind,
  Droplets,
  Thermometer,
  Snowflake,
  Flame,
} from "lucide-react";
import { CapacityStatusIndicator } from "../environments/CapacityStatusIndicator";
import { formatDimensions } from "../../utils/tentCapacity";
import { getTypeIcon, getTypeName } from "../../utils/environmentTypes";
import type { GrowEnvironment } from "../../types/growEnvironment";

interface EnvironmentCardProps {
  environment: GrowEnvironment;
  onEdit: (env: GrowEnvironment) => void;
  onDelete: (env: GrowEnvironment) => void;
  capacityStatus?: {
    status: import("../../types/environmentOverview").CapacityStatus;
    currentPlants: number;
    maxPlants: number | null;
    utilizationPercent: number | null;
  };
}

export const EnvironmentCard: React.FC<EnvironmentCardProps> = ({
  environment,
  onEdit,
  onDelete,
  capacityStatus,
}) => {
  const growCount = environment.grows?.length || 0;
  return (
    <Card.Root data-testid={`environment-card-${environment.id}`}>
      <Card.Body>
        <VStack align="stretch" gap={3}>
          <HStack justify="space-between">
            <HStack gap={2}>
              {getTypeIcon(environment.type)}
              <Heading size="md">{environment.name}</Heading>
            </HStack>
            <HStack gap={1}>
              <IconButton
                aria-label="Edit environment"
                size="sm"
                variant="ghost"
                onClick={() => onEdit(environment)}
                data-testid={`edit-environment-${environment.id}`}
              >
                <Pencil size={16} />
              </IconButton>
              <IconButton
                aria-label="Delete environment"
                size="sm"
                variant="ghost"
                colorScheme="red"
                onClick={() => onDelete(environment)}
                data-testid={`delete-environment-${environment.id}`}
              >
                <Trash2 size={16} />
              </IconButton>
            </HStack>
          </HStack>
          <HStack gap={2} flexWrap="wrap">
            <Badge colorScheme="blue">{getTypeName(environment.type)}</Badge>
            {!environment.is_active && <Badge colorScheme="gray">Inactive</Badge>}
            {capacityStatus && capacityStatus.maxPlants !== null && (
              <Box data-testid={`capacity-indicator-${environment.id}`}>
                <CapacityStatusIndicator
                  status={capacityStatus.status}
                  utilizationPercent={capacityStatus.utilizationPercent}
                  size="sm"
                />
              </Box>
            )}
          </HStack>
          {environment.width_inches && environment.depth_inches && (
            <Text fontSize="sm" color="gray.600">
              {formatDimensions(
                environment.width_inches,
                environment.depth_inches,
                environment.height_inches
              )}
            </Text>
          )}
          {environment.light_type && environment.light_wattage && (
            <HStack fontSize="sm" color="gray.600">
              <Lightbulb size={14} />
              <Text>
                {environment.light_wattage}W {environment.light_type.toUpperCase()}
              </Text>
            </HStack>
          )}
          {environment.ventilation_cfm && (
            <HStack fontSize="sm" color="gray.600">
              <Wind size={14} />
              <Text>{environment.ventilation_cfm} CFM</Text>
            </HStack>
          )}
          <HStack gap={2} flexWrap="wrap">
            {environment.has_carbon_filter && (
              <Badge size="sm" variant="outline" title="Carbon Filter">
                <Wind size={12} />
              </Badge>
            )}
            {environment.has_humidifier && (
              <Badge size="sm" variant="outline" colorScheme="blue" title="Humidifier">
                <Droplets size={12} />
              </Badge>
            )}
            {environment.has_dehumidifier && (
              <Badge size="sm" variant="outline" colorScheme="orange" title="Dehumidifier">
                <Thermometer size={12} />
              </Badge>
            )}
            {environment.has_ac && (
              <Badge size="sm" variant="outline" colorScheme="cyan" title="A/C">
                <Snowflake size={12} />
              </Badge>
            )}
            {environment.has_heater && (
              <Badge size="sm" variant="outline" colorScheme="red" title="Heater">
                <Flame size={12} />
              </Badge>
            )}
          </HStack>
          <HStack justify="space-between" pt={2} borderTopWidth={1}>
            <Text fontSize="sm" color="gray.600">
              {growCount} {growCount === 1 ? "grow" : "grows"} active
            </Text>
            {capacityStatus && capacityStatus.maxPlants !== null ? (
              <Text
                fontSize="sm"
                fontWeight="medium"
                color={
                  capacityStatus.status === "over"
                    ? "red.600"
                    : capacityStatus.status === "warning"
                    ? "orange.600"
                    : "gray.600"
                }
                data-testid={`capacity-text-${environment.id}`}
              >
                {capacityStatus.currentPlants}/{capacityStatus.maxPlants} plants
              </Text>
            ) : environment.max_plants ? (
              <Text fontSize="sm" color="gray.600">
                Max: {environment.max_plants} plants
              </Text>
            ) : null}
          </HStack>
        </VStack>
      </Card.Body>
    </Card.Root>
  );
};
