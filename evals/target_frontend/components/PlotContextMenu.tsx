"use client";

import React from "react";
import { Box, VStack, Text } from "@chakra-ui/react";
import type { Plot, Garden } from "../types";
import { calculateMaxExpansion } from "../utils/plotResize";

export interface PlotContextMenuProps {
  plot: Plot;
  position: { x: number; y: number };
  onClose: () => void;
  garden: Garden;
  onEdit: (plot: Plot) => void;
  onDelete: (plot: Plot) => void;
  onViewDetails: (plot: Plot) => void;
  onExpand: (plot: Plot, direction: "up" | "down" | "left" | "right") => void;
}

export const PlotContextMenu: React.FC<PlotContextMenuProps> = ({
  plot,
  position,
  onClose,
  garden,
  onEdit,
  onDelete,
  onViewDetails,
  onExpand,
}) => {
  const allPlots = garden.plots || [];
  const gardenDimensions = { width: garden.width, height: garden.height };

  // Calculate available expansion for each direction
  const canExpandUp = calculateMaxExpansion(plot, "up", gardenDimensions, allPlots) > 0;
  const canExpandDown = calculateMaxExpansion(plot, "down", gardenDimensions, allPlots) > 0;
  const canExpandLeft = calculateMaxExpansion(plot, "left", gardenDimensions, allPlots) > 0;
  const canExpandRight = calculateMaxExpansion(plot, "right", gardenDimensions, allPlots) > 0;

  const menuItems = [
    {
      label: "Edit Plot",
      onClick: () => {
        onEdit(plot);
        onClose();
      },
      disabled: false,
      testId: "context-menu-edit",
    },
    {
      label: "Delete Plot",
      onClick: () => {
        onDelete(plot);
        onClose();
      },
      disabled: false,
      testId: "context-menu-delete",
    },
    {
      label: "View Details",
      onClick: () => {
        onViewDetails(plot);
        onClose();
      },
      disabled: false,
      testId: "context-menu-view-details",
    },
    { separator: true },
    {
      label: "Expand Up ↑",
      onClick: () => {
        onExpand(plot, "up");
        onClose();
      },
      disabled: !canExpandUp,
      testId: "context-menu-expand-up",
    },
    {
      label: "Expand Down ↓",
      onClick: () => {
        onExpand(plot, "down");
        onClose();
      },
      disabled: !canExpandDown,
      testId: "context-menu-expand-down",
    },
    {
      label: "Expand Left ←",
      onClick: () => {
        onExpand(plot, "left");
        onClose();
      },
      disabled: !canExpandLeft,
      testId: "context-menu-expand-left",
    },
    {
      label: "Expand Right →",
      onClick: () => {
        onExpand(plot, "right");
        onClose();
      },
      disabled: !canExpandRight,
      testId: "context-menu-expand-right",
    },
  ];

  // Adjust position to keep menu visible within viewport
  const adjustedPosition = { ...position };
  const menuWidth = 200;
  const menuHeight = 250;

  if (position.x + menuWidth > window.innerWidth) {
    adjustedPosition.x = window.innerWidth - menuWidth - 10;
  }
  if (position.y + menuHeight > window.innerHeight) {
    adjustedPosition.y = window.innerHeight - menuHeight - 10;
  }

  return (
    <>
      {/* Overlay to capture clicks outside menu */}
      <Box
        position="fixed"
        top={0}
        left={0}
        right={0}
        bottom={0}
        onClick={onClose}
        zIndex={999}
        data-testid="context-menu-overlay"
      />

      {/* Context Menu */}
      <Box
        position="fixed"
        top={`${adjustedPosition.y}px`}
        left={`${adjustedPosition.x}px`}
        bg="white"
        borderWidth="1px"
        borderColor="gray.300"
        borderRadius="md"
        boxShadow="lg"
        minW="180px"
        zIndex={1000}
        data-testid="plot-context-menu"
      >
        <VStack align="stretch" gap={0}>
          {menuItems.map((item, index) =>
            item.separator ? (
              <Box
                key={`separator-${index}`}
                h="1px"
                bg="gray.200"
                my={1}
              />
            ) : (
              <Box
                key={item.testId}
                px={4}
                py={2}
                cursor={item.disabled ? "not-allowed" : "pointer"}
                opacity={item.disabled ? 0.5 : 1}
                _hover={
                  !item.disabled
                    ? {
                        bg: "gray.100",
                      }
                    : {}
                }
                onClick={item.disabled ? undefined : item.onClick}
                data-testid={item.testId}
              >
                <Text fontSize="sm" fontWeight="medium" color={item.disabled ? "gray.400" : "gray.700"}>
                  {item.label}
                </Text>
              </Box>
            )
          )}
        </VStack>
      </Box>
    </>
  );
};
