"use client"

import type React from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { Leaf, Home, Grid3x3, Calendar, BookOpen, User, Database } from "lucide-react"
import { Box, Flex, Heading, Button } from "@chakra-ui/react"
import { NotificationBell } from "./NotificationBell"
import { Footer } from "./Footer"

interface LayoutProps {
  children: React.ReactNode
}

// 7 nav destinations — keep all; open judgment call at Phase 1 gate:
// 7 items at 390px is tight. Propose "More" overflow group at the gate before removing any route.
const navItems = [
  { id: "dashboard", path: "/dashboard", icon: Home, label: "Home" },
  { id: "plants", path: "/plants", icon: Leaf, label: "Plants" },
  { id: "garden-planner", path: "/garden-planner", icon: Grid3x3, label: "Garden" },
  { id: "schedule", path: "/schedule", icon: Calendar, label: "Schedule" },
  { id: "plant-database", path: "/plant-database", icon: Database, label: "Database" },
  { id: "journal", path: "/journal", icon: BookOpen, label: "Journal" },
  { id: "profile", path: "/profile", icon: User, label: "Profile" },
]

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate()
  const location = useLocation()

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/")

  return (
    <Flex minH="100vh" bg="bg" direction="column">
      {/* Header — clean surface, accent used sparingly (logo icon only) */}
      <Box
        as="header"
        bg="surface"
        borderBottom="1px solid"
        borderColor="border"
        px={4}
        py={3}
        position="sticky"
        top={0}
        zIndex={100}
        boxShadow="xs"
      >
        <Flex align="center" justify="space-between" gap={2}>
          <Flex align="center" gap={2}>
            <Box color="accent">
              <Leaf style={{ height: '22px', width: '22px' }} />
            </Box>
            <Heading as="h1" size="md" fontWeight="semibold" color="text">
              Grow Buddy
            </Heading>
          </Flex>
          <Box position="relative">
            <NotificationBell />
          </Box>
        </Flex>
      </Box>

      {/* Main Content — pb accounts for fixed bottom nav + safe-area */}
      <Box as="main" flex={1} p={4} pb="calc(72px + env(safe-area-inset-bottom))">
        {children}
      </Box>

      {/* Footer — desktop only */}
      <Box display={{ base: "none", lg: "block" }}>
        <Footer />
      </Box>

      {/* Bottom Navigation */}
      <Box
        as="nav"
        data-testid="bottom-nav"
        position="fixed"
        bottom={0}
        left={0}
        right={0}
        bg="surface"
        borderTop="1px solid"
        borderColor="border"
        boxShadow="md"
        px={1}
        pt={1}
        pb="calc(8px + env(safe-area-inset-bottom))"
        zIndex={100}
      >
        <Flex justify="space-around" align="stretch">
          {navItems.map(({ id, path, icon: Icon, label }) => {
            const active = isActive(path)
            return (
              <Button
                key={id}
                data-testid={`nav-${id}`}
                aria-current={active ? "page" : undefined}
                onClick={() => navigate(path)}
                variant="ghost"
                flexDirection="column"
                gap={0.5}
                p={2}
                h="auto"
                minW={0}
                flex={1}
                borderRadius="lg"
                color={active ? "accent" : "textMuted"}
                bg={active ? "accentSubtle" : "transparent"}
                _hover={{ color: "accent", bg: "accentSubtle" }}
                transition="all 0.15s"
              >
                <Icon style={{ height: '18px', width: '18px', flexShrink: 0 }} />
                <Box
                  as="span"
                  fontSize="xs"
                  fontWeight={active ? "semibold" : "medium"}
                  lineHeight="1"
                  whiteSpace="nowrap"
                  overflow="hidden"
                  textOverflow="ellipsis"
                  maxW="full"
                >
                  {label}
                </Box>
              </Button>
            )
          })}
        </Flex>
      </Box>
    </Flex>
  )
}
