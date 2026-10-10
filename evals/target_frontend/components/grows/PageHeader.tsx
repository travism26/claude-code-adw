"use client";

import type React from "react";
import { Box, Heading, Text, HStack } from "@chakra-ui/react";
import type { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  /** Page title */
  title: string;
  /** Optional description text */
  description?: string;
  /** Optional Lucide icon component */
  icon?: LucideIcon;
  /** Icon size */
  iconSize?: number;
  /** Heading size */
  headingSize?: "xl" | "2xl" | "3xl";
}

/**
 * PageHeader Component
 *
 * Renders a page header with optional icon, title, and description.
 * Provides consistent styling for page titles across the application.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  icon: Icon,
  iconSize = 24,
  headingSize = "2xl",
}) => {
  return (
    <Box>
      {Icon ? (
        <HStack gap={2} mb={2}>
          <Icon size={iconSize} />
          <Heading size={headingSize}>{title}</Heading>
        </HStack>
      ) : (
        <Heading size={headingSize} mb={2}>
          {title}
        </Heading>
      )}
      {description && <Text color="gray.600">{description}</Text>}
    </Box>
  );
};

export default PageHeader;
