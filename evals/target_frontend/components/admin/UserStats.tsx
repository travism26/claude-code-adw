"use client"

import React, { useState, useEffect } from "react"
import {
  Box,
  VStack,
  HStack,
  SimpleGrid,
  Card,
  Heading,
  Text,
  Button,
  Spinner,
  Flex,
  Badge,
  Table,
} from "@chakra-ui/react"
import { RefreshCw, Users, MapPin, Calendar, AlertCircle } from "lucide-react"
import { getStats, UserStats as UserStatsType } from "../../api/adminApi"
import { toaster } from "../ChakraProvider"

export const UserStats: React.FC = () => {
  const [stats, setStats] = useState<UserStatsType | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = async () => {
    setLoading(true)
    try {
      const data = await getStats()
      setStats(data)
    } catch (error) {
      toaster.create({
        title: "Error fetching statistics",
        description: error instanceof Error ? error.message : "Unknown error",
        type: "error",
        duration: 5000,
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  if (loading) {
    return (
      <Flex justify="center" align="center" minH="400px">
        <Spinner size="xl" color="purple.500" />
      </Flex>
    )
  }

  if (!stats) {
    return (
      <Box textAlign="center" py={10}>
        <Text color="gray.500">No statistics available</Text>
      </Box>
    )
  }

  return (
    <Box>
      <VStack align="stretch" gap={6}>
        {/* Refresh Button */}
        <Flex justify="flex-end">
          <Button
            size="sm"
            variant="outline"
            colorScheme="purple"
            onClick={fetchStats}
            loading={loading}
          >
            <RefreshCw style={{ height: '16px', width: '16px', marginRight: '8px' }} />
            Refresh
          </Button>
        </Flex>

        {/* Key Statistics Cards */}
        <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} gap={4}>
          <Card.Root>
            <Card.Body>
              <VStack align="stretch" gap={2}>
                <HStack gap={2}>
                  <Users style={{ height: '20px', width: '20px', color: '#805AD5' }} />
                  <Text fontSize="sm" fontWeight="medium">Total Users</Text>
                </HStack>
                <Text fontSize="3xl" fontWeight="bold" color="purple.600">
                  {stats.totalUsers}
                </Text>
                <Text fontSize="sm" color="gray.500">Registered accounts</Text>
              </VStack>
            </Card.Body>
          </Card.Root>

          <Card.Root>
            <Card.Body>
              <VStack align="stretch" gap={2}>
                <HStack gap={2}>
                  <Calendar style={{ height: '20px', width: '20px', color: '#38A169' }} />
                  <Text fontSize="sm" fontWeight="medium">Last 7 Days</Text>
                </HStack>
                <Text fontSize="3xl" fontWeight="bold" color="green.600">
                  {stats.recentSignups.last7Days}
                </Text>
                <Text fontSize="sm" color="gray.500">New signups</Text>
              </VStack>
            </Card.Body>
          </Card.Root>

          <Card.Root>
            <Card.Body>
              <VStack align="stretch" gap={2}>
                <HStack gap={2}>
                  <Calendar style={{ height: '20px', width: '20px', color: '#3182CE' }} />
                  <Text fontSize="sm" fontWeight="medium">Last 30 Days</Text>
                </HStack>
                <Text fontSize="3xl" fontWeight="bold" color="blue.600">
                  {stats.recentSignups.last30Days}
                </Text>
                <Text fontSize="sm" color="gray.500">New signups</Text>
              </VStack>
            </Card.Body>
          </Card.Root>

          <Card.Root>
            <Card.Body>
              <VStack align="stretch" gap={2}>
                <HStack gap={2}>
                  <AlertCircle style={{ height: '20px', width: '20px', color: '#DD6B20' }} />
                  <Text fontSize="sm" fontWeight="medium">No Zone Set</Text>
                </HStack>
                <Text fontSize="3xl" fontWeight="bold" color="orange.600">
                  {stats.usersWithoutZone}
                </Text>
                <Text fontSize="sm" color="gray.500">
                  {stats.totalUsers > 0
                    ? `${Math.round((stats.usersWithoutZone / stats.totalUsers) * 100)}%`
                    : "0%"
                  }
                </Text>
              </VStack>
            </Card.Body>
          </Card.Root>
        </SimpleGrid>

        {/* Users by Zone */}
        <Card.Root>
          <Card.Body>
            <VStack align="stretch" gap={4}>
              <HStack gap={2}>
                <MapPin style={{ height: '20px', width: '20px' }} />
                <Heading size="md">Users by Growing Zone</Heading>
              </HStack>

              {stats.usersByZone.length === 0 ? (
                <Text color="gray.500" textAlign="center" py={4}>
                  No zone data available
                </Text>
              ) : (
                <Box overflowX="auto">
                  <Table.Root variant="line" size="sm">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeader>Zone</Table.ColumnHeader>
                        <Table.ColumnHeader textAlign="end">Users</Table.ColumnHeader>
                        <Table.ColumnHeader textAlign="end">Percentage</Table.ColumnHeader>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {stats.usersByZone
                        .sort((a, b) => b.count - a.count)
                        .map((item) => {
                          const usersWithZone = stats.totalUsers - stats.usersWithoutZone
                          const percentage = usersWithZone > 0
                            ? Math.round((item.count / usersWithZone) * 100)
                            : 0

                          return (
                            <Table.Row key={item.zone}>
                              <Table.Cell>
                                <Badge colorScheme="green" fontSize="md">
                                  {item.zone}
                                </Badge>
                              </Table.Cell>
                              <Table.Cell textAlign="end" fontWeight="medium">
                                {item.count}
                              </Table.Cell>
                              <Table.Cell textAlign="end">
                                <Text color="gray.600">{percentage}%</Text>
                              </Table.Cell>
                            </Table.Row>
                          )
                        })}
                    </Table.Body>
                  </Table.Root>
                </Box>
              )}
            </VStack>
          </Card.Body>
        </Card.Root>

        {/* Growth Insights */}
        <Card.Root>
          <Card.Body>
            <VStack align="stretch" gap={3}>
              <Heading size="md">Growth Insights</Heading>

              <Box p={3} bg="blue.50" borderRadius="md" borderLeft="4px" borderColor="blue.500">
                <Text fontSize="sm" fontWeight="medium" color="blue.900">
                  User Growth Rate
                </Text>
                <Text fontSize="sm" color="blue.700" mt={1}>
                  {stats.recentSignups.last7Days > 0
                    ? `${(stats.recentSignups.last7Days / 7).toFixed(1)} users/day average (last 7 days)`
                    : "No signups in the last 7 days"
                  }
                </Text>
              </Box>

              <Box p={3} bg="green.50" borderRadius="md" borderLeft="4px" borderColor="green.500">
                <Text fontSize="sm" fontWeight="medium" color="green.900">
                  Zone Completion Rate
                </Text>
                <Text fontSize="sm" color="green.700" mt={1}>
                  {stats.totalUsers > 0
                    ? `${Math.round(((stats.totalUsers - stats.usersWithoutZone) / stats.totalUsers) * 100)}% of users have set their growing zone`
                    : "No users yet"
                  }
                </Text>
              </Box>

              {stats.usersByZone.length > 0 && (
                <Box p={3} bg="purple.50" borderRadius="md" borderLeft="4px" borderColor="purple.500">
                  <Text fontSize="sm" fontWeight="medium" color="purple.900">
                    Most Popular Zone
                  </Text>
                  <Text fontSize="sm" color="purple.700" mt={1}>
                    Zone {stats.usersByZone[0].zone} with {stats.usersByZone[0].count} users
                  </Text>
                </Box>
              )}
            </VStack>
          </Card.Body>
        </Card.Root>
      </VStack>
    </Box>
  )
}
