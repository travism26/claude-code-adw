"use client";

/**
 * QuickScheduleModal Component
 *
 * Modal for quick event creation using predefined templates.
 * Supports 4 common scheduling patterns with preview.
 */

import React, { useState } from "react";
import {
  Box,
  Button,
  Field,
  Grid,
  HStack,
  Input,
  NativeSelectField,
  NativeSelectRoot,
  Text,
  VStack,
} from "@chakra-ui/react";
import {
  DialogActionTrigger,
  DialogBackdrop,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogPositioner,
  DialogRoot,
  DialogTitle,
} from "@chakra-ui/react";
import { Droplet, Droplets, Leaf } from "lucide-react";
import { RRule } from "rrule";
import { useQuickCreateEvent } from "@/hooks/useSchedule";
import { useGrows } from "@/hooks/useGrows";
import { useGardens } from "@/hooks/useGardens";
import { usePlants } from "@/hooks/usePlants";
import { toaster } from "@/components/ChakraProvider";
import type {
  EntityType,
  QuickCreateTemplate,
  QuickCreateInput,
} from "@/types/schedule";

interface QuickScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType?: EntityType;
  entityId?: string;
  onSuccess?: () => void;
}

interface TemplateConfig {
  id: QuickCreateTemplate;
  name: string;
  description: string;
  icon: React.ReactNode;
  rrule: string;
}

/**
 * Predefined quick-create templates
 */
const TEMPLATES: TemplateConfig[] = [
  {
    id: "daily_watering",
    name: "Daily Watering",
    description: "Water your plants every day",
    icon: <Droplet size={24} />,
    rrule: "FREQ=DAILY;INTERVAL=1",
  },
  {
    id: "every_other_day",
    name: "Every Other Day Watering",
    description: "Water every 2 days",
    icon: <Droplets size={24} />,
    rrule: "FREQ=DAILY;INTERVAL=2",
  },
  {
    id: "weekly_feeding",
    name: "Weekly Feeding",
    description: "Feed once per week",
    icon: <Leaf size={24} />,
    rrule: "FREQ=WEEKLY;INTERVAL=1",
  },
  {
    id: "bi_weekly_feeding",
    name: "Bi-Weekly Feeding",
    description: "Feed every 2 weeks",
    icon: <Leaf size={24} />,
    rrule: "FREQ=WEEKLY;INTERVAL=2",
  },
];

/**
 * QuickScheduleModal component
 * Provides template selection and quick event creation
 */
