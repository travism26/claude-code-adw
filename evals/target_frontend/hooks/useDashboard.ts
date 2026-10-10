'use client';

import { useState, useCallback, useMemo } from 'react';
import type { Plant, DashboardTask } from '../types';
import { usePlants } from './usePlants';

interface UseDashboardReturn {
  todaysTasks: DashboardTask[];
  upcomingTasks: DashboardTask[];
  overdueTasks: DashboardTask[];
  isLoading: boolean;
  error: string | null;
  refreshTasks: () => Promise<void>;
}

export const useDashboard = (): UseDashboardReturn => {
  const { plants, isLoading, error, fetchPlants } = usePlants();
  const [lastWateringDates] = useState<Record<string, string>>({});
  const [lastFertilizingDates] = useState<Record<string, string>>({});

  const calculateTasks = useCallback(
    (plants: Plant[] | undefined): DashboardTask[] => {
      // Handle undefined or empty plants array
      if (!plants || plants.length === 0) {
        return [];
      }

      const tasks: DashboardTask[] = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      plants.forEach((plant) => {
        // Calculate watering tasks
        const lastWatered = lastWateringDates[plant.id]
          ? new Date(lastWateringDates[plant.id])
          : new Date(plant.createdAt);

        const nextWateringDate = new Date(lastWatered);
        nextWateringDate.setDate(
          nextWateringDate.getDate() + plant.water_interval_days
        );
        nextWateringDate.setHours(0, 0, 0, 0);

        tasks.push({
          id: `water-${plant.id}`,
          plantId: plant.id,
          plantName: plant.name,
          taskType: 'water',
          dueDate: nextWateringDate.toISOString(),
          overdue: nextWateringDate < today,
        });

        // Calculate fertilizing tasks
        if (plant.fert_interval_days) {
          const lastFertilized = lastFertilizingDates[plant.id]
            ? new Date(lastFertilizingDates[plant.id])
            : new Date(plant.createdAt);

          const nextFertilizingDate = new Date(lastFertilized);
          nextFertilizingDate.setDate(
            nextFertilizingDate.getDate() + plant.fert_interval_days
          );
          nextFertilizingDate.setHours(0, 0, 0, 0);

          tasks.push({
            id: `fertilize-${plant.id}`,
            plantId: plant.id,
            plantName: plant.name,
            taskType: 'fertilize',
            dueDate: nextFertilizingDate.toISOString(),
            overdue: nextFertilizingDate < today,
          });
        }
      });

      return tasks.sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      );
    },
    [lastWateringDates, lastFertilizingDates]
  );

  const allTasks = useMemo(
    () => calculateTasks(plants),
    [plants, calculateTasks]
  );

  const todaysTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return allTasks.filter((task) => {
      const taskDate = new Date(task.dueDate);
      return taskDate >= today && taskDate < tomorrow;
    });
  }, [allTasks]);

  const upcomingTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    return allTasks.filter((task) => {
      const taskDate = new Date(task.dueDate);
      return taskDate > today && taskDate <= nextWeek && !task.overdue;
    });
  }, [allTasks]);

  const overdueTasks = useMemo(() => {
    return allTasks.filter((task) => task.overdue);
  }, [allTasks]);

  const refreshTasks = useCallback(async () => {
    await fetchPlants();
  }, [fetchPlants]);

  return {
    todaysTasks,
    upcomingTasks,
    overdueTasks,
    isLoading,
    error: error ? String(error) : null,
    refreshTasks,
  };
};
