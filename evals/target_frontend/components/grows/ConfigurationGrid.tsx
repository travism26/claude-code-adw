"use client";

import type React from "react";
import { Box, Card, Grid, Heading, Text } from "@chakra-ui/react";

interface ConfigurationGridProps {
  /** Section title */
  title: string;
  /** Optional additional content after the grid */
  footer?: React.ReactNode;
  /** Grid children (ConfigFieldDisplay components) */
  children: React.ReactNode;
  /** Number of columns on different breakpoints */
  columns?: {
    base?: number;
    md?: number;
    lg?: number;
  };
}

/**
 * ConfigurationGrid Component
 *
 * Wraps configuration fields in a card with header and responsive grid layout.
 * Used for settings sections on detail and edit pages.
 */
export const ConfigurationGrid: React.FC<ConfigurationGridProps> = ({
  title,
  footer,
  children,
  columns = { base: 1, md: 2 },
}) => {
  const templateColumns = {
    base: `repeat(${columns.base ?? 1}, 1fr)`,
    md: `repeat(${columns.md ?? 2}, 1fr)`,
    lg: columns.lg ? `repeat(${columns.lg}, 1fr)` : undefined,
  };

  return (
    <Card.Root>
      <Card.Header>
        <Heading size="md">{title}</Heading>
      </Card.Header>
      <Card.Body>
        <Grid templateColumns={templateColumns} gap={4}>
          {children}
        </Grid>
        {footer && <Box mt={4}>{footer}</Box>}
      </Card.Body>
    </Card.Root>
  );
};

export default ConfigurationGrid;
