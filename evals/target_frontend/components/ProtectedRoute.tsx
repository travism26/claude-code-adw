"use client"

import { ReactNode } from "react"
import { Navigate } from "react-router-dom"
import { Flex, VStack, Spinner, Text } from "@chakra-ui/react"
import { useAuth } from "../hooks/useAuth"

interface ProtectedRouteProps {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isInitializing } = useAuth()

  // Show loading while initializing authentication
  if (isInitializing) {
    return (
      <Flex minH="100vh" bg="green.50" align="center" justify="center">
        <VStack gap={4}>
          <Spinner size="xl" color="green.600" borderWidth="3px" />
          <Text color="gray.600">Loading...</Text>
        </VStack>
      </Flex>
    )
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
