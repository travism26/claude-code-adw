"use client";

import type React from "react";
import NextLink from "next/link";
import { HStack, Button } from "@chakra-ui/react";
import type { LucideIcon } from "lucide-react";

interface NavigationItem {
  /** URL to navigate to */
  href: string;
  /** Button label text */
  label: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Button variant */
  variant?: "solid" | "outline" | "ghost";
  /** Whether this is the current/active item */
  isActive?: boolean;
  /** Data test id for testing */
  testId?: string;
}

interface PageNavigationProps {
  /** Array of navigation items to display */
  items: NavigationItem[];
  /** Color palette for buttons */
  colorPalette?: string;
}

/**
 * PageNavigation Component
 *
 * Renders a horizontal navigation bar with button links.
 * Used for page-level navigation between related pages.
 */
export const PageNavigation: React.FC<PageNavigationProps> = ({
  items,
  colorPalette = "green",
}) => {
  return (
    <HStack gap={3} flexWrap="wrap">
      {items.map((item) => {
        const Icon = item.icon;
        const variant = item.isActive ? "solid" : (item.variant ?? "outline");

        return (
          <Button
            key={item.href}
            asChild
            size="sm"
            variant={variant}
            colorPalette={colorPalette}
            data-testid={item.testId}
          >
            <NextLink href={item.href}>
              <Icon size={16} />
              {item.label}
            </NextLink>
          </Button>
        );
      })}
    </HStack>
  );
};

export default PageNavigation;
