"use client";

/**
 * Grow Detail Page
 *
 * Comprehensive view of a single cannabis cultivation cycle.
 * Features:
 * - Grow header with strain info, phase, stats, and actions
 * - Tabbed interface: Timeline, Nutrients, Harvest, Settings
 * - Timeline tab: Chronological log entries with photos
 * - Nutrients tab: Configured nutrients with dosage/frequency
 * - Harvest tab: Harvest data and efficiency metrics
 * - Settings tab: Grow configuration and management
 * - Loading states with skeletons
 * - Error handling and not found states
 * - Breadcrumb navigation
 */

import React from "react";
import { useParams, useRouter } from "next/navigation";
import NextLink from "next/link";
import {
  Box,
  Flex,
  Heading,
  Text,
  VStack,
  Button,
  Card,
  Tabs,
} from "@chakra-ui/react";
import { Home, ChevronRight } from "lucide-react";
import { useGrow } from "../../../hooks/useGrows";
import { GrowHeader } from "../../../components/grows/GrowHeader";
import { GrowTimeline } from "../../../components/grows/GrowTimeline";
import { GrowNutrientList } from "../../../components/grows/GrowNutrientList";
import { FeedingSchedulePanel } from "../../../components/grows/FeedingSchedulePanel";
import { GrowHarvestPanel } from "../../../components/grows/GrowHarvestPanel";
import { GrowAIPanel } from "../../../components/grows/GrowAIPanel";
import { PageStateContainer } from "../../../components/grows/PageStateContainer";
import { ConfigFieldDisplay } from "../../../components/grows/ConfigFieldDisplay";
import { ConfigurationGrid } from "../../../components/grows/ConfigurationGrid";

