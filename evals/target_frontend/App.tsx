"use client"

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { useAuth } from "./hooks/useAuth"
import { Layout } from "./components/Layout"
import { ProtectedRoute } from "./components/ProtectedRoute"
import { LoginPage } from "./routes/LoginPage"
import { SignupPage } from "./routes/SignupPage"
import { DashboardPage } from "./routes/DashboardPage"
import { PlantsPage } from "./routes/PlantsPage"
import { AddPlantPage } from "./routes/AddPlantPage"
import { JournalPage } from "./routes/JournalPage"
import { ProfilePage } from "./routes/ProfilePage"
import { PlantDatabasePage } from "./routes/PlantDatabasePage"
import { GardenPlannerPage } from "./routes/GardenPlannerPage"
import { AdminPage } from "./routes/AdminPage"
import { SchedulePage } from "./routes/SchedulePage"
import { Box, Flex, Spinner, Text } from "@chakra-ui/react"

function AppRoutes() {
  const { isAuthenticated, isInitializing } = useAuth()

  // Show loading while initializing authentication
  if (isInitializing) {
    return (
      <Flex minH="100vh" bg="green.50" align="center" justify="center">
        <Box textAlign="center">
          <Spinner
            size="xl"
            color="green.600"
            mb={4}
          />
          <Text color="gray.600">Loading...</Text>
        </Box>
      </Flex>
    )
  }

  return (
    <Routes>
      {/* Login route */}
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <LoginPage />
          )
        }
      />

      {/* Signup route */}
      <Route
        path="/signup"
        element={
          isAuthenticated ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <SignupPage />
          )
        }
      />

      {/* Root redirect */}
      <Route
        path="/"
        element={
          <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
        }
      />

      {/* Protected routes wrapped in Layout */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <DashboardPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/plants"
        element={
          <ProtectedRoute>
            <Layout>
              <PlantsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/add-plant"
        element={
          <ProtectedRoute>
            <Layout>
              <AddPlantPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/journal"
        element={
          <ProtectedRoute>
            <Layout>
              <JournalPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Layout>
              <ProfilePage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/plant-database"
        element={
          <ProtectedRoute>
            <Layout>
              <PlantDatabasePage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/garden-planner"
        element={
          <ProtectedRoute>
            <Layout>
              <GardenPlannerPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/garden-planner/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <GardenPlannerPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/schedule"
        element={
          <ProtectedRoute>
            <Layout>
              <SchedulePage />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Admin Panel - No authentication required for development */}
      <Route path="/admin" element={<AdminPage />} />

      {/* Catch all - redirect to root */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App
