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

export function SignupPage() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })
  const [validationError, setValidationError] = useState("")

  const { signup, isLoading, error, clearError } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    setValidationError("")

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      setValidationError("Please enter a valid email address")
      return
    }

    // Validate password confirmation
    if (formData.password !== formData.confirmPassword) {
      setValidationError("Passwords do not match")
      return
    }

    try {
      await signup(formData.email, formData.password, formData.timezone)
      navigate("/dashboard")
    } catch (error) {
      // Error is handled by the hook
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    // Clear validation error when user updates email or password fields
    if (name === "email" || name === "password" || name === "confirmPassword") {
      setValidationError("")
    }
  }

  // Get list of common timezones for the select dropdown
  const commonTimezones = [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Anchorage",
    "Pacific/Honolulu",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Asia/Tokyo",
    "Asia/Shanghai",
    "Asia/Dubai",
    "Australia/Sydney",
    "Pacific/Auckland",
  ]

  const displayError = validationError || error

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
              <Text color="gray.600">Join the growing community</Text>
            </VStack>

            {displayError && (
              <Alert.Root status="error" borderRadius="lg">
                <Alert.Indicator />
                <Alert.Description fontSize="sm">{displayError}</Alert.Description>
              </Alert.Root>
            )}

            <Box as="form" onSubmit={handleSubmit}>
              <VStack gap={6} align="stretch">
                <Field.Root>
                  <Field.Label htmlFor="email" fontSize="sm" fontWeight="medium">
                    Email Address
                  </Field.Label>
                  <Input
                    type="text"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    autoComplete="email"
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
                  <Field.HelperText fontSize="xs" color="gray.500" mt={1}>
                    Minimum 8 characters required
                  </Field.HelperText>
                </Field.Root>

                <Field.Root>
                  <Field.Label htmlFor="confirmPassword" fontSize="sm" fontWeight="medium">
                    Confirm Password
                  </Field.Label>
                  <Box position="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      id="confirmPassword"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      required
                      minLength={8}
                      placeholder="••••••••"
                      pr="10"
                      />
                    <IconButton
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      position="absolute"
                      right="3"
                      top="50%"
                      transform="translateY(-50%)"
                      variant="ghost"
                      size="sm"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </IconButton>
                  </Box>
                </Field.Root>

                <Field.Root>
                  <Field.Label htmlFor="timezone" fontSize="sm" fontWeight="medium">
                    Timezone
                  </Field.Label>
                  <select
                    id="timezone"
                    name="timezone"
                    value={formData.timezone}
                    onChange={(e) => setFormData((prev) => ({ ...prev, timezone: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.375rem',
                      borderWidth: '1px',
                      borderColor: 'var(--chakra-colors-gray-300)',
                    }}
                  >
                    {commonTimezones.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                </Field.Root>

                <Button
                  type="submit"
                  disabled={isLoading}
                  colorScheme="green"
                  size="lg"
                  width="full"
                  fontWeight="medium"
                >
                  {isLoading ? "Please wait..." : "Create Account"}
                </Button>
              </VStack>
            </Box>

            <Text textAlign="center" fontSize="sm">
              <Link to="/login" color="green.600" _hover={{ color: "green.700" }} fontWeight="medium">
                Already have an account? Sign in
              </Link>
            </Text>
          </VStack>
        </Box>
      </Container>
    </Box>
  )
}
