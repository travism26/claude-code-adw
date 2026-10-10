import React from "react";

interface CanvasGridProps {
  width: number;
  height: number;
  gridSize: number;
  pixelsPerFoot: number;
  zoom: number;
  showGrid: boolean;
}

export const CanvasGrid: React.FC<CanvasGridProps> = ({
  width,
  height,
  gridSize,
  pixelsPerFoot,
  zoom,
  showGrid,
}) => {
  if (!showGrid) return null;

  const canvasWidth = width * pixelsPerFoot * zoom;
  const canvasHeight = height * pixelsPerFoot * zoom;

  return (
    <>
      {/* Vertical grid lines */}
      {Array.from({ length: Math.ceil(width / gridSize) + 1 }, (_, i) => (
        <line
          key={`v-${i}`}
          x1={i * gridSize * pixelsPerFoot * zoom}
          y1={0}
          x2={i * gridSize * pixelsPerFoot * zoom}
          y2={canvasHeight}
          stroke="#d4d1c4"
          strokeWidth="1"
          pointerEvents="none"
        />
      ))}
      {/* Horizontal grid lines */}
      {Array.from({ length: Math.ceil(height / gridSize) + 1 }, (_, i) => (
        <line
          key={`h-${i}`}
          x1={0}
          y1={i * gridSize * pixelsPerFoot * zoom}
          x2={canvasWidth}
          y2={i * gridSize * pixelsPerFoot * zoom}
          stroke="#d4d1c4"
          strokeWidth="1"
          pointerEvents="none"
        />
      ))}
    </>
  );
};
