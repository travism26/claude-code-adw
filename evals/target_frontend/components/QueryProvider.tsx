"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  // Ensure QueryClient is not recreated on every render
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Data is considered fresh for 5 minutes
        staleTime: 5 * 60 * 1000,
        // Cache data for 10 minutes
        gcTime: 10 * 60 * 1000,
        // Don't refetch on mount if data is still fresh
        refetchOnMount: false,
        // Don't refetch when window regains focus
        refetchOnWindowFocus: false,
        // Disable retries in development for faster debugging
        retry: process.env.NODE_ENV === 'development' ? false : 3,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
