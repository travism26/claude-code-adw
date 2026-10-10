"use client"

import type React from "react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Leaf, Eye, EyeOff } from "lucide-react"
import {
  Box,
  Button,
  Flex,
  Field,
  Heading,
  Icon,
  Input,
  Group,
  InputElement,
  Text,
  VStack,
  Alert,
  IconButton,
} from "@chakra-ui/react"
import { useAuth } from "../hooks/useAuth"

interface AuthFormProps {
  onSuccess: () => void
}

export const AuthForm: React.FC<AuthFormProps> = ({ onSuccess }) => {
  const navigate = useNavigate()
  const [isLogin, setIsLogin] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })

  const { signup, login, isLoading, error, clearError } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()

    try {
      if (isLogin) {
        await login(formData.email, formData.password)
      } else {
        await signup(formData.email, formData.password, formData.timezone)
      }
      navigate("/dashboard")
      onSuccess()
    } catch (error) {
      // Error is handled by the hook
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  return (
    <Flex minH="100vh" bg="green.50" align="center" justify="center" p={4}>
      <Box w="full" maxW="md">
        <Box bg="white" rounded="lg" shadow="lg" p={8}>
          <VStack gap={8} align="stretch">
            <VStack gap={4} textAlign="center">
              <Flex align="center" justify="center" gap={2}>
                <Icon as={Leaf} boxSize={8} color="green.600" />
                <Heading as="h1" size="xl" color="gray.900">
                  Grow Buddy
                </Heading>
              </Flex>
              <Text color="gray.600">{isLogin ? "Welcome back!" : "Join the growing community"}</Text>
            </VStack>

            {error && (
              <Alert.Root status="error" rounded="lg">
                <Alert.Indicator />
                <Alert.Title fontSize="sm">{error}</Alert.Title>
              </Alert.Root>
            )}

            <form onSubmit={handleSubmit}>
              <VStack gap={6} align="stretch">
                <Field.Root required>
                  <Field.Label htmlFor="email" fontSize="sm" fontWeight="medium" color="gray.700">
                    Email Address
                  </Field.Label>
                  <Input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="you@example.com"
                  />
                </Field.Root>

                <Field.Root required>
                  <Field.Label htmlFor="password" fontSize="sm" fontWeight="medium" color="gray.700">
                    Password
                  </Field.Label>
                  <Group w="full">
                    <Input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      minLength={8}
                      placeholder="••••••••"
                      />
                    <InputElement placement="end">
                      <IconButton
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowPassword(!showPassword)}
                        color="gray.400"
                        _hover={{ color: "gray.600" }}
                      >
                        <Icon as={showPassword ? EyeOff : Eye} boxSize={4} />
                      </IconButton>
                    </InputElement>
                  </Group>
                  {!isLogin && (
                    <Field.HelperText fontSize="xs" color="gray.500" mt={1}>
                      Minimum 8 characters required
                    </Field.HelperText>
                  )}
                </Field.Root>

                <Button
                  type="submit"
                  loading={isLoading}
                  loadingText="Please wait..."
                  colorScheme="green"
                  size="lg"
                  w="full"
                  fontWeight="medium"
                >
                  {isLogin ? "Sign In" : "Create Account"}
                </Button>
              </VStack>
            </form>

            <Box textAlign="center">
              <Button
                variant="plain"
                colorScheme="green"
                fontWeight="medium"
                onClick={() => {
                  setIsLogin(!isLogin)
                  clearError()
                }}
              >
                {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </Button>
            </Box>
          </VStack>
        </Box>
      </Box>
    </Flex>
  )
}
