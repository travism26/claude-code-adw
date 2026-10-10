import { useCallback, useRef, useState } from "react";
import type { Garden } from "../types";
import { useUpdatePlot, useDeletePlot } from "./useGardens";

export interface PlotGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface HistoryEntry {
  label: string;
  undo: () => Promise<void>;
  // redo is null for operations that cannot be safely replayed (e.g. create,
  // whose replay would mint a new plot id and invalidate later history entries).
  redo: (() => Promise<void>) | null;
}

interface UsePlotHistoryParams {
  garden: Garden;
}

/**
 * Undo/redo stack for plot geometry edits and creation.
 *
 * - move / resize: full undo + redo (plot id is stable, so we can replay the
 *   "before" and "after" geometry freely).
 * - create: undo only (undo deletes the created plot). Replaying a create would
 *   produce a new id, so it is not redoable and clears the redo stack.
 *
 * Deletions are handled separately by usePlotSoftDelete (a deferred-commit "Undo"
 * toast), which keeps the plot id stable during the grace window.
 */
export const usePlotHistory = ({ garden }: UsePlotHistoryParams) => {
  const updatePlotMutation = useUpdatePlot();
  const deletePlotMutation = useDeletePlot();

  const undoStack = useRef<HistoryEntry[]>([]);
  const redoStack = useRef<HistoryEntry[]>([]);
  // Bump to re-render consumers when canUndo/canRedo change.
  const [, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const recordGeometryChange = useCallback(
    (plotId: string, before: PlotGeometry, after: PlotGeometry) => {
      undoStack.current.push({
        label: "edit",
        undo: async () => {
          await updatePlotMutation.mutateAsync({ gardenId: garden.id, plotId, data: before });
        },
        redo: async () => {
          await updatePlotMutation.mutateAsync({ gardenId: garden.id, plotId, data: after });
        },
      });
      redoStack.current = [];
      bump();
    },
    [garden.id, updatePlotMutation, bump]
  );

  const recordCreate = useCallback(
    (plotId: string) => {
      undoStack.current.push({
        label: "create",
        undo: async () => {
          await deletePlotMutation.mutateAsync({ gardenId: garden.id, plotId });
        },
        redo: null,
      });
      redoStack.current = [];
      bump();
    },
    [garden.id, deletePlotMutation, bump]
  );

  const undo = useCallback(async () => {
    const entry = undoStack.current.pop();
    if (!entry) return;
    await entry.undo();
    if (entry.redo) {
      redoStack.current.push(entry);
    } else {
      // Non-redoable op (create): undoing it invalidates the redo timeline.
      redoStack.current = [];
    }
    bump();
  }, [bump]);

  const redo = useCallback(async () => {
    const entry = redoStack.current.pop();
    if (!entry || !entry.redo) return;
    await entry.redo();
    undoStack.current.push(entry);
    bump();
  }, [bump]);

  return {
    recordGeometryChange,
    recordCreate,
    undo,
    redo,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
  };
};
