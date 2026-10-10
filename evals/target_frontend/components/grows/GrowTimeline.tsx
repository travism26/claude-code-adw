"use client";

/**
 * Grow Timeline Component
 *
 * Displays a chronological timeline of log entries grouped by date.
 * Shows phase transition markers and includes add entry button.
 * Supports sorting (newest first / oldest first) and loading/empty states.
 */

import type React from "react";
import { useState, useMemo } from "react";
import {
  Box,
  Flex,
  Text,
  Button,
  VStack,
  Spinner,
  Badge,
} from "@chakra-ui/react";
import { Plus, ArrowUp, ArrowDown, Calendar } from "lucide-react";
import { useRouter } from "next/navigation";
import type { GrowLog, GroupedLogs, LogSortOrder } from "../../types";
import { GrowLogCard } from "./GrowLogCard";
import { PhotoGallery } from "./PhotoGallery";
import { useGrowLogs } from "../../hooks/useGrowLogs";

interface GrowTimelineProps {
  /** Grow ID to fetch logs for */
  growId: string;
}

/**
 * Formats date for group headers (e.g., "February 10, 2026")
 */
function formatDateHeader(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Groups logs by date for timeline display
 */
function groupLogsByDate(logs: GrowLog[]): GroupedLogs[] {
  const grouped = new Map<string, GrowLog[]>();

  logs.forEach((log) => {
    const dateKey = new Date(log.logged_at).toDateString();
    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, []);
    }
    grouped.get(dateKey)!.push(log);
  });

  return Array.from(grouped.entries()).map(([dateKey, logs]) => ({
    date: formatDateHeader(dateKey),
    logs: logs.sort(
      (a, b) =>
        new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()
    ),
  }));
}

/**
 * Detects phase transitions between consecutive logs
 */
function detectPhaseTransition(
  currentLog: GrowLog,
  previousLog: GrowLog | undefined
): boolean {
  if (!previousLog) return false;
  return currentLog.phase !== previousLog.phase;
}

/**
 * Grow Timeline Component
 * Renders the timeline of log entries with date grouping
 */
