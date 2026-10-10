// Dashboard logic using TanStack Query and plantApi
import type { DashboardTask, Plant } from "../types";
import { fetchPlants } from "./plantApi";

// Example: Calculate dashboard tasks from plants
export const calculateTasks = (plants: Plant[]): DashboardTask[] => {
  const tasks: DashboardTask[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  plants.forEach((plant) => {
    // Watering task
    const lastWatered = new Date(plant.createdAt);
    const nextWateringDate = new Date(lastWatered);
    nextWateringDate.setDate(
      nextWateringDate.getDate() + plant.water_interval_days
    );
    nextWateringDate.setHours(0, 0, 0, 0);
    tasks.push({
      id: `water-${plant.id}`,
      plantId: plant.id,
      plantName: plant.name,
      taskType: "water",
      dueDate: nextWateringDate.toISOString(),
      overdue: nextWateringDate < today,
    });
    // Fertilizing task
    if (plant.fert_interval_days) {
      const lastFertilized = new Date(plant.createdAt);
      const nextFertilizingDate = new Date(lastFertilized);
      nextFertilizingDate.setDate(
        nextFertilizingDate.getDate() + plant.fert_interval_days
      );
      nextFertilizingDate.setHours(0, 0, 0, 0);
      tasks.push({
        id: `fertilize-${plant.id}`,
        plantId: plant.id,
        plantName: plant.name,
        taskType: "fertilize",
        dueDate: nextFertilizingDate.toISOString(),
        overdue: nextFertilizingDate < today,
      });
    }
  });
  return tasks.sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );
};
