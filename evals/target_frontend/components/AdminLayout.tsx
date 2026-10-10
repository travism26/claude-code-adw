"use client"

import type React from "react"
import { useNavigate } from "react-router-dom"
import { Shield, ArrowLeft } from "lucide-react"
import { Box, Flex, Heading, Button, Text, HStack, Icon as ChakraIcon } from "@chakra-ui/react"

interface AdminLayoutProps {
  children: React.ReactNode
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const navigate = useNavigate()

  return (
    <Flex minH="100vh" bg="gray.50" direction="column">
      {/* Admin Header */}
      <Box as="header" bg="purple.600" color="white" p={4} shadow="lg">
        <Flex align="center" justify="space-between" maxW="1400px" mx="auto">
          <Flex align="center" gap={3}>
            <Shield style={{ height: '28px', width: '28px' }} />
            <Box>
              <Heading as="h1" size="lg" fontWeight="bold">GrowBuddy Admin</Heading>
              <Text fontSize="xs" opacity={0.9}>Development & Testing Panel</Text>
            </Box>
          </Flex>
          <Button
            onClick={() => navigate('/dashboard')}
            colorScheme="whiteAlpha"
            size="sm"
            variant="outline"
          >
            <ArrowLeft style={{ height: '16px', width: '16px', marginRight: '8px' }} />
            Back to App
          </Button>
        </Flex>
      </Box>

      {/* Warning Banner */}
      <Box bg="yellow.100" borderBottom="1px" borderColor="yellow.300" px={4} py={2}>
        <Flex align="center" justify="center" maxW="1400px" mx="auto">
          <Text fontSize="sm" color="yellow.800" fontWeight="medium">
            Admin Panel - For Development Use Only
          </Text>
        </Flex>
      </Box>

      {/* Main Content */}
      <Box as="main" flex={1} p={6} maxW="1400px" w="full" mx="auto">
        {children}
      </Box>

      {/* Footer */}
      <Box as="footer" bg="gray.100" borderTop="1px" borderColor="gray.200" py={4}>
        <Flex justify="center" maxW="1400px" mx="auto">
          <Text fontSize="sm" color="gray.600">
            GrowBuddy Admin Panel v1.0
          </Text>
        </Flex>
      </Box>
    </Flex>
  )
}
