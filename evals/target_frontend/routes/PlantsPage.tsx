"use client"

import { useNavigate } from "react-router-dom"
import { PlantsList } from "../components/PlantsList"
import type { Plant } from "../types"

export function PlantsPage() {
  const navigate = useNavigate()

  const handleAddPlant = () => {
    navigate("/add-plant")
  }

  const handleEditPlant = (plant: Plant) => {
    navigate("/add-plant", { state: { plant } })
  }

  const handleViewPlant = (plant: Plant) => {
    navigate("/journal", { state: { plant } })
  }

  return (
    <PlantsList
      onAddPlant={handleAddPlant}
      onEditPlant={handleEditPlant}
      onViewPlant={handleViewPlant}
    />
  )
}
