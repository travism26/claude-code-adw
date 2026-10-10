import { useCallback, useEffect, useRef, useState } from "react";
import type { Garden, Plot } from "../types";
import { useDeletePlot } from "./useGardens";
import { deletePlot as deletePlotApi } from "../api/gardenApi";
import { toaster } from "../components/ChakraProvider";

const GRACE_MS = 6000;

interface UsePlotSoftDeleteParams {
  garden: Garden;
  onPlotSelect?: (plot: Plot | null) => void;
}

/**
 * Deferred ("soft") plot deletion with an Undo grace window.
 *
 * Instead of immediately and irreversibly deleting on the backend, the plot is
 * hidden locally and a 6s "Undo" toast is shown. The backend delete only fires
 * when the grace window expires. Clicking Undo cancels it entirely — the same
 * plot (same id) simply reappears.
 *
 * Consumers must hide plots whose id is in `pendingDeleteIds` while pending.
 */
export const usePlotSoftDelete = ({ garden, onPlotSelect }: UsePlotSoftDeleteParams) => {
  const deletePlotMutation = useDeletePlot();
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const pendingIdsRef = useRef<string[]>([]);
  pendingIdsRef.current = pendingIds;
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const clearTimer = useCallback((plotId: string) => {
    const t = timers.current.get(plotId);
    if (t) clearTimeout(t);
    timers.current.delete(plotId);
  }, []);

  const commit = useCallback(
    (plotId: string) => {
      clearTimer(plotId);
      deletePlotMutation.mutate(
        { gardenId: garden.id, plotId },
        {
          onError: (error) => {
            // Delete failed — un-hide the plot and surface the error.
            setPendingIds((ids) => ids.filter((id) => id !== plotId));
            toaster.create({
              title: "Error removing plot",
              description: error instanceof Error ? error.message : "An error occurred",
              type: "error",
              duration: 5000,
            });
          },
        }
      );
      setPendingIds((ids) => ids.filter((id) => id !== plotId));
    },
    [garden.id, deletePlotMutation, clearTimer]
  );

  const undoDelete = useCallback(
    (plotId: string) => {
      clearTimer(plotId);
      setPendingIds((ids) => ids.filter((id) => id !== plotId));
    },
    [clearTimer]
  );

  const softDelete = useCallback(
    (plot: Plot) => {
      const name = plot.plantProfile?.common_name || plot.plantProfile?.name || "Plot";
      setPendingIds((ids) => (ids.includes(plot.id) ? ids : [...ids, plot.id]));
      onPlotSelect?.(null);

      const timer = setTimeout(() => commit(plot.id), GRACE_MS);
      timers.current.set(plot.id, timer);

      toaster.create({
        title: "Plot removed",
        description: `${name} removed from garden`,
        type: "info",
        duration: GRACE_MS,
        action: { label: "Undo", onClick: () => undoDelete(plot.id) },
      });
    },
    [commit, undoDelete, onPlotSelect]
  );

  // On unmount, flush any still-pending deletes to the backend (best effort) so
  // a hidden plot is not left in a half-deleted limbo.
  useEffect(() => {
    const timersMap = timers.current;
    return () => {
      timersMap.forEach((t) => clearTimeout(t));
      timersMap.clear();
      pendingIdsRef.current.forEach((plotId) => {
        deletePlotApi(garden.id, plotId).catch(() => {});
      });
    };
  }, [garden.id]);

  return {
    softDelete,
    pendingDeleteIds: pendingIds,
    isPendingDelete: useCallback((id: string) => pendingIds.includes(id), [pendingIds]),
  };
};
