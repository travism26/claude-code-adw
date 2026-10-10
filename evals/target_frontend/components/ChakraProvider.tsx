"use client"

import { ChakraProvider as BaseChakraProvider, createToaster, Toaster, Box, Button, Flex, Stack, Text } from '@chakra-ui/react'
import system from '../theme'

// Create toaster instance for Chakra UI v3
export const toaster = createToaster({
  placement: 'bottom-end',
  duration: 5000,
})

const TOAST_ACCENT: Record<string, string> = {
  success: 'green.500',
  error: 'red.500',
  warning: 'orange.400',
  info: 'blue.500',
}

export function ChakraProvider({ children }: { children: React.ReactNode }) {
  return (
    <BaseChakraProvider value={system}>
      {children}
      <Toaster toaster={toaster}>
        {(toast) => (
          <Box
            bg="white"
            color="gray.800"
            borderWidth="1px"
            borderColor="gray.200"
            borderLeftWidth="4px"
            borderLeftColor={TOAST_ACCENT[toast.type ?? 'info'] ?? 'gray.400'}
            rounded="md"
            shadow="md"
            px={4}
            py={3}
            minW="280px"
            maxW="420px"
          >
            <Flex align="center" gap={3} justify="space-between">
              <Stack gap={0.5}>
                {toast.title && (
                  <Text fontWeight="semibold" fontSize="sm">
                    {toast.title}
                  </Text>
                )}
                {toast.description && (
                  <Text fontSize="sm" color="gray.600">
                    {toast.description}
                  </Text>
                )}
              </Stack>
              {toast.action && (
                <Button
                  size="xs"
                  variant="outline"
                  colorPalette="green"
                  flexShrink={0}
                  onClick={() => {
                    toast.action?.onClick?.()
                    toaster.dismiss(toast.id)
                  }}
                >
                  {toast.action.label}
                </Button>
              )}
            </Flex>
          </Box>
        )}
      </Toaster>
    </BaseChakraProvider>
  )
}
