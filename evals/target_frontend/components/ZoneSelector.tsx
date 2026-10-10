"use client"

import type React from "react"
import { useState, useEffect } from "react"
import {
  Box,
  VStack,
  HStack,
  Flex,
  Text,
  Input,
  Button,
  Badge,
  Card,
  Heading,
  Spinner,
  Field,
} from "@chakra-ui/react"
import { MapPin, CheckCircle2 } from "lucide-react"
import { useUserZone, useDetectZone, useUpdateZone } from "../hooks/useZone"

interface ZoneSelectorProps {
  onZoneChange?: (zone: number) => void
  compact?: boolean
}

export const ZoneSelector: React.FC<ZoneSelectorProps> = ({ onZoneChange, compact = false }) => {
  const { data: userZone, isLoading: isLoadingZone } = useUserZone()
  const detectZone = useDetectZone()
  const updateZone = useUpdateZone()

  const [postalCode, setPostalCode] = useState("")
  const [detectedZone, setDetectedZone] = useState<number | null>(null)
  const [manualZone, setManualZone] = useState<number | null>(null)

  useEffect(() => {
    if (userZone) {
      // If zone is overridden, use it as manual zone, otherwise use it as detected zone
      if (userZone.isOverride) {
        setManualZone(userZone.zone || null)
        setDetectedZone(null)
      } else {
        setDetectedZone(userZone.zone || null)
        setManualZone(null)
      }
      setPostalCode(userZone.postalCode || "")
    }
  }, [userZone])

  const handleDetectZone = async () => {
    if (!postalCode) return

    try {
      const result = await detectZone.mutateAsync(postalCode)
      if (result.zone) {
        setDetectedZone(result.zone)
        onZoneChange?.(result.zone)
      }
    } catch {
      // Error handled by mutation state
    }
  }

  const handleSaveZone = async () => {
    const zoneToSave = manualZone ?? detectedZone;
    if (!zoneToSave) return;

    try {
      await updateZone.mutateAsync({
        zone: zoneToSave,
        postalCode: postalCode || undefined,
        override: !!manualZone,
      })
      onZoneChange?.(zoneToSave)
    } catch {
      // Error handled by mutation state
    }
  }

  const currentZone = manualZone || detectedZone

  if (compact) {
    return (
      <VStack gap={3} align="stretch">
        <Flex align="center" gap={2}>
          <Box as={MapPin} boxSize="4" color="gray.500" />
          <Text fontSize="sm" fontWeight="medium">Growing Zone</Text>
          {currentZone && (
            <Badge variant="outline" bg="green.50" color="green.700" borderColor="green.200">
              Zone {currentZone}
            </Badge>
          )}
        </Flex>
        <Flex gap={2}>
          <Input
            type="text"
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
            placeholder="ZIP/Postal Code"
            flex="1"
            size="sm"
          />
          <Button
            onClick={handleDetectZone}
            disabled={detectZone.isPending || !postalCode}
            loading={detectZone.isPending}
            colorScheme="green"
            size="sm"
          >
            {detectZone.isPending ? "" : "Detect"}
          </Button>
        </Flex>
        {detectedZone && (
          <Flex align="center" gap={2} fontSize="sm" color="gray.600">
            <Box as={CheckCircle2} boxSize="4" color="green.500" />
            <Text>Detected: Zone {detectedZone}</Text>
          </Flex>
        )}
        <Flex gap={2} align="center">
          <Text fontSize="sm" color="gray.600">Manual Override:</Text>
          <select
            value={manualZone || ""}
            onChange={(e) => setManualZone(e.target.value ? Number.parseInt(e.target.value) : null)}
            style={{
              flex: 1,
              padding: '0.25rem 0.5rem',
              fontSize: '0.875rem',
              borderRadius: '0.375rem',
              borderWidth: '1px',
              borderColor: 'var(--chakra-colors-gray-300)',
            }}
          >
            <option value="">Auto-detect</option>
            {Array.from({ length: 13 }, (_, i) => i + 1).map((zone) => (
              <option key={zone} value={zone}>
                Zone {zone}
              </option>
            ))}
          </select>
          <Button
            onClick={handleSaveZone}
            disabled={updateZone.isPending}
            loading={updateZone.isPending}
            colorScheme="green"
            size="sm"
          >
            {updateZone.isPending ? "" : "Save"}
          </Button>
        </Flex>
      </VStack>
    )
  }

  return (
    <Card.Root>
      <Card.Header>
        <Flex align="center" gap={2}>
          <Box as={MapPin} boxSize="5" />
          <Heading size="md">Growing Zone Settings</Heading>
        </Flex>
        <Text fontSize="sm" color="gray.600" mt={1}>
          Set your USDA hardiness zone to get personalized plant recommendations and care schedules
        </Text>
      </Card.Header>
      <Card.Body>
        {isLoadingZone ? (
          <Flex align="center" justify="center" py={8}>
            <Spinner size="lg" color="gray.400" />
          </Flex>
        ) : (
          <VStack gap={4} align="stretch">
            <Field.Root>
              <Field.Label fontSize="sm" fontWeight="medium" color="gray.700">
                ZIP/Postal Code
              </Field.Label>
              <Flex gap={2}>
                <Input
                  id="postal_code"
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="Enter your ZIP or postal code"
                  flex="1"
                      />
                <Button
                  onClick={handleDetectZone}
                  disabled={detectZone.isPending || !postalCode}
                  loading={detectZone.isPending}
                  colorScheme="green"
                  loadingText="Detecting..."
                >
                  {detectZone.isPending ? "" : "Detect Zone"}
                </Button>
              </Flex>
            </Field.Root>

            {detectedZone && (
              <Flex align="center" gap={2} p={3} bg="green.50" border="1px" borderColor="green.200" borderRadius="md">
                <Box as={CheckCircle2} boxSize="5" color="green.500" />
                <Text fontSize="sm" color="green.700">Detected Zone: {detectedZone}</Text>
              </Flex>
            )}

            <Field.Root>
              <Field.Label fontSize="sm" fontWeight="medium" color="gray.700">
                Manual Override (Optional)
              </Field.Label>
              <select
                id="manual_zone"
                value={manualZone || ""}
                onChange={(e) => setManualZone(e.target.value ? Number.parseInt(e.target.value) : null)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.375rem',
                  borderWidth: '1px',
                  borderColor: 'var(--chakra-colors-gray-300)',
                }}
              >
                <option value="">Use auto-detected zone</option>
                {Array.from({ length: 13 }, (_, i) => i + 1).map((zone) => (
                  <option key={zone} value={zone}>
                    Zone {zone}
                  </option>
                ))}
              </select>
              <Field.HelperText fontSize="xs" color="gray.500">
                If auto-detection is inaccurate, you can manually select your zone
              </Field.HelperText>
            </Field.Root>

            <Flex align="center" justify="space-between" pt={4} borderTop="1px" borderColor="gray.200">
              <Box>
                <Text fontSize="sm" fontWeight="medium" color="gray.700">Current Zone</Text>
                <Text fontSize="2xl" fontWeight="bold" color="green.600">
                  {currentZone ? `Zone ${currentZone}` : "Not set"}
                </Text>
              </Box>
              <Button
                onClick={handleSaveZone}
                disabled={updateZone.isPending}
                loading={updateZone.isPending}
                colorScheme="green"
                loadingText="Saving..."
              >
                {updateZone.isPending ? "" : "Save Changes"}
              </Button>
            </Flex>
          </VStack>
        )}
      </Card.Body>
    </Card.Root>
  )
}
