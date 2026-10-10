"use client"

import type React from "react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Leaf, Eye, EyeOff } from "lucide-react"
import { useAuth } from "../hooks/useAuth"
import {
  Box,
  Container,
  VStack,
  Heading,
  Text,
  Input,
  Button,
  Flex,
  IconButton,
  Field,
  Alert
} from "@chakra-ui/react"
import { Link } from "../components/Link"

export function LoginPage() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })

  const { login, isLoading, error, clearError } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()

    try {
      await login(formData.email, formData.password)
      navigate("/dashboard")
    } catch (error) {
      // Error is handled by the hook
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  return (
    <Box minH="100vh" bg="green.50" display="flex" alignItems="center" justifyContent="center" p={4}>
      <Container maxW="md">
        <Box bg="white" borderRadius="lg" boxShadow="lg" p={8}>
          <VStack gap={8} align="stretch">
            <VStack gap={4} textAlign="center">
              <Flex align="center" justify="center" gap={2}>
                <Box as={Leaf} boxSize="8" color="green.600" />
                <Heading size="xl">Grow Buddy</Heading>
              </Flex>
              <Text color="gray.600">Welcome back!</Text>
            </VStack>

            {error && (
              <Alert.Root status="error" borderRadius="lg">
                <Alert.Indicator />
                <Alert.Description fontSize="sm">{error}</Alert.Description>
              </Alert.Root>
            )}

            <Box as="form" onSubmit={handleSubmit}>
              <VStack gap={6} align="stretch">
                <Field.Root>
                  <Field.Label htmlFor="email" fontSize="sm" fontWeight="medium">
                    Email Address
                  </Field.Label>
                  <Input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    placeholder="you@example.com"
                  />
                </Field.Root>

                <Field.Root>
                  <Field.Label htmlFor="password" fontSize="sm" fontWeight="medium">
                    Password
                  </Field.Label>
                  <Box position="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      required
                      minLength={8}
                      placeholder="••••••••"
                      pr="10"
                      />
                    <IconButton
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword(!showPassword)}
                      position="absolute"
                      right="3"
                      top="50%"
                      transform="translateY(-50%)"
                      variant="ghost"
                      size="sm"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </IconButton>
                  </Box>
                </Field.Root>

                <Button
                  type="submit"
                  disabled={isLoading}
                  colorScheme="green"
                  size="lg"
                  width="full"
                  fontWeight="medium"
                >
                  {isLoading ? "Please wait..." : "Sign In"}
                </Button>
              </VStack>
            </Box>

            <Text textAlign="center" fontSize="sm">
              <Link to="/signup" color="green.600" _hover={{ color: "green.700" }} fontWeight="medium">
                Don't have an account? Sign up
              </Link>
            </Text>
          </VStack>
        </Box>
      </Container>
    </Box>
  )
}
