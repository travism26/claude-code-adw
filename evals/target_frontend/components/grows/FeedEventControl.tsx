"use client";

/**
 * Plan↔log control for one feeding week: mark the week done / skipped / planned,
 * back-date when it was performed, and record measured EC/pH. A "done" event is
 * logged once in the grow timeline (handled server-side).
 */

import { useState } from "react";
import { Box, HStack, Text, Badge, Button, Input } from "@chakra-ui/react";
import { useMarkFeedEvent } from "../../hooks/useFeedEvents";
import type { FeedEvent } from "../../types/feedEvent";

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  planned: { label: "Planned", color: "gray" },
  done: { label: "Done", color: "green" },
  skipped: { label: "Skipped", color: "yellow" },
};

interface ReadingsDraft {
  open: boolean;
  performedAt: string;
  ec: string;
  ph: string;
}

export function FeedEventControl({
  growId,
  weekNumber,
  event,
}: {
  growId: string;
  weekNumber: number;
  event?: FeedEvent;
}) {
  const mark = useMarkFeedEvent();
  const status = event?.status ?? "planned";
  const badge = STATUS_BADGE[status];

  // One state object keeps this component within the architecture's
  // useState budget (readings draft seeded from the event via key remount).
  const [draft, setDraft] = useState<ReadingsDraft>({
    open: false,
    performedAt: event?.performed_at ? event.performed_at.slice(0, 10) : "",
    ec: event?.measured_ec != null ? String(event.measured_ec) : "",
    ph: event?.measured_ph != null ? String(event.measured_ph) : "",
  });
  const patch = (p: Partial<ReadingsDraft>) => setDraft((d) => ({ ...d, ...p }));

  const send = (data: Parameters<typeof mark.mutate>[0]["data"]) =>
    mark.mutate({ growId, weekNumber, data });

  return (
    <Box mt={3} pt={3} borderTopWidth={1} borderColor="gray.100" data-testid={`feed-event-${weekNumber}`}>
      <HStack justify="space-between" flexWrap="wrap" gap={2}>
        <HStack gap={2}>
          <Badge colorPalette={badge.color} data-testid={`feed-event-status-${weekNumber}`}>
            {badge.label}
          </Badge>
          {status === "done" && event?.performed_at && (
            <Text fontSize="xs" color="gray.500" data-testid={`feed-event-date-${weekNumber}`}>
              {event.performed_at.slice(0, 10)}
            </Text>
          )}
        </HStack>
        <HStack gap={2}>
          <Button
            size="xs"
            colorPalette="green"
            variant={status === "done" ? "solid" : "outline"}
            loading={mark.isPending}
            data-testid={`mark-done-${weekNumber}`}
            onClick={() => send({ status: "done" })}
          >
            Done
          </Button>
          <Button
            size="xs"
            colorPalette="yellow"
            variant={status === "skipped" ? "solid" : "outline"}
            loading={mark.isPending}
            data-testid={`mark-skip-${weekNumber}`}
            onClick={() => send({ status: "skipped" })}
          >
            Skip
          </Button>
          {status !== "planned" && (
            <Button
              size="xs"
              variant="ghost"
              data-testid={`mark-planned-${weekNumber}`}
              onClick={() => send({ status: "planned" })}
            >
              Reset
            </Button>
          )}
          <Button
            size="xs"
            variant="ghost"
            data-testid={`toggle-readings-${weekNumber}`}
            onClick={() => patch({ open: !draft.open })}
          >
            Readings
          </Button>
        </HStack>
      </HStack>

      {draft.open && (
        <HStack mt={2} gap={2} flexWrap="wrap" align="flex-end" data-testid={`readings-form-${weekNumber}`}>
          <Box>
            <Text fontSize="xs" color="gray.500">Date</Text>
            <Input
              type="date"
              size="xs"
              maxW="150px"
              value={draft.performedAt}
              data-testid={`performed-at-${weekNumber}`}
              onChange={(e) => patch({ performedAt: e.target.value })}
            />
          </Box>
          <Box>
            <Text fontSize="xs" color="gray.500">EC</Text>
            <Input
              type="number"
              step="0.1"
              size="xs"
              maxW="90px"
              value={draft.ec}
              data-testid={`measured-ec-${weekNumber}`}
              onChange={(e) => patch({ ec: e.target.value })}
            />
          </Box>
          <Box>
            <Text fontSize="xs" color="gray.500">pH</Text>
            <Input
              type="number"
              step="0.1"
              size="xs"
              maxW="90px"
              value={draft.ph}
              data-testid={`measured-ph-${weekNumber}`}
              onChange={(e) => patch({ ph: e.target.value })}
            />
          </Box>
          <Button
            size="xs"
            colorPalette="green"
            loading={mark.isPending}
            data-testid={`save-readings-${weekNumber}`}
            onClick={() =>
              send({
                status: "done",
                performed_at: draft.performedAt || undefined,
                measured_ec: draft.ec === "" ? null : Number(draft.ec),
                measured_ph: draft.ph === "" ? null : Number(draft.ph),
              })
            }
          >
            Save reading
          </Button>
        </HStack>
      )}
    </Box>
  );
}

export default FeedEventControl;
