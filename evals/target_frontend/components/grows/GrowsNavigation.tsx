/**
 * GrowsNavigation Component
 *
 * Reusable navigation for the grows section
 */

import React from "react";
import NextLink from "next/link";
import { HStack, Button } from "@chakra-ui/react";
import { List, Plus, Calendar, LayoutGrid, Droplet } from "lucide-react";

export function GrowsNavigation() {
  return (
    <HStack gap={3} flexWrap="wrap">
      <Button
        asChild
        size="sm"
        variant="solid"
        colorPalette="green"
      >
        <NextLink href="/grows">
          <List size={16} />
          All Grows
        </NextLink>
      </Button>
      <Button
        asChild
        size="sm"
        variant="outline"
        colorPalette="green"
      >
        <NextLink href="/grows/new">
          <Plus size={16} />
          New Grow
        </NextLink>
      </Button>
      <Button
        asChild
        size="sm"
        variant="outline"
        colorPalette="green"
        data-testid="feeding-today-nav"
      >
        <NextLink href="/grows/feeding-today">
          <Droplet size={16} />
          Today&apos;s Feeding
        </NextLink>
      </Button>
      <Button
        asChild
        size="sm"
        variant="outline"
        colorPalette="blue"
      >
        <NextLink href="/schedule">
          <Calendar size={16} />
          Schedule
        </NextLink>
      </Button>
      <Button
        asChild
        size="sm"
        variant="outline"
        colorPalette="purple"
      >
        <NextLink href="/environments">
          <LayoutGrid size={16} />
          Environments
        </NextLink>
      </Button>
    </HStack>
  );
}