export const QuickScheduleModal: React.FC<QuickScheduleModalProps> = ({
  isOpen,
  onClose,
  entityType: preselectedEntityType,
  entityId: preselectedEntityId,
  onSuccess,
}) => {
  const [selectedTemplate, setSelectedTemplate] =
    useState<TemplateConfig | null>(null);
  const [entityType, setEntityType] = useState<EntityType>(
    preselectedEntityType || "grow"
  );
  const [entityId, setEntityId] = useState<string>(preselectedEntityId || "");
  const [startDate, setStartDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  const quickCreate = useQuickCreateEvent();
  const { data: growsData } = useGrows();
  const { data: gardensData } = useGardens();
  const { plants } = usePlants();

  // Get available entities based on entity type
  const getEntityOptions = () => {
    switch (entityType) {
      case "grow":
        return growsData?.grows || [];
      case "garden":
        return gardensData || [];
      case "plant":
        return plants || [];
      default:
        return [];
    }
  };

  const entityOptions = getEntityOptions();

  // Generate preview occurrences
  const getPreviewOccurrences = (): string[] => {
    if (!selectedTemplate) return [];

    try {
      const rule = new RRule({
        ...RRule.parseString(selectedTemplate.rrule),
        dtstart: new Date(startDate),
        count: 3,
      });

      const dates = rule.all();
      return dates.map((date) =>
        date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      );
    } catch (err) {
      return [];
    }
  };

  const previewOccurrences = getPreviewOccurrences();

  const handleTemplateSelect = (template: TemplateConfig) => {
    setSelectedTemplate(template);
  };

  const handleSubmit = async () => {
    if (!selectedTemplate || !entityId) {
      toaster.create({
        title: "Missing Information",
        description: "Please select an entity before creating the event",
        type: "error",
      });
      return;
    }

    const input: QuickCreateInput = {
      template: selectedTemplate.id,
      entityType,
      entityId,
      startDate: new Date(startDate).toISOString(),
    };

    try {
      await quickCreate.mutateAsync(input);
      toaster.create({
        title: "Event Created",
        description: `${selectedTemplate.name} event created successfully`,
        type: "success",
      });
      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      toaster.create({
        title: "Failed to Create Event",
        description: error.message || "An error occurred",
        type: "error",
      });
    }
  };

  const handleReset = () => {
    setSelectedTemplate(null);
    setEntityType(preselectedEntityType || "grow");
    setEntityId(preselectedEntityId || "");
    setStartDate(new Date().toISOString().slice(0, 10));
  };

  return (
    <DialogRoot
      open={isOpen}
      onOpenChange={(e) => {
        if (!e.open) {
          handleReset();
          onClose();
        }
      }}
      size="xl"
      scrollBehavior="inside"
      placement="center"
    >
      <DialogBackdrop />
      <DialogPositioner>
        <DialogContent maxH="85vh" my={4} data-testid="quick-schedule-modal">
          <DialogHeader>
            <DialogTitle>Quick Schedule</DialogTitle>
            <DialogCloseTrigger />
          </DialogHeader>

          <DialogBody overflowY="auto" pb={6}>
          <VStack align="stretch" gap={6}>
            {!selectedTemplate ? (
              /* Template Selection */
              <>
                <Text fontSize="sm" color="gray.600">
                  Choose a scheduling template to get started quickly
                </Text>
                <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
                  {TEMPLATES.map((template) => (
                    <Box
                      key={template.id}
                      p={4}
                      borderWidth={1}
                      borderRadius="md"
                      cursor="pointer"
                      _hover={{ bg: "blue.50", borderColor: "blue.500" }}
                      onClick={() => handleTemplateSelect(template)}
                      data-testid={`template-card-${template.id}`}
                    >
                      <HStack gap={3}>
                        <Box color="blue.500">{template.icon}</Box>
                        <VStack align="start" gap={0}>
                          <Text fontWeight="bold">{template.name}</Text>
                          <Text fontSize="sm" color="gray.600">
                            {template.description}
                          </Text>
                        </VStack>
                      </HStack>
                    </Box>
                  ))}
                </Grid>
              </>
            ) : (
              /* Template Configuration */
              <>
                <Box
                  p={4}
                  bg="blue.50"
                  borderRadius="md"
                  borderWidth={1}
                  borderColor="blue.500"
                >
                  <HStack gap={3}>
                    <Box color="blue.500">{selectedTemplate.icon}</Box>
                    <VStack align="start" gap={0}>
                      <Text fontWeight="bold">{selectedTemplate.name}</Text>
                      <Text fontSize="sm" color="gray.700">
                        {selectedTemplate.description}
                      </Text>
                    </VStack>
                  </HStack>
                </Box>

                {/* Entity Type Selector */}
                {!preselectedEntityType && (
                  <Field.Root>
                    <Field.Label>Entity Type</Field.Label>
                    <NativeSelectRoot>
                      <NativeSelectField
                        value={entityType}
                        onChange={(e) =>
                          setEntityType(e.target.value as EntityType)
                        }
                      >
                        <option value="grow">Grow</option>
                        <option value="garden">Garden</option>
                        <option value="plant">Plant</option>
                      </NativeSelectField>
                    </NativeSelectRoot>
                  </Field.Root>
                )}

                {/* Entity ID Selector */}
                {!preselectedEntityId && (
                  <Field.Root>
                    <Field.Label>
                      {entityType === "grow" && "Select Grow"}
                      {entityType === "garden" && "Select Garden"}
                      {entityType === "plant" && "Select Plant"}
                    </Field.Label>
                    <NativeSelectRoot>
                      <NativeSelectField
                        value={entityId}
                        onChange={(e) => setEntityId(e.target.value)}
                      >
                        <option value="">-- Select --</option>
                        {entityOptions.map((entity: any) => (
                          <option key={entity.id} value={entity.id}>
                            {entity.name || entity.title || entity.id}
                          </option>
                        ))}
                      </NativeSelectField>
                    </NativeSelectRoot>
                  </Field.Root>
                )}

                {/* Start Date */}
                <Field.Root>
                  <Field.Label>Start Date</Field.Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </Field.Root>

                {/* Preview */}
                <Box borderWidth={1} borderRadius="md" p={3} bg="gray.50">
                  <Text fontWeight="bold" fontSize="sm" mb={2}>
                    Next 3 occurrences:
                  </Text>
                  {previewOccurrences.length > 0 ? (
                    <VStack align="start" gap={1}>
                      {previewOccurrences.map((date, index) => (
                        <Text key={index} fontSize="sm" color="gray.700">
                          {index + 1}. {date}
                        </Text>
                      ))}
                    </VStack>
                  ) : (
                    <Text fontSize="sm" color="gray.500">
                      No occurrences to preview
                    </Text>
                  )}
                </Box>
              </>
            )}
          </VStack>
        </DialogBody>

        <DialogFooter>
          <HStack gap={2}>
            {selectedTemplate && (
              <Button variant="outline" onClick={handleReset}>
                Back
              </Button>
            )}
            <DialogActionTrigger asChild>
              <Button variant="outline">Cancel</Button>
            </DialogActionTrigger>
            {selectedTemplate && (
              <Button
                colorScheme="blue"
                onClick={handleSubmit}
                loading={quickCreate.isPending}
                disabled={!entityId}
              >
                Create Event
              </Button>
            )}
          </HStack>
        </DialogFooter>
        </DialogContent>
      </DialogPositioner>
    </DialogRoot>
  );
};
