"use client"

import { useNavigate } from "react-router-dom"
import { LogOut, Shield } from "lucide-react"
import { useAuth } from "../hooks/useAuth"
import { ZoneSelector } from "../components/ZoneSelector"
import { VStack, Card, Heading, Text, Button, Box } from "@chakra-ui/react"

export function ProfilePage() {
  const navigate = useNavigate()
  const { logout, user } = useAuth()

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  return (
    <VStack gap={6} align="stretch">
      <Card.Root>
        <Card.Body p={6}>
          <Heading size="lg" mb={4}>Profile Settings</Heading>
          {user && (
            <VStack gap={1} align="flex-start" mb={6}>
              <Text fontSize="sm" color="gray.500">Email</Text>
              <Text color="gray.900">{user.email}</Text>
            </VStack>
          )}
        </Card.Body>
      </Card.Root>

      <ZoneSelector />

      <Card.Root>
        <Card.Body p={6}>
          <Button
            data-testid="logout-button"
            onClick={handleLogout}
            width="100%"
            colorScheme="red"
            size="lg"
          >
            <LogOut />
            Logout
          </Button>
        </Card.Body>
      </Card.Root>

      {/* Admin Panel Link - Only visible in development */}
      {(import.meta as any).env?.MODE === 'development' && (
        <Card.Root borderColor="purple.200" borderWidth={2}>
          <Card.Body p={6}>
            <VStack gap={3} align="stretch">
              <Box>
                <Heading size="sm" mb={1}>Developer Tools</Heading>
                <Text fontSize="xs" color="gray.600">
                  Admin panel for testing and development
                </Text>
              </Box>
              <Button
                onClick={() => navigate('/admin')}
                colorScheme="purple"
                variant="outline"
                size="md"
              >
                <Shield style={{ height: '16px', width: '16px', marginRight: '8px' }} />
                Open Admin Panel
              </Button>
            </VStack>
          </Card.Body>
        </Card.Root>
      )}
    </VStack>
  )
}
