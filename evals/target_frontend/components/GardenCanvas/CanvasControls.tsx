import React from "react";
import { Flex, HStack, Button, Text, Icon as ChakraIcon } from "@chakra-ui/react";
import { Minus, Plus, Maximize2, Scan, Undo2, Redo2 } from "lucide-react";

interface CanvasControlsProps {
  zoom: number;
  showGrid: boolean;
  snapEnabled: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFitToView: () => void;
  onToggleGrid: () => void;
  onToggleSnap: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

export const CanvasControls: React.FC<CanvasControlsProps> = ({
  zoom,
  showGrid,
  snapEnabled,
  canUndo,
  canRedo,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitToView,
  onToggleGrid,
  onToggleSnap,
  onUndo,
  onRedo,
}) => {
  return (
    <Flex gap={2} mb={4} justify="space-between" align="center" wrap="wrap">
      <HStack gap={1} wrap="wrap">
        <Button size="sm" onClick={onZoomOut} aria-label="Zoom out" title="Zoom out">
          <ChakraIcon as={Minus} boxSize={4} />
        </Button>
        <Text fontSize="sm" fontWeight="medium" minW="3.5em" textAlign="center">
          {Math.round(zoom * 100)}%
        </Text>
        <Button size="sm" onClick={onZoomIn} aria-label="Zoom in" title="Zoom in">
          <ChakraIcon as={Plus} boxSize={4} />
        </Button>
        <Button size="sm" variant="outline" onClick={onResetZoom} title="Reset to 100%">
          <ChakraIcon as={Maximize2} boxSize={4} mr={{ base: 0, sm: 2 }} />
          <Text display={{ base: "none", sm: "inline" }}>Reset</Text>
        </Button>
        <Button size="sm" variant="outline" onClick={onFitToView} title="Fit garden to view">
          <ChakraIcon as={Scan} boxSize={4} mr={{ base: 0, sm: 2 }} />
          <Text display={{ base: "none", sm: "inline" }}>Fit</Text>
        </Button>
      </HStack>

      <HStack gap={1} wrap="wrap">
        <Button
          size="sm"
          variant="outline"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo"
          title="Undo (Cmd/Ctrl+Z)"
        >
          <ChakraIcon as={Undo2} boxSize={4} />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onRedo}
          disabled={!canRedo}
          aria-label="Redo"
          title="Redo (Cmd/Ctrl+Shift+Z)"
        >
          <ChakraIcon as={Redo2} boxSize={4} />
        </Button>
        <Button size="sm" variant={showGrid ? "solid" : "outline"} onClick={onToggleGrid}>
          Grid {showGrid ? "On" : "Off"}
        </Button>
        <Button size="sm" variant={snapEnabled ? "solid" : "outline"} onClick={onToggleSnap}>
          Snap {snapEnabled ? "On" : "Off"}
        </Button>
      </HStack>
    </Flex>
  );
};
