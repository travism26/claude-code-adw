"use client";

import type React from "react";
import NextLink from "next/link";
import {
  Box,
  VStack,
  Heading,
  Text,
  Spinner,
  Button,
  Skeleton,
  Grid,
} from "@chakra-ui/react";
import { ArrowLeft, AlertCircle } from "lucide-react";

interface PageStateContainerProps {
  /** Whether the page is in loading state */
  isLoading: boolean;
  /** Error object if an error occurred */
  error: Error | null;
  /** Whether the data is empty/not found */
  isEmpty?: boolean;
  /** Title to display in error state */
  errorTitle?: string;
  /** Title to display in empty/not found state */
  emptyTitle?: string;
  /** Message to display in empty state */
  emptyMessage?: string;
  /** Link to navigate back to */
  backLink?: string;
  /** Text for the back button */
  backLinkText?: string;
  /** Children to render when not in loading/error/empty state */
  children: React.ReactNode;
  /** Additional content to render above loading skeleton */
  loadingHeader?: React.ReactNode;
  /** Custom loading skeleton variant */
  loadingVariant?: "default" | "detail" | "form";
  /** Container max width */
  maxW?: string;
  /** Container data-testid */
  testId?: string;
}

/**
 * PageStateContainer Component
 *
 * Provides consistent loading, error, and empty state handling across pages.
 * Reduces JSX nesting by encapsulating common state patterns.
 */
export const PageStateContainer: React.FC<PageStateContainerProps> = ({
  isLoading,
  error,
  isEmpty = false,
  errorTitle = "Error loading data",
  emptyTitle = "Not found",
  emptyMessage = "The item you're looking for doesn't exist or you don't have access to it.",
  backLink = "/grows",
  backLinkText = "Back to Grows",
  children,
  loadingHeader,
  loadingVariant = "default",
  maxW = "1400px",
  testId,
}) => {
  // Loading state
  if (isLoading) {
    return (
      <Box
        maxW={maxW}
        mx="auto"
        px={{ base: 4, md: 6, lg: 8 }}
        py={8}
        data-testid={testId}
      >
        <VStack gap={6} align="stretch">
          {loadingHeader}
          <LoadingSkeleton variant={loadingVariant} />
        </VStack>
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box
        maxW={maxW}
        mx="auto"
        px={{ base: 4, md: 6, lg: 8 }}
        py={8}
        data-testid={testId}
      >
        <VStack gap={6} align="center" py={12}>
          <Box
            p={8}
            borderWidth="1px"
            borderRadius="md"
            borderColor="red.200"
            bg="red.50"
            maxW="500px"
            textAlign="center"
          >
            <AlertCircle
              size={48}
              color="var(--chakra-colors-red-500)"
              style={{ margin: "0 auto 16px" }}
            />
            <Heading size="lg" color="red.700" mb={4}>
              {errorTitle}
            </Heading>
            <Text color="red.600" mb={6}>
              {error.message}
            </Text>
            <Button asChild colorPalette="red" variant="outline">
              <NextLink href={backLink}>
                <ArrowLeft size={16} />
                {backLinkText}
              </NextLink>
            </Button>
          </Box>
        </VStack>
      </Box>
    );
  }

  // Empty/Not found state
  if (isEmpty) {
    return (
      <Box
        maxW={maxW}
        mx="auto"
        px={{ base: 4, md: 6, lg: 8 }}
        py={8}
        data-testid={testId}
      >
        <VStack gap={6} align="center" py={12}>
          <Box
            p={8}
            borderWidth="1px"
            borderRadius="md"
            borderColor="gray.200"
            maxW="500px"
            textAlign="center"
          >
            <Heading size="lg" color="gray.700" mb={4}>
              {emptyTitle}
            </Heading>
            <Text color="gray.600" mb={6}>
              {emptyMessage}
            </Text>
            <Button asChild colorPalette="gray" variant="outline">
              <NextLink href={backLink}>
                <ArrowLeft size={16} />
                {backLinkText}
              </NextLink>
            </Button>
          </Box>
        </VStack>
      </Box>
    );
  }

  // Normal content
  return (
    <Box
      maxW={maxW}
      mx="auto"
      px={{ base: 4, md: 6, lg: 8 }}
      py={8}
      data-testid={testId}
    >
      {children}
    </Box>
  );
};

interface LoadingSkeletonProps {
  variant: "default" | "detail" | "form";
}

const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ variant }) => {
  if (variant === "detail") {
    return (
      <>
        <Skeleton height="20px" width="200px" />
        <Box>
          <Skeleton height="40px" width="300px" mb={4} />
          <Grid
            templateColumns={{
              base: "1fr",
              md: "repeat(2, 1fr)",
              lg: "repeat(4, 1fr)",
            }}
            gap={4}
          >
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} height="80px" />
            ))}
          </Grid>
        </Box>
        <Skeleton height="40px" width="100%" />
        <VStack gap={4} align="stretch">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height="150px" />
          ))}
        </VStack>
      </>
    );
  }

  if (variant === "form") {
    return (
      <Box textAlign="center" py={12}>
        <Spinner size="xl" mb={4} />
        <Text>Loading...</Text>
      </Box>
    );
  }

  // Default skeleton
  return (
    <Box textAlign="center" py={12}>
      <Spinner size="xl" mb={4} />
      <Text>Loading...</Text>
    </Box>
  );
};

export default PageStateContainer;
