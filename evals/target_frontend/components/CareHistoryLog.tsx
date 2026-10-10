"use client"

import type React from "react"
import { useState } from "react"
import {
  Box,
  VStack,
  HStack,
  Flex,
  Text,
  Input,
  NativeSelectRoot,
  NativeSelectField,
  Button,
  Badge,
  Card,
  Heading,
  Spinner,
  IconButton,
  Field,
} from "@chakra-ui/react"
import { Droplet, Sprout, Scissors, Apple, ArrowUpCircle, MoreHorizontal, Trash2, Plus } from "lucide-react"
import { useCareHistory, useLogCareAction, useDeleteCareHistory } from "../hooks/useCareHistory"
import type { CareActionType } from "../types"

interface CareHistoryLogProps {
  plantId: string
  plantName?: string
  compact?: boolean
}

const ACTION_ICONS: Record<CareActionType, React.ReactNode> = {
  watered: <Box as={Droplet} boxSize="4" color="blue.500" />,
  fertilized: <Box as={Sprout} boxSize="4" color="green.500" />,
  pruned: <Box as={Scissors} boxSize="4" color="purple.500" />,
  repotted: <Box as={ArrowUpCircle} boxSize="4" color="orange.500" />,
  other: <Box as={MoreHorizontal} boxSize="4" color="gray.500" />,
}

const ACTION_COLORS: Record<CareActionType, { bg: string; color: string; borderColor: string }> = {
  watered: { bg: "blue.100", color: "blue.800", borderColor: "blue.200" },
  fertilized: { bg: "green.100", color: "green.800", borderColor: "green.200" },
  pruned: { bg: "purple.100", color: "purple.800", borderColor: "purple.200" },
  repotted: { bg: "orange.100", color: "orange.800", borderColor: "orange.200" },
  other: { bg: "gray.100", color: "gray.800", borderColor: "gray.200" },
}

