"use client";

import React from 'react';
import { Box, Container, Heading, Text, Button, VStack, HStack } from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { EnvironmentDashboard } from '@/components/environments/EnvironmentDashboard';

export default function EnvironmentsPage() {
  const router = useRouter();

  return (
    <Container maxW="container.xl" py={8}>
      <VStack align="stretch" gap={6}>
        {/* Page Header */}
        <Box>
          <HStack justify="space-between" align="start" mb={2}>
            <VStack align="start" gap={1}>
              <Heading as="h1" size="xl" color="gray.800">
                Environment Overview
              </Heading>
              <Text color="gray.600" fontSize="lg">
                Monitor capacity, track active grows, and manage your growing spaces
              </Text>
            </VStack>
            <Button
              colorScheme="green"
              onClick={() => router.push('/grows')}
            >
              <Plus size={18} />
              Add Environment
            </Button>
          </HStack>
        </Box>

        {/* Dashboard */}
        <EnvironmentDashboard />
      </VStack>
    </Container>
  );
}
