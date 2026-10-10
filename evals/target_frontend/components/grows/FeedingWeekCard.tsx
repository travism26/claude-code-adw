"use client";

/**
 * One week row in the feeding calendar: number + mapped date range, assigned
 * nutrients (dose adjusted for strength %, mixed for the reservoir), per-week
 * EC/PPM/pH targets, and the plan↔log control.
 */

import { HStack, VStack, Heading, Text, Badge, Card } from "@chakra-ui/react";
import { FeedEventControl } from "./FeedEventControl";
import { fmt, convertDose } from "./feedingUnits";
import type { FeedEvent } from "../../types/feedEvent";
import type { GrowFeedingWeek, WeekNutrient } from "../../types/feedingSchedule";

function NutrientLine({
  wn,
  strengthPct,
  reservoir,
  displayUnit,
}: {
  wn: WeekNutrient;
  strengthPct: number;
  reservoir: number | null;
  displayUnit: string;
}) {
  const name = wn.nutrient
    ? `${wn.nutrient.brand} ${wn.nutrient.product_name}`
    : "Nutrient";
  const base = wn.dosage_ml_per_gallon;
  const adjusted = base != null ? (base * strengthPct) / 100 : null; // canonical ml/gal
  const rate = adjusted != null ? convertDose(adjusted, displayUnit) : null;
  const mixMl = adjusted != null && reservoir != null ? adjusted * reservoir : null; // mix is ml
  return (
    <HStack justify="space-between" fontSize="sm" gap={3}>
      <Text color="gray.700">{name}</Text>
      {rate != null && (
        <Text color="gray.500" data-testid="nutrient-dose" textAlign="right">
          {fmt(rate)} {displayUnit}
          {strengthPct !== 100 && base != null && (
            <Text as="span" color="gray.400">
              {" "}
              (of {fmt(convertDose(base, displayUnit))})
            </Text>
          )}
          {mixMl != null && (
            <Text as="span" color="green.600" data-testid="mix-amount">
              {" "}
              · mix {fmt(mixMl)} ml
            </Text>
          )}
        </Text>
      )}
    </HStack>
  );
}

export function WeekCard({
  week,
  strengthPct,
  reservoir,
  displayUnit,
  ppmScale,
  growId,
  feedEvent,
}: {
  week: GrowFeedingWeek;
  strengthPct: number;
  reservoir: number | null;
  displayUnit: string;
  ppmScale: number;
  growId: string;
  feedEvent?: FeedEvent;
}) {
  const hasTargets =
    week.ec_min != null || week.ppm_min != null || week.ph_min != null;
  return (
    <Card.Root
      data-testid={`feeding-week-${week.week_number}`}
      borderLeftWidth={4}
      borderLeftColor={week.is_current ? "green.500" : "gray.200"}
      bg={week.is_current ? "green.50" : "white"}
    >
      <Card.Body p={4}>
        <HStack justify="space-between" mb={2}>
          <HStack gap={2}>
            <Heading size="sm">Week {week.week_number}</Heading>
            {week.segment && (
              <Badge
                colorPalette={week.segment === "flower" ? "purple" : "green"}
                variant="subtle"
                data-testid="week-segment"
              >
                {week.segment === "flower" ? "Flower" : "Veg"}
              </Badge>
            )}
            {week.is_current && (
              <Badge colorPalette="green" data-testid="current-week-badge">
                Current
              </Badge>
            )}
            {week.is_flush && (
              <Badge colorPalette="orange" variant="subtle" data-testid="flush-badge">
                Flush
              </Badge>
            )}
            {week.is_water_only && !week.is_flush && (
              <Badge colorPalette="blue" variant="subtle" data-testid="water-badge">
                Water only
              </Badge>
            )}
          </HStack>
          {week.date_start ? (
            <Text fontSize="xs" color="gray.500">
              {week.date_start} – {week.date_end}
            </Text>
          ) : week.pending_flip ? (
            <Text fontSize="xs" color="gray.400">
              after flip
            </Text>
          ) : null}
        </HStack>
        {week.weekNutrients.length === 0 ? (
          <Text fontSize="sm" color="gray.400">
            No nutrients this week
          </Text>
        ) : (
          <VStack align="stretch" gap={1}>
            {week.weekNutrients.map((wn) => (
              <NutrientLine
                key={wn.id}
                wn={wn}
                strengthPct={strengthPct}
                reservoir={reservoir}
                displayUnit={displayUnit}
              />
            ))}
          </VStack>
        )}
        {hasTargets && (
          <HStack mt={2} gap={4} fontSize="xs" color="gray.500" data-testid="week-targets" flexWrap="wrap">
            {week.ec_min != null && (
              <Text>
                EC {fmt(week.ec_min)}
                {week.ec_max != null ? `–${fmt(week.ec_max)}` : ""}
              </Text>
            )}
            {week.ppm_min != null && (
              <Text>
                {week.ppm_min}
                {week.ppm_max != null ? `–${week.ppm_max}` : ""} PPM@{ppmScale}
              </Text>
            )}
            {week.ph_min != null && (
              <Text>
                pH {fmt(week.ph_min)}
                {week.ph_max != null ? `–${fmt(week.ph_max)}` : ""}
              </Text>
            )}
          </HStack>
        )}
        <FeedEventControl
          key={feedEvent?.id ?? week.week_number}
          growId={growId}
          weekNumber={week.week_number}
          event={feedEvent}
        />
      </Card.Body>
    </Card.Root>
  );
}

export default WeekCard;
