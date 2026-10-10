"use client"

import { useNavigate, useLocation } from "react-router-dom"
import { AddPlantForm } from "../components/AddPlantForm"

export function AddPlantPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const handleBack = () => {
    navigate("/plants")
  }

  const handleSuccess = () => {
    navigate("/plants")
  }

  return (
    <AddPlantForm onBack={handleBack} onSuccess={handleSuccess} />
  )
}
