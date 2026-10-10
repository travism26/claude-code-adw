"use client"

import React, { useState, useEffect, useCallback } from "react"
import {
  Box,
  Table,
  Button,
  Input,
  HStack,
  VStack,
  Text,
  Spinner,
  Dialog,
  Field,
  Badge,
  Flex,
  IconButton,
} from "@chakra-ui/react"
import { Search, Edit2, ChevronLeft, ChevronRight } from "lucide-react"
import { getAllUsers, getUserById, updateUser, AdminUser, UpdateUserRequest } from "../../api/adminApi"
import { toaster } from "../ChakraProvider"

interface UseDisclosureReturn {
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
}

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalUsers, setTotalUsers] = useState(0)
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [editLoading, setEditLoading] = useState(false)
  const [formData, setFormData] = useState<UpdateUserRequest>({})
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const [isOpen, setIsOpen] = useState(false)
  const onOpen = () => setIsOpen(true)
  const onClose = () => setIsOpen(false)

  const limit = 20

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const response = await getAllUsers(currentPage, limit, searchTerm)
      setUsers(response.users)
      setTotalPages(response.pagination.totalPages)
      setTotalUsers(response.pagination.total)
    } catch (error) {
      toaster.create({
        title: "Error fetching users",
        description: error instanceof Error ? error.message : "Unknown error",
        type: "error",
        duration: 5000,
      })
    } finally {
      setLoading(false)
    }
  }, [currentPage, searchTerm])

  useEffect(() => {
    fetchUsers()
  }, [currentPage, fetchUsers])

  const handleSearch = () => {
    setCurrentPage(1)
    fetchUsers()
  }

  const handleEditClick = async (user: AdminUser) => {
    setSelectedUser(user)
    setFormData({
      email: user.email,
      growing_zone: user.growing_zone || "",
      postal_code: user.postal_code || "",
      tz: user.tz,
    })
    setFormErrors({})
    onOpen()
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Invalid email format"
    }

    if (formData.growing_zone && !/^([1-9]|1[0-3])[ab]?$/.test(formData.growing_zone)) {
      errors.growing_zone = "Invalid zone format (e.g., 7a, 8b, 10)"
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSaveUser = async () => {
    if (!selectedUser) return

    if (!validateForm()) {
      return
    }

    setEditLoading(true)
    try {
      const updatedUser = await updateUser(selectedUser.id, formData)

      // Update user in list
      setUsers(users.map(u => u.id === updatedUser.id ? updatedUser : u))

      toaster.create({
        title: "User updated successfully",
        type: "success",
        duration: 3000,
      })

      onClose()
    } catch (error) {
      toaster.create({
        title: "Error updating user",
        description: error instanceof Error ? error.message : "Unknown error",
        type: "error",
        duration: 5000,
      })
    } finally {
      setEditLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  return (
    <Box>
      <VStack align="stretch" gap={4}>
        {/* Search Bar */}
        <HStack>
          <Input
            placeholder="Search by email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSearch()}
          />
          <Button
            colorScheme="purple"
            onClick={handleSearch}
          >
            <Search style={{ height: '16px', width: '16px', marginRight: '8px' }} />
            Search
          </Button>
        </HStack>

        {/* User Count */}
        <Text fontSize="sm" color="gray.600">
          Total Users: <strong>{totalUsers}</strong>
        </Text>

        {/* Users Table */}
        {loading ? (
          <Flex justify="center" align="center" py={10}>
            <Spinner size="xl" color="purple.500" />
          </Flex>
        ) : users.length === 0 ? (
          <Box textAlign="center" py={10}>
            <Text color="gray.500">No users found</Text>
          </Box>
        ) : (
          <>
            <Box overflowX="auto" borderWidth={1} borderRadius="lg" bg="white">
              <Table.Root variant="line">
                <Table.Header bg="gray.50">
                  <Table.Row>
                    <Table.ColumnHeader>Email</Table.ColumnHeader>
                    <Table.ColumnHeader>Zone</Table.ColumnHeader>
                    <Table.ColumnHeader>Postal Code</Table.ColumnHeader>
                    <Table.ColumnHeader>Timezone</Table.ColumnHeader>
                    <Table.ColumnHeader>Created</Table.ColumnHeader>
                    <Table.ColumnHeader>Actions</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {users.map((user) => (
                    <Table.Row key={user.id}>
                      <Table.Cell>
                        <Text fontWeight="medium">{user.email}</Text>
                        <Text fontSize="xs" color="gray.500">{user.id}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        {user.growing_zone ? (
                          <Badge colorScheme="green">{user.growing_zone}</Badge>
                        ) : (
                          <Text color="gray.400">-</Text>
                        )}
                      </Table.Cell>
                      <Table.Cell>{user.postal_code || "-"}</Table.Cell>
                      <Table.Cell>
                        <Text fontSize="sm">{user.tz}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text fontSize="sm">{formatDate(user.created_at)}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <IconButton
                          aria-label="Edit user"
                          size="sm"
                          colorScheme="blue"
                          variant="ghost"
                          onClick={() => handleEditClick(user)}
                        >
                          <Edit2 style={{ height: '16px', width: '16px' }} />
                        </IconButton>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Box>

            {/* Pagination */}
            <Flex justify="space-between" align="center">
              <Text fontSize="sm" color="gray.600">
                Page {currentPage} of {totalPages}
              </Text>
              <HStack>
                <Button
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft style={{ height: '16px', width: '16px', marginRight: '8px' }} />
                  Previous
                </Button>
                <Button
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight style={{ height: '16px', width: '16px', marginLeft: '8px' }} />
                </Button>
              </HStack>
            </Flex>
          </>
        )}
      </VStack>

      {/* Edit User Dialog */}
      <Dialog.Root open={isOpen} onOpenChange={(e) => e.open ? undefined : onClose()} size="lg">
        <Dialog.Backdrop bg="blackAlpha.600" />
        <Dialog.Positioner>
          <Dialog.Content bg="white" boxShadow="lg" borderRadius="lg">
            <Dialog.Header>Edit User</Dialog.Header>
            <Dialog.CloseTrigger />
            <Dialog.Body>
              <VStack gap={4}>
                <Field.Root invalid={!!formErrors.email}>
                  <Field.Label>Email</Field.Label>
                  <Input
                    type="email"
                    value={formData.email || ""}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                  <Field.ErrorText>{formErrors.email}</Field.ErrorText>
                </Field.Root>

                <Field.Root invalid={!!formErrors.growing_zone}>
                  <Field.Label>Growing Zone</Field.Label>
                  <Input
                    placeholder="e.g., 7a, 8b, 10"
                    value={formData.growing_zone || ""}
                    onChange={(e) => setFormData({ ...formData, growing_zone: e.target.value })}
                  />
                  <Field.ErrorText>{formErrors.growing_zone}</Field.ErrorText>
                </Field.Root>

                <Field.Root>
                  <Field.Label>Postal Code</Field.Label>
                  <Input
                    value={formData.postal_code || ""}
                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                  />
                </Field.Root>

                <Field.Root>
                  <Field.Label>Timezone</Field.Label>
                  <Input
                    value={formData.tz || ""}
                    onChange={(e) => setFormData({ ...formData, tz: e.target.value })}
                  />
                </Field.Root>

                {selectedUser && (
                  <Box w="full" p={3} bg="gray.50" borderRadius="md">
                    <Text fontSize="xs" color="gray.600">User ID</Text>
                    <Text fontSize="sm" fontFamily="mono">{selectedUser.id}</Text>
                  </Box>
                )}
              </VStack>
            </Dialog.Body>

            <Dialog.Footer>
              <Button variant="ghost" mr={3} onClick={onClose}>
                Cancel
              </Button>
              <Button
                colorScheme="purple"
                onClick={handleSaveUser}
                loading={editLoading}
              >
                Save Changes
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Box>
  )
}
