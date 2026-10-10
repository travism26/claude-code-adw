/**
 * NotificationBell Component
 *
 * Displays a notification bell icon in the header with an unread count badge.
 * When clicked, opens a popover showing the list of notifications.
 * Integrates with the useNotifications hook for real-time updates via WebSocket.
 *
 * Features:
 * - Bell icon with unread count badge
 * - Popover dropdown with notification list
 * - Mark as read, delete, and navigate to links
 * - Real-time WebSocket updates
 * - Authentication-aware
 *
 * @example
 * ```tsx
 * import { NotificationBell } from './NotificationBell';
 *
 * function Header() {
 *   return (
 *     <header>
 *       <h1>My App</h1>
 *       <NotificationBell />
 *     </header>
 *   );
 * }
 * ```
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  PopoverHeader,
  Button,
  Badge,
  Box,
  Text,
  Flex,
  Spinner,
  VStack,
  useDisclosure,
} from '@chakra-ui/react';
import { Bell, BellDot } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { useAuth } from '../hooks/useAuth';
import { NotificationDisplay } from '../components/NotificationDisplay';

/**
 * NotificationBell Component
 */
export function NotificationBell() {
  const navigate = useNavigate();
  const { open, onOpen, onClose } = useDisclosure();

  // Get authentication state and token
  const { isAuthenticated, token } = useAuth();

  // Get notification state from hook
  const {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    removeNotification,
  } = useNotifications({
    token: token || undefined,
    autoFetch: true,
  });

  /**
   * Handle marking a notification as read
   */
  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markAsRead(notificationId);
    } catch {
      // Error handled by hook
    }
  };

  /**
   * Handle deleting a notification
   */
  const handleDelete = async (notificationId: string) => {
    try {
      await removeNotification(notificationId);
    } catch {
      // Error handled by hook
    }
  };

  /**
   * Handle navigating to a notification link
   */
  const handleNavigate = async (link: string, notificationId: string, isRead: boolean) => {
    // Mark as read if unread
    if (!isRead) {
      await handleMarkAsRead(notificationId);
    }

    // Close popover
    onClose();

    // Navigate to link
    navigate(link);
  };

  /**
   * Handle marking all notifications as read
   */
  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
    } catch {
      // Error handled by hook
    }
  };

  // Don't render if not authenticated
  if (!isAuthenticated || !token) {
    return null;
  }

  // Format unread count for badge display
  const formatUnreadCount = (count: number): string => {
    if (count === 0) return '0';
    if (count > 99) return '99+';
    if (count > 9) return '10+';
    return count.toString();
  };

  return (
    <PopoverRoot open={open} onOpenChange={(e) => e.open ? onOpen() : onClose()}>
      <PopoverTrigger>
        <Box
          position="relative"
          color="white"
          bg="transparent"
          border="none"
          cursor="pointer"
          p={2}
          borderRadius="md"
          transition="background 0.2s"
          _hover={{ bg: 'green.700' }}
          aria-label="Notifications"
          title="Notifications"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              open ? onClose() : onOpen();
            }
          }}
        >
          {unreadCount > 0 ? (
            <BellDot style={{ height: '24px', width: '24px' }} />
          ) : (
            <Bell style={{ height: '24px', width: '24px' }} />
          )}
          {unreadCount > 0 && (
            <Badge
              position="absolute"
              top="0"
              right="0"
              borderRadius="full"
              bg="red.500"
              color="white"
              fontSize="xs"
              px={unreadCount > 9 ? 1.5 : 2}
              py={0.5}
              minW="20px"
              textAlign="center"
              aria-label={`${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`}
            >
              {formatUnreadCount(unreadCount)}
            </Badge>
          )}
        </Box>
      </PopoverTrigger>

      <PopoverContent
        position="absolute"
        top="100%"
        right={0}
        width="400px"
        maxW="95vw"
        shadow="2xl"
        borderColor="gray.200"
        borderRadius="lg"
        bg="white"
        zIndex={1500}
        mt={2}
      >
        <PopoverHeader borderBottomWidth="1px" bg="white" py={3} px={4}>
          <Flex justify="space-between" align="center">
            <Text fontWeight="bold" fontSize="lg" color="gray.800">
              Notifications
            </Text>
            {notifications.length > 0 && unreadCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                colorScheme="green"
                onClick={handleMarkAllAsRead}
                fontSize="sm"
                fontWeight="normal"
                color="green.600"
                _hover={{ bg: 'green.50' }}
              >
                Mark all as read
              </Button>
            )}
          </Flex>
        </PopoverHeader>

        <PopoverBody p={0} maxH="400px" overflowY="auto">
          {loading && notifications.length === 0 ? (
            <Flex justify="center" align="center" py={8}>
              <Spinner size="lg" color="green.600" />
            </Flex>
          ) : error ? (
            <Box p={4} textAlign="center">
              <Text color="red.500" mb={2}>
                Failed to load notifications
              </Text>
              <Text fontSize="sm" color="gray.600">
                {error}
              </Text>
            </Box>
          ) : notifications.length === 0 ? (
            <Box p={8} textAlign="center">
              <Text color="gray.500" fontSize="sm">
                No notifications
              </Text>
            </Box>
          ) : (
            <VStack gap={0} align="stretch">
              {notifications.map((notification) => (
                <Box
                  key={notification.id}
                  p={4}
                  cursor={notification.link ? 'pointer' : 'default'}
                  bg={!notification.read ? 'green.50' : 'white'}
                  _hover={notification.link ? { bg: 'gray.100' } : {}}
                  transition="all 0.2s ease-in-out"
                  borderBottom="1px"
                  borderColor="gray.100"
                  _last={{ borderBottom: 'none' }}
                  onClick={() => {
                    if (notification.link) {
                      handleNavigate(notification.link, notification.id, notification.read);
                    }
                  }}
                >
                  <Flex justify="space-between" align="flex-start" gap={3}>
                    <Flex flex={1} align="flex-start" gap={3}>
                      {!notification.read && (
                        <Box
                          w="10px"
                          h="10px"
                          borderRadius="full"
                          bg="green.600"
                          flexShrink={0}
                          mt={1}
                          aria-label="Unread"
                        />
                      )}
                      <Box flex={1}>
                        <Text
                          fontSize="sm"
                          fontWeight={!notification.read ? 'semibold' : 'normal'}
                          color="gray.800"
                          mb={1}
                          lineHeight="1.4"
                        >
                          {notification.message}
                        </Text>
                        <Flex align="center" gap={2} fontSize="xs" color="gray.600">
                          <Text>{formatTimestamp(notification.createdAt)}</Text>
                          {notification.type && (
                            <Badge
                              colorScheme={getTypeColorScheme(notification.type)}
                              fontSize="xs"
                              px={2}
                              py={0.5}
                              borderRadius="md"
                            >
                              {notification.type}
                            </Badge>
                          )}
                        </Flex>
                      </Box>
                    </Flex>
                    <Button
                      size="xs"
                      variant="ghost"
                      colorScheme="red"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(notification.id);
                      }}
                      aria-label="Delete notification"
                      title="Delete"
                      minW="auto"
                      px={2}
                      fontSize="lg"
                      fontWeight="normal"
                      color="gray.400"
                      _hover={{ color: 'red.500', bg: 'red.50' }}
                    >
                      ×
                    </Button>
                  </Flex>
                </Box>
              ))}
            </VStack>
          )}
        </PopoverBody>
      </PopoverContent>
    </PopoverRoot>
  );
}

/**
 * Format timestamp to human-readable format
 */
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

/**
 * Get Chakra UI color scheme for notification type
 */
function getTypeColorScheme(type: string): string {
  switch (type) {
    case 'success':
      return 'green';
    case 'warning':
      return 'yellow';
    case 'error':
      return 'red';
    case 'info':
    default:
      return 'blue';
  }
}
