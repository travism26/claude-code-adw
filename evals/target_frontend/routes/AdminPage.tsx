"use client"

import React from "react"
import {
  Box,
  Tabs,
  Heading,
  Text,
  VStack,
} from "@chakra-ui/react"
import { Users, Bell, BarChart3 } from "lucide-react"
import { AdminLayout } from "../components/AdminLayout"
import { UserManagement } from "../components/admin/UserManagement"
import { NotificationTester } from "../components/admin/NotificationTester"
import { UserStats } from "../components/admin/UserStats"

export const AdminPage: React.FC = () => {
  return (
    <AdminLayout>
      <VStack align="stretch" gap={6}>
        {/* Page Header */}
        <Box>
          <Heading as="h2" size="xl" mb={2}>
            Admin Panel
          </Heading>
          <Text color="gray.600">
            Manage users, test notifications, and view system statistics
          </Text>
        </Box>

        {/* Tabs */}
        <Tabs.Root colorPalette="purple" size="md" defaultValue="users">
          <Tabs.List>
            <Tabs.Trigger value="users">
              <Users style={{ height: '16px', width: '16px', marginRight: '8px' }} />
              Users
            </Tabs.Trigger>
            <Tabs.Trigger value="notifications">
              <Bell style={{ height: '16px', width: '16px', marginRight: '8px' }} />
              Notifications
            </Tabs.Trigger>
            <Tabs.Trigger value="statistics">
              <BarChart3 style={{ height: '16px', width: '16px', marginRight: '8px' }} />
              Statistics
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="users" px={0} pt={6}>
            <UserManagement />
          </Tabs.Content>

          <Tabs.Content value="notifications" px={0} pt={6}>
            <NotificationTester />
          </Tabs.Content>

          <Tabs.Content value="statistics" px={0} pt={6}>
            <UserStats />
          </Tabs.Content>
        </Tabs.Root>
      </VStack>
    </AdminLayout>
  )
}
