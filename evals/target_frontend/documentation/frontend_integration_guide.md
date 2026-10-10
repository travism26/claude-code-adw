# GrowBuddy v2 - Frontend Integration Guide

## Table of Contents
- [Overview](#overview)
- [Architecture](#architecture)
- [Existing API Clients & Hooks](#existing-api-clients--hooks)
- [Authentication Flow](#authentication-flow)
- [How to Add a New Feature](#how-to-add-a-new-feature)
- [Best Practices](#best-practices)
- [Examples](#examples)

---

## Overview

The GrowBuddy v2 frontend is built with modern React patterns and tools:

- **Framework**: Next.js 15 (App Router)
- **UI Library**: Chakra UI v3 + Radix UI
- **State Management**: TanStack Query (React Query) for server state
- **Language**: TypeScript
- **Styling**: Tailwind CSS + Chakra UI
- **HTTP Client**: Custom ApiClient singleton with automatic token refresh

### Key Principles

1. **Server State with TanStack Query**: All server data managed via React Query
2. **Type Safety**: Full TypeScript coverage for API contracts
3. **Automatic Auth**: Token management and refresh handled automatically
4. **Separation of Concerns**: API logic → Hooks → Components
5. **Optimistic Updates**: Instant UI feedback with background sync

---

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                    Component Layer                      │
│  (PlantsList.tsx, Dashboard.tsx, etc.)                 │
└─────────────────┬───────────────────────────────────────┘
                  │
                  │ Consumes hooks
                  ▼
┌─────────────────────────────────────────────────────────┐
│                    Hooks Layer                          │
│  (usePlants, useAuth, useZone, etc.)                   │
│  - TanStack Query (useQuery, useMutation)              │
│  - Cache management                                     │
│  - Optimistic updates                                   │
└─────────────────┬───────────────────────────────────────┘
                  │
                  │ Calls API functions
                  ▼
┌─────────────────────────────────────────────────────────┐
│                    API Client Layer                     │
│  (plantApi.ts, authApi.ts, etc.)                       │
│  - Pure functions for API calls                        │
│  - Request/Response type mapping                       │
└─────────────────┬───────────────────────────────────────┘
                  │
                  │ Uses ApiClient singleton
                  ▼
┌─────────────────────────────────────────────────────────┐
│                    ApiClient (utils/api.ts)             │
│  - HTTP request wrapper                                 │
│  - Automatic token injection                           │
│  - Automatic token refresh on 401                      │
│  - Error handling                                       │
└─────────────────┬───────────────────────────────────────┘
                  │
                  │ HTTP requests
                  ▼
┌─────────────────────────────────────────────────────────┐
│                    Backend API                          │
│  (Express.js endpoints)                                 │
└─────────────────────────────────────────────────────────┘
```

### Directory Structure

```
frontend/
├── api/                    # API client functions
│   ├── authApi.ts          # Authentication endpoints
│   ├── plantApi.ts         # Plant CRUD operations
│   ├── plantProfileApi.ts  # Plant database browsing
│   ├── zoneApi.ts          # Hardiness zone detection
│   ├── careHistoryApi.ts   # Care action logging
│   ├── journalApi.ts       # Journal entries
│   ├── seasonalTipsApi.ts  # Seasonal tips
│   └── dashboardApi.ts     # Dashboard data
│
├── hooks/                  # React Query hooks
│   ├── useAuth.ts          # Authentication state
│   ├── usePlants.ts        # Plant data & mutations
│   ├── usePlantProfiles.ts # Plant database queries
│   ├── useZone.ts          # Zone detection & updates
│   ├── useCareHistory.ts   # Care history tracking
│   ├── useJournal.ts       # Journal management
│   └── useSeasonalTips.ts  # Seasonal tips
│
├── components/             # React components
│   ├── PlantsList.tsx      # Plant grid/list view
│   ├── AddPlantForm.tsx    # Plant creation form
│   ├── Dashboard.tsx       # Main dashboard
│   ├── ZoneSelector.tsx    # Zone detection UI
│   ├── CareHistoryLog.tsx  # Care history display
│   ├── SeasonalTips.tsx    # Tips display
│   └── ...
│
├── routes/                 # Page components
│   ├── DashboardPage.tsx
│   ├── PlantsPage.tsx
│   ├── AddPlantPage.tsx
│   ├── LoginPage.tsx
│   └── ...
│
├── types/                  # TypeScript types
│   └── index.ts            # All type definitions
│
├── utils/                  # Utilities
│   └── api.ts              # ApiClient singleton
│
└── app/                    # Next.js App Router
    ├── layout.tsx          # Root layout with providers
    ├── globals.css         # Global styles
    └── [[...slug]]/
        └── page.tsx        # Catch-all route handler
```

---

## Existing API Clients & Hooks

### 1. Authentication

**API Client**: `api/authApi.ts`
**Hook**: `hooks/useAuth.ts`

```typescript
const {
  user,              // Current user object
  isAuthenticated,   // Boolean auth status
  isLoading,         // Auth operation in progress
  isInitializing,    // Initial auth check
  error,             // Auth error message
  signup,            // Signup function
  login,             // Login function
  logout,            // Logout function
  clearError         // Clear error state
} = useAuth();

// Usage
await login(email, password);
await signup(email, password, timezone);
logout();
```

**Features**:
- JWT token management (access + refresh)
- Automatic token refresh on mount
- Token stored in cookies OR localStorage
- User state decoded from JWT

---

### 2. Plants

**API Client**: `api/plantApi.ts`
**Hook**: `hooks/usePlants.ts`

```typescript
const {
  plants,          // Plant[] | undefined
  isLoading,       // Initial load
  isPending,       // Any pending operation
  error,           // Error object
  fetchPlants,     // Refetch function
  createPlant,     // Create mutation
  updatePlant,     // Update mutation
  deletePlant,     // Delete mutation
  getPlant,        // Get single plant
  createStatus,    // Create mutation status
  updateStatus,    // Update mutation status
  deleteStatus     // Delete mutation status
} = usePlants();

// Usage
await createPlant({ name, type, water_interval_days, ... });
await updatePlant({ id, name, ... });
await deletePlant(plantId);
```

**TanStack Query Features**:
- Automatic caching with `queryKey: ["plants"]`
- Automatic refetch on window focus
- Optimistic updates via `onSuccess` invalidation
- Background refetching

---

### 3. Plant Profiles (Database)

**API Client**: `api/plantProfileApi.ts`
**Hook**: `hooks/usePlantProfiles.ts`

```typescript
const {
  plantProfiles,   // PlantProfile[]
  total,           // Total count
  page,            // Current page
  limit,           // Items per page
  isLoading,
  error,
  searchPlants,    // Search function
  getProfile,      // Get single profile with tips
} = usePlantProfiles(filters);

// Usage with filters
const { plantProfiles } = usePlantProfiles({
  type: 'outdoor',
  difficulty: 'beginner',
  zone: 7,
  search: 'tomato',
  page: 1,
  limit: 20
});
```

**Features**:
- Public API (no auth required)
- Pagination support
- Filter by type, difficulty, zone
- Search by name/species
- Returns seasonal tips with profile details

---

### 4. Hardiness Zones

**API Client**: `api/zoneApi.ts`
**Hooks**: `hooks/useZone.ts`

```typescript
// Get user's current zone
const { data: userZone, isLoading } = useUserZone();

// Detect zone from postal code
const { mutate: detectZone, isPending } = useDetectZone();
detectZone(postalCode, {
  onSuccess: (result) => {
    console.log(result.zone); // Detected zone
  }
});

// Update user's zone
const { mutate: updateZone } = useUpdateZone();
updateZone({
  zone: 7,
  postalCode: '12345',
  override: false
});
```

**Features**:
- Automatic zone detection for US/Canada
- Manual zone override
- Invalidates related queries (seasonal tips, etc.)
- 5-minute cache for zone data

---

### 5. Care History

**API Client**: `api/careHistoryApi.ts`
**Hook**: `hooks/useCareHistory.ts`

```typescript
const {
  careHistory,     // CareHistoryEntry[]
  isLoading,
  error,
  logAction,       // Log new care action
  deleteEntry      // Delete care entry
} = useCareHistory(plantId, filters);

// Usage
await logAction(
  plantId,
  'watered',      // 'watered' | 'fertilized' | 'pruned' | 'repotted' | 'other'
  'Added fertilizer mix',
  new Date()
);
```

**Query Filters**:
- `plantId`: Filter by specific plant
- `actionType`: Filter by care action type
- `startDate`: Filter by date range start
- `endDate`: Filter by date range end
- `limit`: Limit number of results

---

### 6. Journal Entries

**API Client**: `api/journalApi.ts`
**Hook**: `hooks/useJournal.ts`

```typescript
const {
  entries,         // JournalEntry[]
  isLoading,
  error,
  createEntry,     // Create journal entry
  updateEntry,     // Update entry
  deleteEntry      // Delete entry
} = useJournal(plantId);

// Usage
await createEntry({
  plant_id: plantId,
  note: 'First tomatoes appearing!',
  photo_url: 'https://...'
});
```

---

### 7. Seasonal Tips

**API Client**: `api/seasonalTipsApi.ts`
**Hook**: `hooks/useSeasonalTips.ts`

```typescript
const {
  tips,            // SeasonalTip[]
  zone,            // User's zone
  season,          // Current season
  isLoading,
  error
} = useSeasonalTips();
```

**Features**:
- Automatically fetches based on user's zone
- Filtered by current season
- Categorized tips (general, planting, maintenance, harvesting)
- Priority-based sorting

---

### 8. Dashboard

**API Client**: `api/dashboardApi.ts`
**Hook**: `hooks/useDashboard.ts`

```typescript
const {
  tasks,           // DashboardTask[] - upcoming care tasks
  recentActivity,  // Recent care actions
  stats,           // Plant statistics
  isLoading,
  error
} = useDashboard();
```

---

## Authentication Flow

### ApiClient Singleton

**File**: `frontend/utils/api.ts`

The `ApiClient` is a singleton that manages all HTTP requests:

```typescript
class ApiClient {
  // Singleton instance
  private static instance: ApiClient;

  // Token storage
  private accessToken: string | null;
  private refreshToken: string | null;

  // Storage method (cookies or localStorage)
  private useCookies: boolean = true;

  // Track token changes
  private tokenVersion: number = 0;
}
```

### Key Methods

#### 1. `request<T>(endpoint, options)` - Main HTTP method

```typescript
const data = await apiClient.request<ResponseType>('/plants', {
  method: 'POST',
  body: JSON.stringify(payload)
});
```

**Automatic Features**:
- Injects `Authorization: Bearer <token>` header
- Automatically refreshes token on 401 response
- Retries request with new token after refresh
- Throws error object on failure

#### 2. Token Management

```typescript
// Set tokens after login/signup
apiClient.setTokens(accessToken, refreshToken);

// Clear tokens on logout
apiClient.clearTokens();

// Check auth status
const isAuthed = apiClient.isAuthenticated();

// Get current token
const token = apiClient.getAccessToken();
```

#### 3. Automatic Token Refresh

When a request receives a 401:
1. ApiClient checks if refresh token exists
2. Calls `/auth/refresh` endpoint
3. If successful, updates tokens and retries original request
4. If refresh fails, clears tokens (user must re-login)

### Storage Options

```typescript
// Toggle between cookies and localStorage
apiClient.setStorageMethod(true);  // Use cookies (default)
apiClient.setStorageMethod(false); // Use localStorage
```

**Cookies** (default):
- Access token: 15 minutes
- Refresh token: 7 days
- Secure in production (HTTPS only)
- SameSite: strict

---

## How to Add a New Feature

Follow these steps to add a new feature that integrates with a backend endpoint.

### Step 1: Define TypeScript Types

Add types to `frontend/types/index.ts`:

```typescript
// Entity type
export interface MyFeature {
  id: string;
  name: string;
  description?: string;
  user_id: string;
  createdAt: string;
  updatedAt: string;
}

// Request types
export interface CreateMyFeatureRequest {
  name: string;
  description?: string;
}

export interface UpdateMyFeatureRequest {
  name?: string;
  description?: string;
}

// Response types
export interface MyFeatureResponse {
  data: MyFeature[];
  total: number;
}
```

### Step 2: Create API Client

Create `frontend/api/myFeatureApi.ts`:

```typescript
import { ApiClient } from "../utils/api";
import type {
  MyFeature,
  CreateMyFeatureRequest,
  UpdateMyFeatureRequest,
  MyFeatureResponse
} from "../types";

const apiClient = ApiClient.getInstance();

// Fetch all items
export const fetchMyFeatures = async (): Promise<MyFeature[]> => {
  const response = await apiClient.request<MyFeatureResponse>("/my-features");
  return response.data;
};

// Get single item
export const getMyFeature = async (id: string): Promise<MyFeature> => {
  const response = await apiClient.request<{ data: MyFeature }>(
    `/my-features/${id}`
  );
  return response.data;
};

// Create item
export const createMyFeature = async (
  payload: CreateMyFeatureRequest
): Promise<MyFeature> => {
  const response = await apiClient.request<{ data: MyFeature }>(
    "/my-features",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
  return response.data;
};

// Update item
export const updateMyFeature = async (
  id: string,
  payload: UpdateMyFeatureRequest
): Promise<MyFeature> => {
  const response = await apiClient.request<{ data: MyFeature }>(
    `/my-features/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    }
  );
  return response.data;
};

// Delete item
export const deleteMyFeature = async (id: string): Promise<void> => {
  await apiClient.request(`/my-features/${id}`, {
    method: "DELETE",
  });
};
```

### Step 3: Create TanStack Query Hook

Create `frontend/hooks/useMyFeature.ts`:

```typescript
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchMyFeatures,
  getMyFeature,
  createMyFeature,
  updateMyFeature,
  deleteMyFeature,
} from "../api/myFeatureApi";
import type {
  MyFeature,
  CreateMyFeatureRequest,
  UpdateMyFeatureRequest,
} from "../types";

export const useMyFeatures = () => {
  const queryClient = useQueryClient();

  // Query for fetching all items
  const { data, error, isLoading, isPending, refetch } = useQuery<
    MyFeature[],
    Error
  >({
    queryKey: ["myFeatures"],
    queryFn: fetchMyFeatures,
    // Optional: Configure caching
    staleTime: 30000, // 30 seconds
  });

  // Mutation for creating
  const createMutation = useMutation({
    mutationFn: async (payload: CreateMyFeatureRequest) => {
      return await createMyFeature(payload);
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ["myFeatures"] });
    },
  });

  // Mutation for updating
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: { id: string } & UpdateMyFeatureRequest) => {
      return await updateMyFeature(id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myFeatures"] });
    },
  });

  // Mutation for deleting
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteMyFeature(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myFeatures"] });
    },
  });

  return {
    // Data
    items: data,
    error,
    isLoading,
    isPending,

    // Actions
    refetch,
    createItem: createMutation.mutateAsync,
    updateItem: updateMutation.mutateAsync,
    deleteItem: deleteMutation.mutateAsync,
    getItem: getMyFeature,

    // Status
    createStatus: createMutation.status,
    updateStatus: updateMutation.status,
    deleteStatus: deleteMutation.status,
  };
};
```

### Step 4: Create Component

Create `frontend/components/MyFeatureList.tsx`:

```typescript
"use client";

import React from "react";
import {
  Box,
  Button,
  Card,
  Heading,
  SimpleGrid,
  Skeleton,
  Text,
  VStack,
  Alert,
} from "@chakra-ui/react";
import { useMyFeatures } from "../hooks/useMyFeature";
import type { MyFeature } from "../types";

interface MyFeatureListProps {
  onAdd: () => void;
  onEdit: (item: MyFeature) => void;
}

export const MyFeatureList: React.FC<MyFeatureListProps> = ({
  onAdd,
  onEdit
}) => {
  const { items, isLoading, error, deleteItem } = useMyFeatures();

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure?")) {
      try {
        await deleteItem(id);
      } catch (error) {
        console.error("Failed to delete:", error);
      }
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <VStack gap={4} align="stretch">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} height="100px" />
        ))}
      </VStack>
    );
  }

  // Error state
  if (error) {
    return (
      <Alert.Root status="error">
        <Alert.Indicator />
        <Alert.Title>Error: {error.message}</Alert.Title>
      </Alert.Root>
    );
  }

  // Empty state
  if (!items || items.length === 0) {
    return (
      <VStack gap={4} py={12} textAlign="center">
        <Heading size="md">No items yet</Heading>
        <Text color="gray.500">Get started by adding your first item!</Text>
        <Button onClick={onAdd} colorScheme="green">
          Add Item
        </Button>
      </VStack>
    );
  }

  // List view
  return (
    <VStack gap={4} align="stretch">
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Heading size="lg">My Items ({items.length})</Heading>
        <Button onClick={onAdd} colorScheme="green">
          Add Item
        </Button>
      </Box>

      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
        {items.map((item) => (
          <Card.Root key={item.id}>
            <Card.Body>
              <Heading size="sm">{item.name}</Heading>
              {item.description && (
                <Text color="gray.600" mt={2}>
                  {item.description}
                </Text>
              )}
              <Box mt={4} display="flex" gap={2}>
                <Button size="sm" onClick={() => onEdit(item)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  colorScheme="red"
                  variant="outline"
                  onClick={() => handleDelete(item.id)}
                >
                  Delete
                </Button>
              </Box>
            </Card.Body>
          </Card.Root>
        ))}
      </SimpleGrid>
    </VStack>
  );
};
```

### Step 5: Create Form Component

Create `frontend/components/MyFeatureForm.tsx`:

```typescript
"use client";

import React, { useState } from "react";
import {
  Box,
  Button,
  Input,
  Field,
  VStack,
} from "@chakra-ui/react";
import { useMyFeatures } from "../hooks/useMyFeature";
import type { MyFeature } from "../types";

interface MyFeatureFormProps {
  item?: MyFeature;
  onSuccess: () => void;
  onCancel: () => void;
}

export const MyFeatureForm: React.FC<MyFeatureFormProps> = ({
  item,
  onSuccess,
  onCancel,
}) => {
  const [name, setName] = useState(item?.name || "");
  const [description, setDescription] = useState(item?.description || "");
  const { createItem, updateItem, createStatus, updateStatus } = useMyFeatures();

  const isLoading = createStatus === "pending" || updateStatus === "pending";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (item) {
        // Update existing
        await updateItem({ id: item.id, name, description });
      } else {
        // Create new
        await createItem({ name, description });
      }
      onSuccess();
    } catch (error) {
      console.error("Form submission error:", error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <VStack gap={4} align="stretch">
        <Field.Root>
          <Field.Label>Name</Field.Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Field.Root>

        <Field.Root>
          <Field.Label>Description (Optional)</Field.Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field.Root>

        <Box display="flex" gap={2} justifyContent="flex-end">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" colorScheme="green" disabled={isLoading}>
            {isLoading ? "Saving..." : item ? "Update" : "Create"}
          </Button>
        </Box>
      </VStack>
    </form>
  );
};
```

### Step 6: Use in Page/Route

Create or update a page component:

```typescript
"use client";

import React, { useState } from "react";
import { Box, Container } from "@chakra-ui/react";
import { MyFeatureList } from "../components/MyFeatureList";
import { MyFeatureForm } from "../components/MyFeatureForm";
import type { MyFeature } from "../types";

export default function MyFeaturePage() {
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MyFeature | undefined>();

  const handleAdd = () => {
    setEditingItem(undefined);
    setShowForm(true);
  };

  const handleEdit = (item: MyFeature) => {
    setEditingItem(item);
    setShowForm(true);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingItem(undefined);
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingItem(undefined);
  };

  return (
    <Container maxW="container.xl" py={8}>
      {showForm ? (
        <Box>
          <MyFeatureForm
            item={editingItem}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        </Box>
      ) : (
        <MyFeatureList onAdd={handleAdd} onEdit={handleEdit} />
      )}
    </Container>
  );
}
```

---

## Best Practices

### 1. Type Safety

**Always define types first**:
```typescript
// ✅ GOOD - Full type coverage
const { data } = useQuery<Plant[], Error>({
  queryKey: ["plants"],
  queryFn: fetchPlants
});

// ❌ BAD - No type safety
const { data } = useQuery({
  queryKey: ["plants"],
  queryFn: fetchPlants
});
```

### 2. Query Keys

**Use consistent, hierarchical query keys**:
```typescript
// ✅ GOOD - Hierarchical and specific
["plants"]                          // All plants
["plants", plantId]                 // Single plant
["plants", plantId, "history"]      // Plant's care history
["care-history", { plantId }]       // With parameters

// ❌ BAD - Inconsistent
["getPlants"]
["plant-detail"]
["history"]
```

### 3. Error Handling

**Handle errors gracefully in components**:
```typescript
if (error) {
  return (
    <Alert.Root status="error">
      <Alert.Indicator />
      <Alert.Title>
        {error instanceof Error ? error.message : "An error occurred"}
      </Alert.Title>
    </Alert.Root>
  );
}
```

**Handle errors in mutations**:
```typescript
const createMutation = useMutation({
  mutationFn: createItem,
  onSuccess: () => {
    // Show success toast
    queryClient.invalidateQueries({ queryKey: ["items"] });
  },
  onError: (error) => {
    // Show error toast
    console.error("Failed to create item:", error);
  }
});
```

### 4. Loading States

**Show appropriate loading states**:
```typescript
// Initial load
if (isLoading) {
  return <Skeleton />;
}

// Mutation in progress
const isSubmitting = createStatus === "pending";

<Button disabled={isSubmitting}>
  {isSubmitting ? "Saving..." : "Save"}
</Button>
```

### 5. Cache Invalidation

**Invalidate related queries after mutations**:
```typescript
const updateZoneMutation = useMutation({
  mutationFn: updateZone,
  onSuccess: () => {
    // Invalidate all related queries
    queryClient.invalidateQueries({ queryKey: ["userZone"] });
    queryClient.invalidateQueries({ queryKey: ["seasonalTips"] });
    queryClient.invalidateQueries({ queryKey: ["plantProfiles"] });
  }
});
```

### 6. Optimistic Updates (Advanced)

**Update UI immediately for better UX**:
```typescript
const deleteMutation = useMutation({
  mutationFn: deleteItem,
  onMutate: async (deletedId) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ["items"] });

    // Snapshot previous value
    const previousItems = queryClient.getQueryData(["items"]);

    // Optimistically update
    queryClient.setQueryData(["items"], (old: Item[] = []) =>
      old.filter((item) => item.id !== deletedId)
    );

    // Return context for rollback
    return { previousItems };
  },
  onError: (err, deletedId, context) => {
    // Rollback on error
    queryClient.setQueryData(["items"], context?.previousItems);
  },
  onSettled: () => {
    // Always refetch after error or success
    queryClient.invalidateQueries({ queryKey: ["items"] });
  },
});
```

### 7. Conditional Queries

**Only fetch when needed**:
```typescript
// Fetch plant details only when plantId exists
const { data: plant } = useQuery({
  queryKey: ["plants", plantId],
  queryFn: () => getPlant(plantId!),
  enabled: !!plantId, // Only run if plantId is truthy
});
```

### 8. Stale Time Configuration

**Optimize refetch behavior**:
```typescript
// Data that changes frequently (real-time)
const { data } = useQuery({
  queryKey: ["notifications"],
  queryFn: fetchNotifications,
  staleTime: 0, // Always refetch
  refetchInterval: 30000, // Poll every 30 seconds
});

// Data that rarely changes
const { data } = useQuery({
  queryKey: ["userZone"],
  queryFn: fetchUserZone,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

// Static/read-only data
const { data } = useQuery({
  queryKey: ["plantProfiles"],
  queryFn: fetchPlantProfiles,
  staleTime: Infinity, // Never stale
});
```

### 9. Query Parameters

**Build query strings properly**:
```typescript
export const fetchItems = async (filters: ItemFilters) => {
  const params = new URLSearchParams();

  if (filters.search) params.append("search", filters.search);
  if (filters.type) params.append("type", filters.type);
  if (filters.page) params.append("page", filters.page.toString());
  if (filters.limit) params.append("limit", filters.limit.toString());

  const queryString = params.toString();
  const endpoint = `/items${queryString ? `?${queryString}` : ""}`;

  return await apiClient.request<ItemResponse>(endpoint);
};
```

### 10. Component Organization

**Separate concerns**:
```typescript
// ✅ GOOD - Separated
components/
  ├── PlantsList.tsx       // List view (uses hook)
  ├── PlantCard.tsx        // Single item display
  ├── PlantForm.tsx        // Create/Edit form
  └── PlantFilters.tsx     // Filter controls

// ❌ BAD - Everything in one component
components/
  └── Plants.tsx           // 1000+ lines of mixed concerns
```

### 11. Use "use client" Directive

**Required for hooks and interactivity in Next.js App Router**:
```typescript
"use client"; // Must be at the top of file

import { useState } from "react";
import { useMyFeature } from "../hooks/useMyFeature";

export default function MyComponent() {
  // ...
}
```

### 12. Environment Variables

**Use Next.js public env vars**:
```typescript
// .env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api

// Access in code
const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
```

---

## Examples

### Example 1: Simple Query Hook

```typescript
// hooks/useNotifications.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { ApiClient } from "../utils/api";

export const useNotifications = () => {
  const apiClient = ApiClient.getInstance();

  return useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const response = await apiClient.request<{ notifications: Notification[] }>(
        "/notifications"
      );
      return response.notifications;
    },
    staleTime: 30000, // 30 seconds
  });
};
```

### Example 2: Mutation with Toast Notification

```typescript
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiClient } from "../utils/api";
import { toaster } from "@/components/ui/toaster";

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();
  const apiClient = ApiClient.getInstance();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      await apiClient.request(`/notifications/${notificationId}/read`, {
        method: "PATCH",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toaster.create({
        title: "Notification marked as read",
        type: "success",
      });
    },
    onError: (error) => {
      toaster.create({
        title: "Failed to update notification",
        description: error.message,
        type: "error",
      });
    },
  });
};
```

### Example 3: Paginated Query

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import { ApiClient } from "../utils/api";
import { useState } from "react";

export const usePaginatedPlants = () => {
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const apiClient = ApiClient.getInstance();

  const { data, isLoading, error } = useQuery({
    queryKey: ["plants", "paginated", page, limit],
    queryFn: async () => {
      const response = await apiClient.request<{
        plants: Plant[];
        total: number;
        page: number;
      }>(`/plants?page=${page}&limit=${limit}`);
      return response;
    },
    keepPreviousData: true, // Smooth pagination
  });

  return {
    plants: data?.plants || [],
    total: data?.total || 0,
    currentPage: page,
    totalPages: Math.ceil((data?.total || 0) / limit),
    isLoading,
    error,
    nextPage: () => setPage((p) => p + 1),
    prevPage: () => setPage((p) => Math.max(1, p - 1)),
    goToPage: (p: number) => setPage(p),
  };
};
```

### Example 4: Dependent Queries

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import { ApiClient } from "../utils/api";

export const usePlantWithHistory = (plantId: string | null) => {
  const apiClient = ApiClient.getInstance();

  // First query - get plant
  const { data: plant, isLoading: plantLoading } = useQuery({
    queryKey: ["plants", plantId],
    queryFn: async () => {
      const response = await apiClient.request<{ plant: Plant }>(
        `/plants/${plantId}`
      );
      return response.plant;
    },
    enabled: !!plantId, // Only run if plantId exists
  });

  // Second query - get care history (depends on first query)
  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ["care-history", plant?.id],
    queryFn: async () => {
      const response = await apiClient.request<{ careHistory: CareHistory[] }>(
        `/care-history?plantId=${plant!.id}`
      );
      return response.careHistory;
    },
    enabled: !!plant, // Only run if plant exists
  });

  return {
    plant,
    history,
    isLoading: plantLoading || historyLoading,
  };
};
```

### Example 5: Form with Validation

```typescript
"use client";

import React, { useState } from "react";
import { Button, Input, Field, VStack } from "@chakra-ui/react";
import { useCreatePlant } from "../hooks/usePlants";

export const PlantForm = ({ onSuccess }: { onSuccess: () => void }) => {
  const [name, setName] = useState("");
  const [type, setType] = useState<"indoor" | "outdoor">("indoor");
  const [waterInterval, setWaterInterval] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { createPlant, createStatus } = usePlants();

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "Name is required";
    }

    const interval = parseInt(waterInterval);
    if (!waterInterval || isNaN(interval) || interval < 1 || interval > 365) {
      newErrors.waterInterval = "Water interval must be between 1 and 365 days";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      await createPlant({
        name: name.trim(),
        type,
        water_interval_days: parseInt(waterInterval),
      });
      onSuccess();
    } catch (error) {
      console.error("Failed to create plant:", error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <VStack gap={4} align="stretch">
        <Field.Root invalid={!!errors.name}>
          <Field.Label>Plant Name</Field.Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., My Tomato Plant"
          />
          {errors.name && <Field.ErrorText>{errors.name}</Field.ErrorText>}
        </Field.Root>

        <Field.Root>
          <Field.Label>Type</Field.Label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "indoor" | "outdoor")}
          >
            <option value="indoor">Indoor</option>
            <option value="outdoor">Outdoor</option>
          </select>
        </Field.Root>

        <Field.Root invalid={!!errors.waterInterval}>
          <Field.Label>Water Interval (days)</Field.Label>
          <Input
            type="number"
            value={waterInterval}
            onChange={(e) => setWaterInterval(e.target.value)}
            placeholder="e.g., 7"
          />
          {errors.waterInterval && (
            <Field.ErrorText>{errors.waterInterval}</Field.ErrorText>
          )}
        </Field.Root>

        <Button
          type="submit"
          colorScheme="green"
          disabled={createStatus === "pending"}
        >
          {createStatus === "pending" ? "Creating..." : "Create Plant"}
        </Button>
      </VStack>
    </form>
  );
};
```

---

## Quick Reference Checklist

When adding a new frontend feature:

- [ ] Define TypeScript types in `types/index.ts`
- [ ] Create API client in `api/myFeature.ts`
  - [ ] Use `ApiClient.getInstance()`
  - [ ] Type all request/response objects
  - [ ] Handle errors properly
- [ ] Create React Query hook in `hooks/useMyFeature.ts`
  - [ ] Add `"use client"` directive
  - [ ] Define query keys
  - [ ] Setup queries with `useQuery`
  - [ ] Setup mutations with `useMutation`
  - [ ] Configure cache invalidation
- [ ] Create components in `components/`
  - [ ] List/grid view component
  - [ ] Form component for create/edit
  - [ ] Detail view component (if needed)
- [ ] Use components in pages/routes
- [ ] Handle loading states
- [ ] Handle error states
- [ ] Handle empty states
- [ ] Add proper TypeScript types throughout
- [ ] Test authentication flow
- [ ] Test CRUD operations
- [ ] Verify cache invalidation works

---

## Additional Resources

- **TanStack Query Docs**: https://tanstack.com/query/latest
- **Next.js App Router**: https://nextjs.org/docs/app
- **Chakra UI v3**: https://www.chakra-ui.com/
- **TypeScript Handbook**: https://www.typescriptlang.org/docs/

---

*Last Updated: 2025-01-18*
