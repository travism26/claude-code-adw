"use client";

/**
 * Feeding "today" agenda — "what do I feed today" across all the user's active
 * grows. Each due grow shows its current week's recipe with strength/reservoir
 * adjusted mix amounts and one-tap done/skip. Completed items stay visible.
 */

import NextLink from "next/link";
import {
  Container,
  VStack,
  HStack,
  Box,
  Heading,
  Text,
  Button,
  Badge,
  Card,
  Spinner,
  Flex,
} from "@chakra-ui/react";
import { ArrowLeft, CalendarDays, Check, SkipForward } from "lucide-react";
import { useFeedingToday } from "../../../hooks/useFeedingToday";
import { useMarkFeedEvent } from "../../../hooks/useFeedEvents";
import { fmt, convertDose } from "../../../components/grows/feedingUnits";
import type { DueFeeding } from "../../../types/feedingToday";

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  planned: { label: "Due", color: "orange" },
  done: { label: "Done", color: "green" },
  skipped: { label: "Skipped", color: "yellow" },
};

function DueCard({ due }: { due: DueFeeding }) {
  const mark = useMarkFeedEvent();
  const badge = STATUS_BADGE[due.status];
  const act = (status: "done" | "skipped") =>
    mark.mutate({ growId: due.grow_id, weekNumber: due.week_number, data: { status } });

  return (
    <Card.Root data-testid={`due-grow-${due.grow_id}`} borderLeftWidth={4} borderLeftColor="green.400">
      <Card.Body p={4}>
        <Flex justify="space-between" align="flex-start" flexWrap="wrap" gap={2} mb={2}>
          <HStack gap={2}>
            <Heading size="sm" data-testid="due-strain">{due.strain_name}</Heading>
            <Badge colorPalette="gray" variant="subtle">Week {due.week_number}</Badge>
            {due.segment && (
              <Badge colorPalette={due.segment === "flower" ? "purple" : "green"} variant="subtle">
                {due.segment === "flower" ? "Flower" : "Veg"}
              </Badge>
            )}
            {due.is_flush && <Badge colorPalette="orange" variant="subtle">Flush</Badge>}
            {due.is_water_only && !due.is_flush && (
              <Badge colorPalette="blue" variant="subtle">Water only</Badge>
            )}
            <Badge colorPalette={badge.color} data-testid={`due-status-${due.grow_id}`}>
              {badge.label}
            </Badge>
          </HStack>
          <HStack gap={2}>
            <Button
              size="xs"
              colorPalette="green"
              variant={due.status === "done" ? "solid" : "outline"}
              loading={mark.isPending}
              data-testid={`due-done-${due.grow_id}`}
              onClick={() => act("done")}
            >
              <Check size={14} /> Done
            </Button>
            <Button
              size="xs"
              colorPalette="yellow"
              variant={due.status === "skipped" ? "solid" : "outline"}
              loading={mark.isPending}
              data-testid={`due-skip-${due.grow_id}`}
              onClick={() => act("skipped")}
            >
              <SkipForward size={14} /> Skip
            </Button>
            <Button asChild size="xs" variant="ghost">
              <NextLink href={`/grows/${due.grow_id}`}>Open</NextLink>
            </Button>
          </HStack>
        </Flex>

        {due.items.length === 0 ? (
          <Text fontSize="sm" color="gray.400">
            {due.is_water_only ? "Plain water this week" : "No nutrients this week"}
          </Text>
        ) : (
          <VStack align="stretch" gap={1}>
            {due.items.map((it) => {
              const rate =
                it.adjusted_ml_per_gallon != null
                  ? convertDose(it.adjusted_ml_per_gallon, due.display_unit)
                  : null;
              return (
                <HStack key={it.nutrient_id} justify="space-between" fontSize="sm" gap={3}>
                  <Text color="gray.700">{it.name}</Text>
                  <Text color="gray.500" data-testid="due-dose" textAlign="right">
                    {rate != null ? `${fmt(rate)} ${due.display_unit}` : "—"}
                    {it.mix_ml != null && (
                      <Text as="span" color="green.600" data-testid="due-mix">
                        {" "}· mix {fmt(it.mix_ml)} ml
                      </Text>
                    )}
                  </Text>
                </HStack>
              );
            })}
          </VStack>
        )}
        {due.reservoir_gallons != null && (
          <Text fontSize="xs" color="gray.500" mt={2}>
            Mixed for {fmt(due.reservoir_gallons)} gal · {due.strength_pct}% strength
          </Text>
        )}
      </Card.Body>
    </Card.Root>
  );
}

export default function FeedingTodayPage() {
  const { data, isLoading, error } = useFeedingToday();
  const due = data?.due ?? [];
  const pending = due.filter((d) => d.status === "planned").length;

  return (
    <Container maxW="3xl" py={8}>
      <HStack mb={6} justify="space-between" flexWrap="wrap" gap={3}>
        <HStack gap={3}>
          <Button asChild variant="ghost" size="sm">
            <NextLink href="/grows">
              <ArrowLeft size={16} /> Grows
            </NextLink>
          </Button>
          <Heading size="lg">Today&apos;s feeding</Heading>
        </HStack>
        {pending > 0 && (
          <Badge colorPalette="orange" data-testid="due-count">{pending} due</Badge>
        )}
      </HStack>

      {isLoading ? (
        <Flex justify="center" py={12}>
          <Spinner color="green.500" />
        </Flex>
      ) : error ? (
        <Text color="red.600" data-testid="feeding-today-error">
          Failed to load today&apos;s feeding
        </Text>
      ) : due.length === 0 ? (
        <VStack gap={4} py={16} data-testid="feeding-today-empty" align="center">
          <Box as={CalendarDays} boxSize={10} color="gray.300" />
          <Text color="gray.600">Nothing due to feed today</Text>
          <Text fontSize="sm" color="gray.500" textAlign="center" maxW="md">
            Active grows with a feeding schedule will show their current week here.
          </Text>
        </VStack>
      ) : (
        <VStack align="stretch" gap={3} data-testid="feeding-today-list">
          {due.map((d) => (
            <DueCard key={d.grow_id} due={d} />
          ))}
        </VStack>
      )}
    </Container>
  );
}
