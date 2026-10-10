import React, { useCallback } from "react";
import type { Plot, CompassDirection } from "../../types";
import type { ResizeHandle } from "../../utils/plotResize";

// Visible handle dot stays small; the transparent hit target around it is large
// enough to satisfy the ~44px minimum touch-target guideline.
const HANDLE_VISUAL_RADIUS = 6;
const HANDLE_HIT_RADIUS = 18;

interface PlotRendererProps {
  plot: Plot;
  x: number;
  y: number;
  width: number;
  height: number;
  isSelected: boolean;
  isHighlighted: boolean;
  isInvalid: boolean;
  isDragging: boolean;
  isResizing: boolean;
  hoverHandle: ResizeHandle;
  cursorStyle: string;
  convertFeetToPixels: (feet: number) => number;
  zoom: number;
  onMouseDown: (plot: Plot, e: React.PointerEvent) => void;
  onRightClick: (plot: Plot, e: React.MouseEvent) => void;
  onResizeHandleMouseDown: (plot: Plot, handle: ResizeHandle, e: React.PointerEvent) => void;
  getSafeIconUrl: (iconUrl: string | null | undefined) => string;
}

export const PlotRenderer: React.FC<PlotRendererProps> = ({
  plot,
  x,
  y,
  width,
  height,
  isSelected,
  isHighlighted,
  isInvalid,
  isDragging,
  isResizing,
  hoverHandle,
  cursorStyle,
  convertFeetToPixels,
  zoom,
  onMouseDown,
  onRightClick,
  onResizeHandleMouseDown,
  getSafeIconUrl,
}) => {
  const fillColor = isInvalid ? "#ef4444" : isHighlighted ? "#805ad5" : "#48bb78";
  const strokeColor = isInvalid
    ? "#dc2626"
    : isHighlighted
    ? "#553c9a"
    : isSelected
    ? "#2f855a"
    : "#38a169";

  const plantName =
    plot.plantProfile?.common_name ||
    plot.plantProfile?.name ||
    (plot.plant_profile_id ? "Plant" : "Empty");
  const iconUrl = plot.plantProfile?.icon_url;
  const compassDir = plot.compass_direction;

  const iconSize = Math.min(24 * zoom, 48);
  const isSmallPlot = width < 2 || height < 1.5;
  const isLargePlot = width > 4;

  const showIcon = !!plot.plant_profile_id;
  const showText = !isSmallPlot;
  const displayName = plantName;
  // Compress a long label to fit the plot width (lengthAdjust) instead of hard
  // truncating to "Gar…". A hover <title> still shows the full name.
  const availableTextPx = Math.max(0, convertFeetToPixels(width) - 8 * zoom);
  const approxNaturalPx = plantName.length * 12 * zoom * 0.6;
  const needsCompress = showText && availableTextPx > 0 && approxNaturalPx > availableTextPx;

  const compassArrows: Record<CompassDirection, string> = {
    N: "↑",
    NE: "↗",
    E: "→",
    SE: "↘",
    S: "↓",
    SW: "↙",
    W: "←",
    NW: "↖",
  };

  const showCompass = compassDir && isLargePlot;
  const compassSymbol = compassDir ? compassArrows[compassDir] : "";

  let plotCursor = "grab";
  if (isDragging) plotCursor = "grabbing";
  else if (isResizing) plotCursor = cursorStyle;
  else if (isSelected && hoverHandle !== "none") plotCursor = cursorStyle;

  const handleImageError = useCallback((e: React.SyntheticEvent<SVGImageElement>) => {
    const target = e.target as SVGImageElement;
    if (target.href.baseVal !== "/plant-icons/default/generic-plant.svg") {
      target.href.baseVal = "/plant-icons/default/generic-plant.svg";
    }
  }, []);

  return (
    <g>
      <rect
        x={convertFeetToPixels(x)}
        y={convertFeetToPixels(y)}
        width={convertFeetToPixels(width)}
        height={convertFeetToPixels(height)}
        fill={fillColor}
        fillOpacity={isDragging || isResizing ? "0.8" : "0.6"}
        stroke={strokeColor}
        strokeWidth={isHighlighted ? "4" : isSelected ? "3" : "2"}
        strokeDasharray={isHighlighted ? "8,4" : "none"}
        cursor={plotCursor}
        onPointerDown={(e) => onMouseDown(plot, e)}
        onContextMenu={(e) => onRightClick(plot, e)}
        data-testid={`plot-${plot.id}`}
        data-highlighted={isHighlighted ? "true" : undefined}
        style={{
          touchAction: "none",
          ...(isHighlighted ? { animation: "pulse 2s ease-in-out infinite" } : {}),
        }}
      />

      {showIcon && (
        <image
          href={getSafeIconUrl(iconUrl)}
          x={convertFeetToPixels(x + width / 2) - iconSize / 2}
          y={convertFeetToPixels(y + height / 2) - iconSize / 2 - (showText ? 8 * zoom : 0)}
          width={iconSize}
          height={iconSize}
          pointerEvents="none"
          data-testid="plot-icon"
          onError={handleImageError}
        />
      )}

      {showText && (
        <text
          x={convertFeetToPixels(x + width / 2)}
          y={convertFeetToPixels(y + height / 2) + (showIcon ? iconSize / 2 + 4 * zoom : 0)}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize={12 * zoom}
          fontWeight="bold"
          pointerEvents="none"
          data-testid="plot-label"
          textLength={needsCompress ? availableTextPx : undefined}
          lengthAdjust={needsCompress ? "spacingAndGlyphs" : undefined}
        >
          <title>{plantName}</title>
          {displayName}
        </text>
      )}

      {showCompass && (
        <text
          x={convertFeetToPixels(x + width / 2)}
          y={convertFeetToPixels(y + height / 2) + (showIcon ? iconSize / 2 : 0) + 18 * zoom}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize={10 * zoom}
          pointerEvents="none"
          data-testid="plot-compass"
        >
          {compassSymbol}
        </text>
      )}

      {isSelected && !isDragging && !isResizing && (
        <>
          {(
            [
              { handle: "top-left", cx: x, cy: y, cursor: "nw-resize" },
              { handle: "top-right", cx: x + width, cy: y, cursor: "ne-resize" },
              { handle: "bottom-left", cx: x, cy: y + height, cursor: "sw-resize" },
              { handle: "bottom-right", cx: x + width, cy: y + height, cursor: "se-resize" },
              { handle: "top", cx: x + width / 2, cy: y, cursor: "n-resize" },
              { handle: "right", cx: x + width, cy: y + height / 2, cursor: "e-resize" },
              { handle: "bottom", cx: x + width / 2, cy: y + height, cursor: "s-resize" },
              { handle: "left", cx: x, cy: y + height / 2, cursor: "w-resize" },
            ] as const
          ).map(({ handle, cx, cy, cursor }) => {
            const px = convertFeetToPixels(cx);
            const py = convertFeetToPixels(cy);
            return (
              <g key={handle}>
                {/* Invisible ~44px touch/click target around each handle. */}
                <circle
                  cx={px}
                  cy={py}
                  r={HANDLE_HIT_RADIUS}
                  fill="transparent"
                  stroke="transparent"
                  cursor={cursor}
                  pointerEvents="all"
                  style={{ touchAction: "none" }}
                  data-testid={`resize-handle-${handle}`}
                  onPointerDown={(e) => onResizeHandleMouseDown(plot, handle, e)}
                />
                {/* Visible handle dot. */}
                <circle
                  cx={px}
                  cy={py}
                  r={HANDLE_VISUAL_RADIUS}
                  fill="white"
                  stroke="#2f855a"
                  strokeWidth="2"
                  cursor={cursor}
                  pointerEvents="none"
                />
              </g>
            );
          })}
        </>
      )}
    </g>
  );
};
