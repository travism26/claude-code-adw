"use client";

/**
 * Grow Log Card Component
 *
 * Displays a single log entry card with date, phase, height, notes,
 * environment summary, and photo thumbnails.
 */

import type React from "react";
import { useState } from "react";
import {
  Box,
  Flex,
  Text,
  Badge,
  Card,
  VStack,
  HStack,
  Button,
  Image,
  Grid,
  Menu,
} from "@chakra-ui/react";
import {
  Calendar,
  Thermometer,
  Droplet,
  TestTube,
  Zap,
  Sun,
  MoreVertical,
  Edit,
  Trash2,
  Image as ImageIcon,
} from "lucide-react";
import type { GrowLog } from "../../types";
import { PhaseBadge } from "./PhaseBadge";

interface GrowLogCardProps {
  /** Log entry data to display */
  log: GrowLog;
  /** Optional handler for edit action */
  onEdit?: (log: GrowLog) => void;
  /** Optional handler for delete action */
  onDelete?: (log: GrowLog) => void;
  /** Optional handler for viewing photos */
  onViewPhotos?: (log: GrowLog, initialIndex: number) => void;
}

/**
 * Formats date for display (e.g., "Monday, Feb 10, 2026")
 */
function formatLogDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Formats time for display (e.g., "3:45 PM")
 */
function formatLogTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Truncates notes text for preview
 */
function truncateNotes(notes: string, maxLength: number = 200): { text: string; isTruncated: boolean } {
  if (notes.length <= maxLength) {
    return { text: notes, isTruncated: false };
  }
  return {
    text: notes.substring(0, maxLength) + "...",
    isTruncated: true,
  };
}

/**
 * Grow Log Card Component
 * Renders a card displaying a single log entry
 */
