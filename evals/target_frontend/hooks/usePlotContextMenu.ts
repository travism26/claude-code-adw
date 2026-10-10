import { useState, useCallback, useEffect } from "react";
import type { Plot } from "../types";

interface ContextMenuState {
  visible: boolean;
  plot?: Plot;
  x: number;
  y: number;
}

export const usePlotContextMenu = () => {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
  });

  const openContextMenuAt = useCallback((plot: Plot, x: number, y: number) => {
    setContextMenu({ visible: true, plot, x, y });
  }, []);

  const handlePlotRightClick = useCallback(
    (plot: Plot, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      openContextMenuAt(plot, e.clientX, e.clientY);
    },
    [openContextMenuAt]
  );

  const handleContextMenuClose = useCallback(() => {
    setContextMenu({ visible: false, x: 0, y: 0 });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && contextMenu.visible) {
        handleContextMenuClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [contextMenu.visible, handleContextMenuClose]);

  return {
    contextMenu,
    handlePlotRightClick,
    openContextMenuAt,
    handleContextMenuClose,
  };
};