export const CareHistoryLog: React.FC<CareHistoryLogProps> = ({ plantId, plantName, compact = false }) => {
  const [showAddForm, setShowAddForm] = useState(false)
  const [actionType, setActionType] = useState<CareActionType>("watered")
  const [notes, setNotes] = useState("")

  const { data: response, isLoading } = useCareHistory(plantId)
  const logAction = useLogCareAction()
  const deleteEntry = useDeleteCareHistory()

  const history = response?.careHistory || []

  const handleLogAction = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await logAction.mutateAsync({
        plantId,
        actionType,
        notes: notes || undefined,
      })
      setNotes("")
      setShowAddForm(false)
    } catch {
      // Error handled by mutation state
    }
  }

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm("Are you sure you want to delete this entry?")) return
    try {
      await deleteEntry.mutateAsync(entryId)
    } catch {
      // Error handled by mutation state
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  }

  if (compact) {
    return (
      <VStack gap={2} align="stretch">
        <Flex align="center" justify="space-between">
          <Heading as="h3" size="sm" fontWeight="medium" color="gray.700">Recent Care</Heading>
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            size="xs"
            color="green.600"
            variant="plain"
            _hover={{ color: "green.700" }}
          >
            <Box as={Plus} boxSize="3" />
            Log Care
          </Button>
        </Flex>

        {showAddForm && (
          <Box as="form" onSubmit={handleLogAction} p={3} bg="gray.50" borderRadius="lg" border="1px" borderColor="gray.200">
            <VStack gap={2}>
              <NativeSelectRoot size="sm">
                <NativeSelectField
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value as CareActionType)}
                >
                  <option value="watered">Watered</option>
                  <option value="fertilized">Fertilized</option>
                  <option value="pruned">Pruned</option>
                  <option value="repotted">Repotted</option>
                  <option value="other">Other</option>
                </NativeSelectField>
              </NativeSelectRoot>
              <Input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes (optional)"
                size="sm"
              />
              <HStack gap={2} width="full">
                <Button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  flex="1"
                  size="xs"
                  variant="outline"
                  colorScheme="gray"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={logAction.isPending}
                  flex="1"
                  size="xs"
                  colorScheme="green"
                >
                  {logAction.isPending ? "Logging..." : "Log"}
                </Button>
              </HStack>
            </VStack>
          </Box>
        )}

        {isLoading ? (
          <Flex justify="center" py={4}>
            <Spinner size="sm" color="gray.400" />
          </Flex>
        ) : history && history.length > 0 ? (
          <VStack gap={2} align="stretch">
            {history.slice(0, 3).map((entry) => (
              <Flex key={entry.id} align="center" gap={2} fontSize="sm">
                {ACTION_ICONS[entry.action_type]}
                <Text flex="1" color="gray.700">{entry.action_type}</Text>
                <Text fontSize="xs" color="gray.500">{formatDate(entry.action_date)}</Text>
              </Flex>
            ))}
            {history.length > 3 && (
              <Text fontSize="xs" color="gray.500" textAlign="center">+{history.length - 3} more</Text>
            )}
          </VStack>
        ) : (
          <Text fontSize="xs" color="gray.500" textAlign="center" py={2}>No care history yet</Text>
        )}
      </VStack>
    )
  }

  return (
    <Card.Root>
      <Card.Header>
        <Flex align="center" justify="space-between">
          <Box>
            <Heading size="md">Care History</Heading>
            {plantName && <Text fontSize="sm" color="gray.600">{plantName}</Text>}
          </Box>
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            colorScheme="green"
            size="sm"
          >
            <Box as={Plus} boxSize="4" />
            Log Care
          </Button>
        </Flex>
      </Card.Header>
      <Card.Body>
        <VStack gap={4} align="stretch">
          {showAddForm && (
            <Box as="form" onSubmit={handleLogAction} p={4} bg="gray.50" borderRadius="lg" border="1px" borderColor="gray.200">
              <VStack gap={3} align="stretch">
                <Field.Root>
                  <Field.Label fontSize="sm" fontWeight="medium" color="gray.700">Action Type</Field.Label>
                  <NativeSelectRoot>
                    <NativeSelectField
                      value={actionType}
                      onChange={(e) => setActionType(e.target.value as CareActionType)}
                    >
                      <option value="watered">Watered</option>
                      <option value="fertilized">Fertilized</option>
                      <option value="pruned">Pruned</option>
                      <option value="repotted">Repotted</option>
                      <option value="other">Other</option>
                    </NativeSelectField>
                  </NativeSelectRoot>
                </Field.Root>
                <Field.Root>
                  <Field.Label fontSize="sm" fontWeight="medium" color="gray.700">Notes (Optional)</Field.Label>
                  <Input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any notes about this care action..."
                      />
                </Field.Root>
                <HStack gap={2}>
                  <Button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false)
                      setNotes("")
                    }}
                    flex="1"
                    variant="outline"
                    colorScheme="gray"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    loading={logAction.isPending}
                    flex="1"
                    colorScheme="green"
                  >
                    {logAction.isPending ? "Logging..." : "Log Action"}
                  </Button>
                </HStack>
              </VStack>
            </Box>
          )}

          {isLoading ? (
            <Flex align="center" justify="center" py={8}>
              <Spinner size="lg" color="gray.400" />
            </Flex>
          ) : history && history.length > 0 ? (
            <VStack gap={3} align="stretch">
              {history.map((entry) => {
                const colors = ACTION_COLORS[entry.action_type]
                return (
                  <Flex
                    key={entry.id}
                    align="flex-start"
                    gap={3}
                    p={3}
                    border="1px"
                    borderColor="gray.200"
                    borderRadius="lg"
                    _hover={{ bg: "gray.50" }}
                    transition="background 0.2s"
                  >
                    <Box mt={1}>{ACTION_ICONS[entry.action_type]}</Box>
                    <Box flex="1">
                      <HStack gap={2} mb={1}>
                        <Badge
                          bg={colors.bg}
                          color={colors.color}
                          borderColor={colors.borderColor}
                          borderWidth="1px"
                        >
                          {entry.action_type.charAt(0).toUpperCase() + entry.action_type.slice(1)}
                        </Badge>
                        <Text fontSize="xs" color="gray.500">{formatDate(entry.action_date)}</Text>
                      </HStack>
                      {entry.notes && <Text fontSize="sm" color="gray.700">{entry.notes}</Text>}
                    </Box>
                    <IconButton
                      aria-label="Delete entry"
                      onClick={() => handleDeleteEntry(entry.id)}
                      loading={deleteEntry.isPending}
                      color="gray.400"
                      variant="ghost"
                      size="sm"
                      _hover={{ color: "red.500" }}
                      title="Delete entry"
                    >
                      <Box as={Trash2} boxSize="4" />
                    </IconButton>
                  </Flex>
                )
              })}
            </VStack>
          ) : (
            <Box textAlign="center" py={8}>
              <Text color="gray.500">No care history recorded yet</Text>
              <Text fontSize="sm" color="gray.400" mt={1}>Start logging care actions to track your plant&apos;s health</Text>
            </Box>
          )}
        </VStack>
      </Card.Body>
    </Card.Root>
  )
}
