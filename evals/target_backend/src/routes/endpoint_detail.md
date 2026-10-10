# API Endpoints Documentation

This document provides detailed information about all available API endpoints for the GrowBuddy application.

## Base URL

All endpoints are prefixed with `/api` (e.g., `/api/auth/login`)

## Authentication

### POST /auth/signup

Create a new user account.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "password123",
  "timezone": "America/New_York" // optional, defaults to "UTC"
}
```

**Validation Rules:**

- `email`: Must be a valid email address
- `password`: Minimum 8 characters
- `timezone`: Must be a valid IANA timezone identifier

**Response (201 Created):**

```json
{
  "message": "User created successfully",
  "accessToken": "jwt_access_token_here",
  "refreshToken": "jwt_refresh_token_here",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "timezone": "America/New_York"
  }
}
```

**Error Responses:**

- `400 Bad Request`: Validation errors
- `409 Conflict`: Email already registered
- `500 Internal Server Error`: Server error

---

### POST /auth/login

Authenticate user and receive JWT tokens.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Validation Rules:**

- `email`: Must be a valid email address
- `password`: Required

**Response (200 OK):**

```json
{
  "message": "Login successful",
  "accessToken": "jwt_access_token_here",
  "refreshToken": "jwt_refresh_token_here",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "timezone": "America/New_York"
  }
}
```

**Error Responses:**

- `400 Bad Request`: Validation errors
- `401 Unauthorized`: Invalid credentials
- `500 Internal Server Error`: Server error

---

### POST /auth/refresh

Refresh access token using refresh token.

**Request Body:**

```json
{
  "refreshToken": "jwt_refresh_token_here"
}
```

**Validation Rules:**

- `refreshToken`: Required, valid refresh token

**Response (200 OK):**

```json
{
  "accessToken": "new_jwt_access_token_here",
  "refreshToken": "new_jwt_refresh_token_here"
}
```

**Error Responses:**

- `400 Bad Request`: Missing refresh token
- `401 Unauthorized`: Invalid or expired refresh token
- `500 Internal Server Error`: Server error

---

## Token Information

- **Access Token**: Short-lived token (15 minutes) used for API authentication
- **Refresh Token**: Long-lived token (7 days) used to obtain new access tokens
- **Usage**: Include access token in Authorization header for protected endpoints
- **Refresh Flow**: When access token expires, use refresh token to get new tokens

## Plants

### POST /plants

Create a new plant for the authenticated user.

**Headers:**

Authorization: Bearer <jwt_token>

**Request Body:**

```json
{
  "name": "My Plant",
  "type": "indoor", // "indoor" or "outdoor"
  "water_interval_days": 7,
  "fert_interval_days": 14, // optional
  "species": "Monstera deliciosa", // optional
  "photo_url": "https://example.com/photo.jpg" // optional
}
```

**Validation Rules:**

- `name`: Required, non-empty string
- `type`: Must be "indoor" or "outdoor"
- `water_interval_days`: Integer between 1-365
- `fert_interval_days`: Optional, integer between 1-365
- `species`: Optional string
- `photo_url`: Optional, must be valid URL

**Response (201 Created):**

```json
{
  "message": "Plant created successfully",
  "plant": {
    "id": "uuid",
    "name": "My Plant",
    "type": "indoor",
    "water_interval_days": 7,
    "fert_interval_days": 14,
    "species": "Monstera deliciosa",
    "photo_url": "https://example.com/photo.jpg",
    "user_id": "uuid",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Responses:**

- `400 Bad Request`: Validation errors
- `401 Unauthorized`: Invalid or missing token
- `500 Internal Server Error`: Server error

---

### GET /plants

Get all plants for the authenticated user.

**Headers:**

```
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**

```json
{
  "plants": [
    {
      "id": "uuid",
      "name": "My Plant",
      "type": "indoor",
      "water_interval_days": 7,
      "fert_interval_days": 14,
      "species": "Monstera deliciosa",
      "photo_url": "https://example.com/photo.jpg",
      "user_id": "uuid",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**Error Responses:**

- `401 Unauthorized`: Invalid or missing token
- `500 Internal Server Error`: Server error

---

### GET /plants/:id

Get a specific plant by ID.

**Headers:**

```
Authorization: Bearer <jwt_token>
```

**Parameters:**

- `id`: Plant UUID

**Response (200 OK):**

```json
{
  "plant": {
    "id": "uuid",
    "name": "My Plant",
    "type": "indoor",
    "water_interval_days": 7,
    "fert_interval_days": 14,
    "species": "Monstera deliciosa",
    "photo_url": "https://example.com/photo.jpg",
    "user_id": "uuid",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Responses:**

- `400 Bad Request`: Invalid plant ID format
- `401 Unauthorized`: Invalid or missing token
- `404 Not Found`: Plant not found
- `500 Internal Server Error`: Server error

---

### PUT /plants/:id

Update a specific plant.

**Headers:**

```
Authorization: Bearer <jwt_token>
```

**Parameters:**

- `id`: Plant UUID

**Request Body:** (All fields optional)

```json
{
  "name": "Updated Plant Name",
  "type": "outdoor",
  "water_interval_days": 5,
  "fert_interval_days": 10,
  "species": "Updated species",
  "photo_url": "https://example.com/new-photo.jpg"
}
```

**Validation Rules:** (Same as POST /plants, but all fields optional)

**Response (200 OK):**

```json
{
  "message": "Plant updated successfully",
  "plant": {
    "id": "uuid",
    "name": "Updated Plant Name",
    "type": "outdoor",
    "water_interval_days": 5,
    "fert_interval_days": 10,
    "species": "Updated species",
    "photo_url": "https://example.com/new-photo.jpg",
    "user_id": "uuid",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Responses:**

- `400 Bad Request`: Validation errors or invalid plant ID
- `401 Unauthorized`: Invalid or missing token
- `404 Not Found`: Plant not found
- `500 Internal Server Error`: Server error

---

### DELETE /plants/:id

Delete a specific plant.

**Headers:**

```
Authorization: Bearer <jwt_token>
```

**Parameters:**

- `id`: Plant UUID

**Response (200 OK):**

```json
{
  "message": "Plant deleted successfully"
}
```

**Error Responses:**

- `400 Bad Request`: Invalid plant ID format
- `401 Unauthorized`: Invalid or missing token
- `404 Not Found`: Plant not found
- `500 Internal Server Error`: Server error

---

## Journal Entries

### POST /journal

Create a new journal entry for a plant.

**Headers:**

```
Authorization: Bearer <jwt_token>
```

**Request Body:**

```json
{
  "plant_id": "uuid",
  "note": "Watered the plant today", // optional
  "photo_url": "https://example.com/journal-photo.jpg" // optional
}
```

**Validation Rules:**

- `plant_id`: Required, valid UUID
- `note`: Optional, max 1000 characters
- `photo_url`: Optional, must be valid URL

**Response (201 Created):**

```json
{
  "message": "Journal entry created successfully",
  "entry": {
    "id": "uuid",
    "plant_id": "uuid",
    "note": "Watered the plant today",
    "photo_url": "https://example.com/journal-photo.jpg",
    "entry_ts": "2024-01-01T00:00:00.000Z",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Responses:**

- `400 Bad Request`: Validation errors or invalid plant ID
- `401 Unauthorized`: Invalid or missing token
- `404 Not Found`: Plant not found or access denied
- `500 Internal Server Error`: Server error

---

### GET /journal/plant/:plantId

Get all journal entries for a specific plant.

**Headers:**

```
Authorization: Bearer <jwt_token>
```

**Parameters:**

- `plantId`: Plant UUID

**Response (200 OK):**

```json
{
  "entries": [
    {
      "id": "uuid",
      "plant_id": "uuid",
      "note": "Watered the plant today",
      "photo_url": "https://example.com/journal-photo.jpg",
      "entry_ts": "2024-01-01T00:00:00.000Z",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**Error Responses:**

- `400 Bad Request`: Invalid plant ID format
- `401 Unauthorized`: Invalid or missing token
- `404 Not Found`: Plant not found or access denied
- `500 Internal Server Error`: Server error

---

### GET /journal/:id

Get a specific journal entry by ID.

**Headers:**

```
Authorization: Bearer <jwt_token>
```

**Parameters:**

- `id`: Journal entry UUID

**Response (200 OK):**

```json
{
  "entry": {
    "id": "uuid",
    "plant_id": "uuid",
    "note": "Watered the plant today",
    "photo_url": "https://example.com/journal-photo.jpg",
    "entry_ts": "2024-01-01T00:00:00.000Z",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "plant": {
      "id": "uuid",
      "name": "My Plant",
      "type": "indoor",
      "water_interval_days": 7,
      "fert_interval_days": 14,
      "species": "Monstera deliciosa",
      "photo_url": "https://example.com/photo.jpg",
      "user_id": "uuid",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

**Error Responses:**

- `400 Bad Request`: Invalid journal entry ID format
- `401 Unauthorized`: Invalid or missing token
- `404 Not Found`: Journal entry not found
- `500 Internal Server Error`: Server error

---

### PUT /journal/:id

Update a specific journal entry.

**Headers:**

```
Authorization: Bearer <jwt_token>
```

**Parameters:**

- `id`: Journal entry UUID

**Request Body:** (All fields optional)

```json
{
  "note": "Updated note content",
  "photo_url": "https://example.com/updated-photo.jpg"
}
```

**Validation Rules:**

- `note`: Optional, max 1000 characters
- `photo_url`: Optional, must be valid URL

**Response (200 OK):**

```json
{
  "message": "Journal entry updated successfully",
  "entry": {
    "id": "uuid",
    "plant_id": "uuid",
    "note": "Updated note content",
    "photo_url": "https://example.com/updated-photo.jpg",
    "entry_ts": "2024-01-01T00:00:00.000Z",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Responses:**

- `400 Bad Request`: Validation errors or invalid journal entry ID
- `401 Unauthorized`: Invalid or missing token
- `404 Not Found`: Journal entry not found
- `500 Internal Server Error`: Server error

---

### DELETE /journal/:id

Delete a specific journal entry.

**Headers:**

```
Authorization: Bearer <jwt_token>
```

**Parameters:**

- `id`: Journal entry UUID

**Response (200 OK):**

```json
{
  "message": "Journal entry deleted successfully"
}
```

**Error Responses:**

- `400 Bad Request`: Invalid journal entry ID format
- `401 Unauthorized`: Invalid or missing token
- `404 Not Found`: Journal entry not found
- `500 Internal Server Error`: Server error

---

## Authentication

All protected endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

JWT tokens are obtained from the `/auth/login` or `/auth/signup` endpoints and expire after 24 hours.

## Error Response Format

All error responses follow this format:

```json
{
  "error": "Error message description"
}
```

For validation errors:

```json
{
  "errors": [
    {
      "type": "field",
      "value": "invalid_value",
      "msg": "Validation error message",
      "path": "field_name",
      "location": "body"
    }
  ]
}
```

## Data Types

- **UUID**: Standard UUID v4 format
- **Date**: ISO 8601 format (e.g., "2024-01-01T00:00:00.000Z")
- **Email**: Valid email address format
- **URL**: Valid HTTP/HTTPS URL format
- **Timezone**: Valid IANA timezone identifier (e.g., "America/New_York", "UTC")
