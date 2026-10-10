"use client"

import React, { useState, useEffect } from "react"
import {
  Box,
  VStack,
  HStack,
  Field,
  Input,
  Textarea,
  NativeSelect,
  Button,
  RadioGroup,
  Text,
  Separator,
  Badge,
  Card,
  Heading,
  List,
} from "@chakra-ui/react"
import { Send, Users, User } from "lucide-react"
import {
  sendNotificationToUser,
  sendNotificationToAll,
  getAllUsers,
  AdminUser,
} from "../../api/adminApi"
import { toaster } from "../ChakraProvider"

interface NotificationHistory {
  id: string
  recipient: string
  message: string
  type: string
  timestamp: Date
}

export const NotificationTester: React.FC = () => {
  const [recipientType, setRecipientType] = useState<"all" | "specific">("specific")
  const [selectedUserId, setSelectedUserId] = useState("")
  const [message, setMessage] = useState("")
  const [link, setLink] = useState("")
  const [notificationType, setNotificationType] = useState<"info" | "success" | "warning" | "error">("info")
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [history, setHistory] = useState<NotificationHistory[]>([])

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setLoadingUsers(true)
    try {
      const response = await getAllUsers(1, 100)
      setUsers(response.users)
      if (response.users.length > 0) {
        setSelectedUserId(response.users[0].id)
      }
    } catch (error) {
      toaster.create({
        title: "Error fetching users",
        description: error instanceof Error ? error.message : "Unknown error",
        type: "error",
        duration: 5000,
      })
    } finally {
      setLoadingUsers(false)
    }
  }

  const handleSendNotification = async () => {
    if (!message.trim()) {
      toaster.create({
        title: "Message required",
        description: "Please enter a notification message",
        type: "warning",
        duration: 3000,
      })
      return
    }

    if (recipientType === "specific" && !selectedUserId) {
      toaster.create({
        title: "User required",
        description: "Please select a user",
        type: "warning",
        duration: 3000,
      })
      return
    }

    setLoading(true)
    try {
      if (recipientType === "all") {
        const response = await sendNotificationToAll({
          message,
          link: link || undefined,
          type: notificationType,
        })

        toaster.create({
          title: "Notifications sent successfully",
          description: `Sent to ${response.count} of ${response.total} users`,
          type: "success",
          duration: 5000,
        })

        // Add to history
        setHistory([
          {
            id: Date.now().toString(),
            recipient: `All Users (${response.count})`,
            message,
            type: notificationType,
            timestamp: new Date(),
          },
          ...history,
        ])
      } else {
        await sendNotificationToUser({
          userId: selectedUserId,
          message,
          link: link || undefined,
          type: notificationType,
        })

        const selectedUser = users.find(u => u.id === selectedUserId)

        toaster.create({
          title: "Notification sent successfully",
          description: `Sent to ${selectedUser?.email}`,
          type: "success",
          duration: 5000,
        })

        // Add to history
        setHistory([
          {
            id: Date.now().toString(),
            recipient: selectedUser?.email || "Unknown",
            message,
            type: notificationType,
            timestamp: new Date(),
          },
          ...history,
        ])
      }

      // Clear form
      setMessage("")
      setLink("")
    } catch (error) {
      toaster.create({
        title: "Error sending notification",
        description: error instanceof Error ? error.message : "Unknown error",
        type: "error",
        duration: 5000,
      })
    } finally {
      setLoading(false)
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "success": return "green"
      case "warning": return "yellow"
      case "error": return "red"
      default: return "blue"
    }
  }

  return (
    <Box>
      <VStack align="stretch" gap={6}>
        {/* Notification Form */}
        <Card.Root>
          <Card.Header>
            <Heading size="md">Send Test Notification</Heading>
          </Card.Header>
          <Card.Body>
            <VStack gap={4} align="stretch">
              {/* Recipient Type */}
              <Field.Root>
                <Field.Label>Send To</Field.Label>
                <RadioGroup.Root value={recipientType} onValueChange={(e) => setRecipientType(e.value as "all" | "specific")}>
                  <HStack gap={6}>
                    <RadioGroup.Item value="specific">
                      <RadioGroup.ItemControl />
                      <RadioGroup.ItemText>
                        <HStack gap={2}>
                          <User style={{ height: '16px', width: '16px' }} />
                          <Text>Specific User</Text>
                        </HStack>
                      </RadioGroup.ItemText>
                    </RadioGroup.Item>
                    <RadioGroup.Item value="all">
                      <RadioGroup.ItemControl />
                      <RadioGroup.ItemText>
                        <HStack gap={2}>
                          <Users style={{ height: '16px', width: '16px' }} />
                          <Text>All Users</Text>
                        </HStack>
                      </RadioGroup.ItemText>
                    </RadioGroup.Item>
                  </HStack>
                </RadioGroup.Root>
              </Field.Root>

              {/* User Selector (shown only for specific user) */}
              {recipientType === "specific" && (
                <Field.Root>
                  <Field.Label>Select User</Field.Label>
                  <NativeSelect.Root disabled={loadingUsers}>
                    <NativeSelect.Field
                      value={selectedUserId}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedUserId(e.target.value)}
                    >
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.email} {user.growing_zone ? `(Zone ${user.growing_zone})` : ""}
                        </option>
                      ))}
                    </NativeSelect.Field>
                  </NativeSelect.Root>
                  {users.length === 0 && !loadingUsers && (
                    <Text fontSize="sm" color="orange.500" mt={1}>
                      No users available
                    </Text>
                  )}
                </Field.Root>
              )}

              {/* Message */}
              <Field.Root required>
                <Field.Label>Message</Field.Label>
                <Textarea
                  placeholder="Enter notification message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  maxLength={5000}
                />
                <Text fontSize="xs" color="gray.500" mt={1}>
                  {message.length} / 5000 characters
                </Text>
              </Field.Root>

              {/* Link (Optional) */}
              <Field.Root>
                <Field.Label>Link (Optional)</Field.Label>
                <Input
                  placeholder="/path/to/page"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  maxLength={500}
                />
              </Field.Root>

              {/* Type */}
              <Field.Root>
                <Field.Label>Notification Type</Field.Label>
                <RadioGroup.Root value={notificationType} onValueChange={(e) => setNotificationType(e.value as "info" | "success" | "warning" | "error")}>
                  <HStack gap={4}>
                    <RadioGroup.Item value="info">
                      <RadioGroup.ItemControl />
                      <RadioGroup.ItemText>
                        <Badge colorScheme="blue">Info</Badge>
                      </RadioGroup.ItemText>
                    </RadioGroup.Item>
                    <RadioGroup.Item value="success">
                      <RadioGroup.ItemControl />
                      <RadioGroup.ItemText>
                        <Badge colorScheme="green">Success</Badge>
                      </RadioGroup.ItemText>
                    </RadioGroup.Item>
                    <RadioGroup.Item value="warning">
                      <RadioGroup.ItemControl />
                      <RadioGroup.ItemText>
                        <Badge colorScheme="yellow">Warning</Badge>
                      </RadioGroup.ItemText>
                    </RadioGroup.Item>
                    <RadioGroup.Item value="error">
                      <RadioGroup.ItemControl />
                      <RadioGroup.ItemText>
                        <Badge colorScheme="red">Error</Badge>
                      </RadioGroup.ItemText>
                    </RadioGroup.Item>
                  </HStack>
                </RadioGroup.Root>
              </Field.Root>

              {/* Send Button */}
              <Button
                colorScheme="purple"
                onClick={handleSendNotification}
                loading={loading}
                size="lg"
              >
                <Send style={{ height: '16px', width: '16px', marginRight: '8px' }} />
                {recipientType === "all" ? "Send to All Users" : "Send Notification"}
              </Button>
            </VStack>
          </Card.Body>
        </Card.Root>

        {/* Notification History */}
        <Card.Root>
          <Card.Header>
            <Heading size="md">Recent Notifications</Heading>
          </Card.Header>
          <Card.Body>
            {history.length === 0 ? (
              <Text color="gray.500" textAlign="center" py={4}>
                No notifications sent yet
              </Text>
            ) : (
              <List.Root gap={3}>
                {history.slice(0, 10).map((item) => (
                  <List.Item key={item.id}>
                    <Box p={3} borderWidth={1} borderRadius="md" bg="gray.50">
                      <HStack justify="space-between" mb={2}>
                        <HStack>
                          <Badge colorScheme={getTypeColor(item.type)}>
                            {item.type}
                          </Badge>
                          <Text fontSize="sm" fontWeight="medium">
                            {item.recipient}
                          </Text>
                        </HStack>
                        <Text fontSize="xs" color="gray.500">
                          {item.timestamp.toLocaleTimeString()}
                        </Text>
                      </HStack>
                      <Text fontSize="sm" color="gray.700">
                        {item.message}
                      </Text>
                    </Box>
                  </List.Item>
                ))}
              </List.Root>
            )}
          </Card.Body>
        </Card.Root>
      </VStack>
    </Box>
  )
}