export const GrowTimeline: React.FC<GrowTimelineProps> = ({ growId }) => {
  const router = useRouter();
  const [sortOrder, setSortOrder] = useState<LogSortOrder>("newest_first");
  const [selectedLog, setSelectedLog] = useState<GrowLog | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);

  const { data, isLoading, error } = useGrowLogs(growId);

  // Sort and group logs
  const groupedLogs = useMemo(() => {
    if (!data?.logs) return [];

    const sorted = [...data.logs].sort((a, b) => {
      const dateA = new Date(a.logged_at).getTime();
      const dateB = new Date(b.logged_at).getTime();
      return sortOrder === "newest_first" ? dateB - dateA : dateA - dateB;
    });

    return groupLogsByDate(sorted);
  }, [data?.logs, sortOrder]);

  const handleViewPhotos = (log: GrowLog, index: number) => {
    setSelectedLog(log);
    setPhotoIndex(index);
    setIsGalleryOpen(true);
  };

  const handleAddEntry = () => {
    router.push(`/grows/${growId}/log`);
  };

  const handleEditLog = (log: GrowLog) => {
    router.push(`/grows/${growId}/log/${log.id}`);
  };

  const handleDeleteLog = (_log: GrowLog) => {
    // TODO: Implement with a confirmation dialog
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) =>
      prev === "newest_first" ? "oldest_first" : "newest_first"
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <VStack gap={4} py={8} data-testid="grow-timeline-loading">
        <Spinner size="lg" colorPalette="green" />
        <Text color="gray.600">Loading timeline...</Text>
      </VStack>
    );
  }

  // Error state
  if (error) {
    return (
      <Box
        p={6}
        borderWidth="1px"
        borderRadius="md"
        borderColor="red.200"
        bg="red.50"
      >
        <Text color="red.700" fontWeight="semibold" mb={2}>
          Error loading timeline
        </Text>
        <Text color="red.600" fontSize="sm">
          {error.message}
        </Text>
      </Box>
    );
  }

  // Empty state
  if (!data?.logs || data.logs.length === 0) {
    return (
      <VStack gap={4} py={12} data-testid="grow-timeline-empty">
        <Box as={Calendar} boxSize="12" color="gray.300" />
        <Text fontSize="lg" fontWeight="semibold" color="gray.600">
          No log entries yet
        </Text>
        <Text color="gray.500" textAlign="center" maxW="md">
          Start documenting your grow journey by adding your first log entry.
          Track growth progress, environmental conditions, and photos.
        </Text>
        <Button
          colorPalette="green"
          onClick={handleAddEntry}
          data-testid="add-entry-btn"
        >
          <Plus />
          Add First Entry
        </Button>
      </VStack>
    );
  }

  return (
    <Box data-testid="grow-timeline" position="relative">
      {/* Sort Toggle */}
      <Flex justify="space-between" align="center" mb={4}>
        <Text fontSize="sm" color="gray.600">
          {data.total} {data.total === 1 ? "entry" : "entries"}
        </Text>
        <Button
          size="sm"
          variant="outline"
          onClick={toggleSortOrder}
          data-testid="sort-toggle"
        >
          {sortOrder === "newest_first" ? <ArrowDown /> : <ArrowUp />}
          {sortOrder === "newest_first" ? "Newest First" : "Oldest First"}
        </Button>
      </Flex>

      {/* Timeline */}
      <VStack align="stretch" gap={6}>
        {groupedLogs.map((group, groupIndex) => (
          <Box key={group.date}>
            {/* Date Header */}
            <Flex
              align="center"
              gap={2}
              mb={4}
              pb={2}
              borderBottomWidth="2px"
              borderColor="gray.300"
              data-testid="date-header"
            >
              <Box as={Calendar} boxSize="5" color="gray.600" />
              <Text fontSize="lg" fontWeight="semibold" color="gray.700">
                {group.date}
              </Text>
            </Flex>

            {/* Log Entries */}
            <VStack align="stretch" gap={3}>
              {group.logs.map((log, logIndex) => {
                const previousLog =
                  logIndex > 0 ? group.logs[logIndex - 1] : undefined;
                const hasPhaseTransition = detectPhaseTransition(log, previousLog);

                return (
                  <Box key={log.id}>
                    {/* Phase Transition Marker */}
                    {hasPhaseTransition && (
                      <Flex
                        align="center"
                        justify="center"
                        my={4}
                        data-testid="phase-transition-marker"
                      >
                        <Badge
                          colorPalette="purple"
                          fontSize="sm"
                          px={3}
                          py={1}
                        >
                          Phase changed to {log.phase}
                        </Badge>
                      </Flex>
                    )}

                    {/* Log Card */}
                    <GrowLogCard
                      log={log}
                      onEdit={handleEditLog}
                      onDelete={handleDeleteLog}
                      onViewPhotos={handleViewPhotos}
                    />
                  </Box>
                );
              })}
            </VStack>
          </Box>
        ))}
      </VStack>

      {/* Floating Add Entry Button */}
      <Button
        position="fixed"
        bottom={8}
        right={8}
        colorPalette="green"
        size="lg"
        borderRadius="full"
        shadow="lg"
        onClick={handleAddEntry}
        data-testid="add-entry-fab"
        aria-label="Add log entry"
        zIndex={10}
      >
        <Plus />
      </Button>

      {/* Photo Gallery Modal */}
      {selectedLog && selectedLog.photos && (
        <PhotoGallery
          photos={selectedLog.photos}
          initialIndex={photoIndex}
          isOpen={isGalleryOpen}
          onClose={() => setIsGalleryOpen(false)}
        />
      )}
    </Box>
  );
};