export const GrowLogCard: React.FC<GrowLogCardProps> = ({
  log,
  onEdit,
  onDelete,
  onViewPhotos,
}) => {
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);

  const formattedDate = formatLogDate(log.logged_at);
  const formattedTime = formatLogTime(log.logged_at);
  const hasNotes = log.notes && log.notes.trim().length > 0;
  const hasEnvironment = !!log.environment;
  const hasPhotos = log.photos && log.photos.length > 0;
  const photoCount = log.photos?.length || 0;
  const visiblePhotos = log.photos?.slice(0, 4) || [];
  const remainingPhotos = Math.max(0, photoCount - 4);

  const { text: notesText, isTruncated } = hasNotes
    ? truncateNotes(log.notes!, 200)
    : { text: "", isTruncated: false };

  return (
    <Card.Root data-testid="grow-log-card" mb={4}>
      <Card.Header>
        <Flex justify="space-between" align="flex-start">
          {/* Left: Date and Phase */}
          <VStack align="flex-start" gap={1}>
            <Text fontSize="lg" fontWeight="semibold" data-testid="log-date">
              {formattedDate}
            </Text>
            <Text fontSize="sm" color="gray.600">
              {formattedTime}
            </Text>
          </VStack>

          {/* Right: Phase Badge and Actions */}
          <HStack gap={2}>
            {log.day_number !== null && (
              <Badge colorPalette="blue" fontSize="sm">
                Day {log.day_number}
              </Badge>
            )}
            <PhaseBadge phase={log.phase} size="md" />

            {(onEdit || onDelete) && (
              <Menu.Root>
                <Menu.Trigger asChild>
                  <Button size="sm" variant="ghost" aria-label="Log actions">
                    <MoreVertical />
                  </Button>
                </Menu.Trigger>
                <Menu.Content>
                  {onEdit && (
                    <Menu.Item value="edit" onClick={() => onEdit(log)}>
                      <Edit />
                      Edit
                    </Menu.Item>
                  )}
                  {onDelete && (
                    <Menu.Item value="delete" onClick={() => onDelete(log)}>
                      <Trash2 />
                      Delete
                    </Menu.Item>
                  )}
                </Menu.Content>
              </Menu.Root>
            )}
          </HStack>
        </Flex>
      </Card.Header>

      <Card.Body>
        <VStack align="stretch" gap={4}>
          {/* Height Measurement */}
          {log.height_inches !== null && (
            <Flex align="center" gap={2} fontSize="sm">
              <Text fontWeight="semibold">Height:</Text>
              <Text>{log.height_inches} inches</Text>
            </Flex>
          )}

          {/* Notes */}
          {hasNotes && (
            <Box data-testid="log-notes">
              <Text fontSize="sm" color="gray.700" whiteSpace="pre-wrap">
                {isNotesExpanded ? log.notes : notesText}
              </Text>
              {isTruncated && (
                <Button
                  size="sm"
                  variant="ghost"
                  colorPalette="blue"
                  mt={2}
                  onClick={() => setIsNotesExpanded(!isNotesExpanded)}
                >
                  {isNotesExpanded ? "Show less" : "Show more"}
                </Button>
              )}
            </Box>
          )}

          {/* Environment Summary */}
          {hasEnvironment && log.environment && (
            <Box
              p={3}
              borderWidth="1px"
              borderRadius="md"
              borderColor="gray.200"
              bg="gray.50"
              data-testid="log-environment"
            >
              <Text fontSize="sm" fontWeight="semibold" mb={2}>
                Environment
              </Text>
              <Grid
                templateColumns={{ base: "repeat(2, 1fr)", md: "repeat(3, 1fr)", lg: "repeat(4, 1fr)" }}
                gap={3}
              >
                {log.environment.temperature_f !== null && (
                  <Flex align="center" gap={1.5} fontSize="sm">
                    <Box as={Thermometer} boxSize="4" color="red.500" />
                    <Text>{log.environment.temperature_f}°F</Text>
                  </Flex>
                )}
                {log.environment.humidity_percent !== null && (
                  <Flex align="center" gap={1.5} fontSize="sm">
                    <Box as={Droplet} boxSize="4" color="blue.500" />
                    <Text>{log.environment.humidity_percent}% RH</Text>
                  </Flex>
                )}
                {log.environment.ph !== null && (
                  <Flex align="center" gap={1.5} fontSize="sm">
                    <Box as={TestTube} boxSize="4" color="purple.500" />
                    <Text>pH {log.environment.ph}</Text>
                  </Flex>
                )}
                {log.environment.ec !== null && (
                  <Flex align="center" gap={1.5} fontSize="sm">
                    <Box as={Zap} boxSize="4" color="yellow.500" />
                    <Text>EC {log.environment.ec}</Text>
                  </Flex>
                )}
                {log.environment.ppm !== null && (
                  <Flex align="center" gap={1.5} fontSize="sm">
                    <Box as={Zap} boxSize="4" color="orange.500" />
                    <Text>{log.environment.ppm} PPM</Text>
                  </Flex>
                )}
                {log.environment.light_hours !== null && (
                  <Flex align="center" gap={1.5} fontSize="sm">
                    <Box as={Sun} boxSize="4" color="yellow.600" />
                    <Text>{log.environment.light_hours}h light</Text>
                  </Flex>
                )}
                {log.environment.vpd !== null && (
                  <Flex align="center" gap={1.5} fontSize="sm">
                    <Box as={Droplet} boxSize="4" color="teal.500" />
                    <Text>VPD {log.environment.vpd}</Text>
                  </Flex>
                )}
                {log.environment.co2_ppm !== null && (
                  <Flex align="center" gap={1.5} fontSize="sm">
                    <Text fontSize="xs" fontWeight="semibold">CO₂</Text>
                    <Text>{log.environment.co2_ppm} PPM</Text>
                  </Flex>
                )}
              </Grid>
            </Box>
          )}

          {/* Photo Thumbnails */}
          {hasPhotos && (
            <Box data-testid="log-photos">
              <Flex justify="space-between" align="center" mb={2}>
                <Text fontSize="sm" fontWeight="semibold">
                  Photos ({photoCount})
                </Text>
                {photoCount > 4 && onViewPhotos && (
                  <Button
                    size="sm"
                    variant="ghost"
                    colorPalette="blue"
                    onClick={() => onViewPhotos(log, 0)}
                  >
                    View all {photoCount}
                  </Button>
                )}
              </Flex>

              <Grid
                templateColumns={{ base: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }}
                gap={2}
              >
                {visiblePhotos.map((photo, index) => (
                  <Box
                    key={photo.id}
                    position="relative"
                    aspectRatio="1"
                    borderRadius="md"
                    overflow="hidden"
                    cursor="pointer"
                    onClick={() => onViewPhotos?.(log, index)}
                    _hover={{ opacity: 0.8 }}
                    transition="opacity 0.2s"
                  >
                    <Image
                      src={photo.thumbnail_path || photo.file_path}
                      alt={photo.caption || `Photo ${index + 1}`}
                      objectFit="cover"
                      width="100%"
                      height="100%"
                    />
                    {photo.is_cover && (
                      <Badge
                        position="absolute"
                        top={2}
                        right={2}
                        colorPalette="green"
                        fontSize="xs"
                      >
                        Cover
                      </Badge>
                    )}
                  </Box>
                ))}

                {remainingPhotos > 0 && onViewPhotos && (
                  <Flex
                    aspectRatio="1"
                    borderRadius="md"
                    borderWidth="2px"
                    borderStyle="dashed"
                    borderColor="gray.300"
                    align="center"
                    justify="center"
                    cursor="pointer"
                    onClick={() => onViewPhotos(log, 4)}
                    _hover={{ bg: "gray.50" }}
                    transition="background 0.2s"
                  >
                    <VStack gap={1}>
                      <Box as={ImageIcon} boxSize="6" color="gray.400" />
                      <Text fontSize="sm" color="gray.600">
                        +{remainingPhotos} more
                      </Text>
                    </VStack>
                  </Flex>
                )}
              </Grid>
            </Box>
          )}
        </VStack>
      </Card.Body>
    </Card.Root>
  );
};
