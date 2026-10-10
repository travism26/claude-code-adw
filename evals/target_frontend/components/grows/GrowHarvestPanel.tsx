"use client";

/**
 * Grow Harvest Panel — record/edit a grow's harvest and show cultivation
 * efficiency metrics (drying %, g/W, g/ft²), weights, potency, quality, notes.
 * Backed by the real GrowHarvest record via /grows/:id/harvest.
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
  Grid,
  Button,
  Spinner,
} from "@chakra-ui/react";
import { Scale, Zap, Square, Award, Calendar, Pencil, Plus } from "lucide-react";
import type { Grow } from "../../types";
import { useGrowHarvest, useSaveHarvest } from "../../hooks/useGrowHarvest";
import { HarvestForm } from "./HarvestForm";
import { toaster } from "./../ChakraProvider";

interface GrowHarvestPanelProps {
  grow: Grow;
}

const dryingEfficiencyPct = (wet: number, dry: number) =>
  wet === 0 ? 0 : Math.round((dry / wet) * 100);
const gramPerWatt = (dry: number, w: number) =>
  w === 0 ? 0 : Math.round((dry / w) * 100) / 100;
const gramPerSqft = (dry: number, sqft: number) =>
  sqft === 0 ? 0 : Math.round((dry / sqft) * 100) / 100;
const formatDate = (s: string) =>
  new Date(s).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
const efficiencyColor = (value: number, benchmark: number) => {
  if (value >= benchmark * 1.2) return "green";
  if (value >= benchmark) return "teal";
  if (value >= benchmark * 0.8) return "yellow";
  return "orange";
};

export const GrowHarvestPanel: React.FC<GrowHarvestPanelProps> = ({ grow }) => {
  const { data, isLoading } = useGrowHarvest(grow.id);
  const saveMut = useSaveHarvest();
  const [editing, setEditing] = useState(false);

  const harvest = data?.harvest ?? null;

  if (isLoading) {
    return (
      <Flex justify="center" py={10}>
        <Spinner color="green.500" />
      </Flex>
    );
  }

  if (editing) {
    return (
      <VStack align="stretch" gap={4} data-testid="harvest-form-wrap">
        <HarvestForm
          initial={harvest}
          saving={saveMut.isPending}
          onSubmit={(d) =>
            saveMut.mutate(
              { growId: grow.id, data: d, isUpdate: !!harvest },
              {
                onSuccess: () => {
                  setEditing(false);
                  toaster.create({ title: "Harvest saved", type: "success", duration: 3000 });
                },
                onError: (e) =>
                  toaster.create({
                    title: "Failed to save harvest",
                    description: e instanceof Error ? e.message : undefined,
                    type: "error",
                    duration: 5000,
                  }),
              }
            )
          }
        />
        <Button variant="ghost" alignSelf="flex-start" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </VStack>
    );
  }

  if (!harvest) {
    return (
      <VStack gap={4} py={12} data-testid="harvest-panel-empty">
        <Box as={Scale} boxSize="12" color="gray.300" />
        <Text fontSize="lg" fontWeight="semibold" color="gray.600">
          This grow has not been harvested yet
        </Text>
        <Text color="gray.500" textAlign="center" maxW="md">
          Record your harvest to track weights, potency, and cultivation efficiency.
        </Text>
        <Button colorPalette="green" data-testid="record-harvest-btn" onClick={() => setEditing(true)}>
          <Plus size={16} /> Record harvest
        </Button>
      </VStack>
    );
  }

  const wet = harvest.wet_weight_grams ?? 0;
  const dry = harvest.dry_weight_grams ?? 0;
  const efficiency = wet && dry ? dryingEfficiencyPct(wet, dry) : null;
  const gpw = dry && grow.light_wattage ? gramPerWatt(dry, grow.light_wattage) : null;
  const gpsf = dry && grow.grow_space_sqft ? gramPerSqft(dry, grow.grow_space_sqft) : null;

  return (
    <Box data-testid="harvest-panel">
      <Flex align="center" justify="space-between" mb={6} flexWrap="wrap" gap={3}>
        <Flex align="center" gap={2}>
          <Box as={Calendar} boxSize="5" color="green.500" />
          <VStack align="flex-start" gap={0}>
            <Text fontSize="sm" color="gray.600">Harvested on</Text>
            <Text fontSize="lg" fontWeight="semibold" data-testid="harvest-date">
              {formatDate(harvest.harvested_at)}
            </Text>
          </VStack>
        </Flex>
        <Button size="sm" variant="outline" data-testid="edit-harvest-btn" onClick={() => setEditing(true)}>
          <Pencil size={14} /> Edit
        </Button>
      </Flex>

      <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={4} mb={6}>
        {wet > 0 && (
          <Card.Root data-testid="wet-weight">
            <Card.Body>
              <Flex align="center" gap={2} mb={1}>
                <Box as={Scale} boxSize="5" color="blue.500" />
                <Text fontSize="sm" color="gray.600">Wet weight</Text>
              </Flex>
              <Text fontSize="2xl" fontWeight="bold">{wet}g</Text>
            </Card.Body>
          </Card.Root>
        )}
        {dry > 0 && (
          <Card.Root data-testid="dry-weight">
            <Card.Body>
              <Flex align="center" gap={2} mb={1}>
                <Box as={Scale} boxSize="5" color="green.500" />
                <Text fontSize="sm" color="gray.600">Dry weight</Text>
              </Flex>
              <Text fontSize="2xl" fontWeight="bold" color="green.600">{dry}g</Text>
            </Card.Body>
          </Card.Root>
        )}
        {harvest.trim_weight_grams != null && harvest.trim_weight_grams > 0 && (
          <Card.Root data-testid="trim-weight">
            <Card.Body>
              <Flex align="center" gap={2} mb={1}>
                <Box as={Scale} boxSize="5" color="orange.400" />
                <Text fontSize="sm" color="gray.600">Trim</Text>
              </Flex>
              <Text fontSize="2xl" fontWeight="bold">{harvest.trim_weight_grams}g</Text>
            </Card.Body>
          </Card.Root>
        )}
      </Grid>

      {(efficiency !== null || gpw !== null || gpsf !== null) && (
        <Card.Root mb={6} data-testid="efficiency-metrics">
          <Card.Header>
            <Text fontSize="lg" fontWeight="semibold">Efficiency metrics</Text>
          </Card.Header>
          <Card.Body>
            <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={4}>
              {efficiency !== null && (
                <Box>
                  <Text fontSize="sm" color="gray.600" mb={1}>Drying efficiency</Text>
                  <Text fontSize="xl" fontWeight="semibold">{efficiency}%</Text>
                </Box>
              )}
              {gpw !== null && (
                <Box>
                  <Flex align="center" gap={1.5} mb={1}>
                    <Box as={Zap} boxSize="4" color="yellow.500" />
                    <Text fontSize="sm" color="gray.600">Grams per watt</Text>
                  </Flex>
                  <Badge colorPalette={efficiencyColor(gpw, 0.5)} fontSize="lg" px={2} py={1}>
                    {gpw} g/W
                  </Badge>
                </Box>
              )}
              {gpsf !== null && (
                <Box>
                  <Flex align="center" gap={1.5} mb={1}>
                    <Box as={Square} boxSize="4" color="purple.500" />
                    <Text fontSize="sm" color="gray.600">Grams per sq ft</Text>
                  </Flex>
                  <Text fontSize="xl" fontWeight="semibold">{gpsf} g/ft²</Text>
                </Box>
              )}
            </Grid>
          </Card.Body>
        </Card.Root>
      )}

      {(harvest.thc_percent != null || harvest.cbd_percent != null) && (
        <Card.Root mb={6}>
          <Card.Header><Text fontSize="lg" fontWeight="semibold">Potency</Text></Card.Header>
          <Card.Body>
            <HStack gap={6}>
              {harvest.thc_percent != null && (
                <Box>
                  <Text fontSize="sm" color="gray.600" mb={1}>THC</Text>
                  <Text fontSize="2xl" fontWeight="bold" color="purple.600">{harvest.thc_percent}%</Text>
                </Box>
              )}
              {harvest.cbd_percent != null && (
                <Box>
                  <Text fontSize="sm" color="gray.600" mb={1}>CBD</Text>
                  <Text fontSize="2xl" fontWeight="bold" color="green.600">{harvest.cbd_percent}%</Text>
                </Box>
              )}
            </HStack>
          </Card.Body>
        </Card.Root>
      )}

      {harvest.quality_rating != null && (
        <Card.Root mb={6}>
          <Card.Header>
            <Flex align="center" gap={2}>
              <Box as={Award} boxSize="5" color="yellow.500" />
              <Text fontSize="lg" fontWeight="semibold">Quality rating</Text>
            </Flex>
          </Card.Header>
          <Card.Body>
            <HStack gap={1} data-testid="quality-stars">
              {Array.from({ length: 5 }).map((_, i) => (
                <Box key={i} as={Award} boxSize="6" color={i < harvest.quality_rating! ? "yellow.400" : "gray.300"} />
              ))}
            </HStack>
          </Card.Body>
        </Card.Root>
      )}

      {harvest.smoke_report && (
        <Card.Root>
          <Card.Header><Text fontSize="lg" fontWeight="semibold">Smoke report</Text></Card.Header>
          <Card.Body>
            <Text fontSize="sm" color="gray.700" whiteSpace="pre-wrap">{harvest.smoke_report}</Text>
          </Card.Body>
        </Card.Root>
      )}
    </Box>
  );
};

export default GrowHarvestPanel;