export default function GrowDetailPage() {
  const params = useParams();
  const router = useRouter();
  const growId = params.id as string;

  const { data: grow, isLoading, error } = useGrow(growId);

  // Handle loading, error, and empty states
  if (isLoading || error || !grow) {
    return (
      <PageStateContainer
        isLoading={isLoading}
        error={error}
        isEmpty={!grow && !isLoading && !error}
        errorTitle="Error loading grow"
        emptyTitle="Grow not found"
        emptyMessage="The grow you're looking for doesn't exist or you don't have access to it."
        backLink="/grows"
        backLinkText="Back to Grows"
        loadingVariant="detail"
        testId="grow-detail-page"
      >
        {null}
      </PageStateContainer>
    );
  }

  return (
    <PageStateContainer
      isLoading={false}
      error={null}
      testId="grow-detail-page"
    >
      <VStack gap={6} align="stretch">
        {/* Breadcrumb Navigation */}
        <Flex
          align="center"
          gap={2}
          fontSize="sm"
          color="gray.600"
          flexWrap="wrap"
        >
          <Button
            asChild
            size="xs"
            variant="ghost"
          >
            <NextLink href="/">
              <Home size={14} />
              Home
            </NextLink>
          </Button>
          <ChevronRight size={14} />
          <Button
            asChild
            size="xs"
            variant="ghost"
          >
            <NextLink href="/grows">Grows</NextLink>
          </Button>
          <ChevronRight size={14} />
          <Text fontWeight="semibold" color="gray.900">
            {grow.strain_name}
          </Text>
        </Flex>

        {/* Grow Header */}
        <GrowHeader grow={grow} />

        {/* Tabbed Interface */}
        <Tabs.Root
          defaultValue="timeline"
          variant="enclosed"
          colorPalette="green"
          data-testid="grow-tabs"
        >
          <Tabs.List>
            <Tabs.Trigger value="timeline" data-testid="timeline-tab">
              Timeline
            </Tabs.Trigger>
            <Tabs.Trigger value="ai-analysis" data-testid="ai-analysis-tab">
              AI Analysis
            </Tabs.Trigger>
            <Tabs.Trigger value="nutrients" data-testid="nutrients-tab">
              Nutrients
            </Tabs.Trigger>
            <Tabs.Trigger value="feeding" data-testid="feeding-tab">
              Feeding
            </Tabs.Trigger>
            <Tabs.Trigger value="harvest" data-testid="harvest-tab">
              Harvest
            </Tabs.Trigger>
            <Tabs.Trigger value="settings" data-testid="settings-tab">
              Settings
            </Tabs.Trigger>
          </Tabs.List>

          {/* Timeline Tab */}
          <Tabs.Content value="timeline" pt={6}>
            <GrowTimeline growId={growId} />
          </Tabs.Content>

          {/* AI Analysis Tab */}
          <Tabs.Content value="ai-analysis" pt={6}>
            <GrowAIPanel growId={growId} />
          </Tabs.Content>

          {/* Nutrients Tab */}
          <Tabs.Content value="nutrients" pt={6}>
            <GrowNutrientList growId={growId} />
          </Tabs.Content>

          {/* Feeding Tab */}
          <Tabs.Content value="feeding" pt={6}>
            <FeedingSchedulePanel growId={growId} />
          </Tabs.Content>

          {/* Harvest Tab */}
          <Tabs.Content value="harvest" pt={6}>
            <GrowHarvestPanel grow={grow} />
          </Tabs.Content>

          {/* Settings Tab */}
          <Tabs.Content value="settings" pt={6}>
            <VStack align="stretch" gap={6}>
              {/* Grow Configuration */}
              <ConfigurationGrid
                title="Grow Configuration"
                footer={
                  grow.notes && (
                    <Box>
                      <Text fontSize="sm" color="gray.600" mb={1}>
                        Notes
                      </Text>
                      <Text fontSize="sm" whiteSpace="pre-wrap">
                        {grow.notes}
                      </Text>
                    </Box>
                  )
                }
              >
                <ConfigFieldDisplay label="Strain Name" value={grow.strain_name} />
                <ConfigFieldDisplay
                  label="Strain Type"
                  value={grow.strain_type ? grow.strain_type.charAt(0).toUpperCase() + grow.strain_type.slice(1) : undefined}
                  condition={!!grow.strain_type}
                />
                <ConfigFieldDisplay label="Grow Method" value={grow.grow_method} condition={!!grow.grow_method} />
                <ConfigFieldDisplay label="Grow Medium" value={grow.grow_medium} condition={!!grow.grow_medium} />
                <ConfigFieldDisplay label="Light Type" value={grow.light_type} condition={!!grow.light_type} />
                <ConfigFieldDisplay label="Light Wattage" value={grow.light_wattage} suffix="W" condition={!!grow.light_wattage} />
                <ConfigFieldDisplay label="Grow Space" value={grow.grow_space_sqft} suffix=" sq ft" condition={!!grow.grow_space_sqft} />
                <ConfigFieldDisplay label="Pot Size" value={grow.pot_size_gallons} suffix=" gallons" condition={!!grow.pot_size_gallons} />
                <ConfigFieldDisplay label="Plant Count" value={grow.plant_count} />
                <ConfigFieldDisplay
                  label="Started"
                  value={new Date(grow.started_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                />
                <ConfigFieldDisplay
                  label="Visibility"
                  value={grow.is_public ? "Public" : "Private"}
                  asBadge
                  badgeColor={grow.is_public ? "green" : "gray"}
                />
              </ConfigurationGrid>

              {/* Actions */}
              <Card.Root>
                <Card.Header>
                  <Heading size="md">Actions</Heading>
                </Card.Header>
                <Card.Body>
                  <VStack align="stretch" gap={3}>
                    <Button
                      variant="outline"
                      onClick={() => router.push(`/grows/${growId}/edit`)}
                    >
                      Edit Grow Configuration
                    </Button>
                  </VStack>
                </Card.Body>
              </Card.Root>
            </VStack>
          </Tabs.Content>
        </Tabs.Root>
      </VStack>
    </PageStateContainer>
  );
}
