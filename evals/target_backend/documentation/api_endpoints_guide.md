# GrowBuddy v2 - API Endpoints Guide

## Table of Contents
- [Overview](#overview)
- [Existing Endpoints](#existing-endpoints)
- [Authentication & Middleware](#authentication--middleware)
- [How to Add a New Endpoint](#how-to-add-a-new-endpoint)
- [Best Practices](#best-practices)
- [Examples](#examples)

---

## Overview

The GrowBuddy v2 API is built with:
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Sequelize ORM
- **Authentication**: JWT (JSON Web Tokens) with dual token approach
- **Validation**: express-validator
- **Middleware**: Custom authentication middleware

All API routes are prefixed with `/api`.

---

## Existing Endpoints

### 1. Authentication Routes (`/api/auth`)

**File**: `backend/src/routes/auth.ts`

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | `/api/auth/signup` | No | Register a new user account |
| POST | `/api/auth/login` | No | Login and receive access/refresh tokens |
| POST | `/api/auth/refresh` | No (refresh token) | Refresh expired access token |
| POST | `/api/auth/logout` | No | Logout and invalidate refresh token |

**Token Strategy**:
- Access Token: 15-minute expiry (short-lived for security)
- Refresh Token: 7-day expiry (stored in database for invalidation)
- Tokens delivered via cookies AND response body

---

### 2. Plant Routes (`/api/plants`)

**File**: `backend/src/routes/plants.ts`

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | `/api/plants` | Yes | Create a new plant |
| GET | `/api/plants` | Yes | Get all plants for authenticated user |
| GET | `/api/plants/:id` | Yes | Get single plant by ID |
| PUT | `/api/plants/:id` | Yes | Update plant |
| DELETE | `/api/plants/:id` | Yes | Delete plant |

**Key Features**:
- Automatic user scoping (can only access own plants)
- Optional plant_profile_id for auto-configuration
- Automatic reminder generation on plant creation
- Validation for all inputs

---

### 3. Plant Profile Routes (`/api/plant-profiles`)

**File**: `backend/src/routes/plantProfiles.ts`

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/api/plant-profiles` | No* | Browse plant database with filters |
| GET | `/api/plant-profiles/search?q=query` | No* | Search plants by name/species |
| GET | `/api/plant-profiles/:id` | No* | Get single plant profile with seasonal tips |

*Uses optional authentication - can work without auth but provides personalized results if authenticated.

**Query Parameters**:
- `type`: Filter by indoor/outdoor
- `difficulty`: Filter by easy/medium/hard
- `zone`: Filter by hardiness zone
- `q`: Search query for name/species

---

### 4. Zone Routes (`/api/zones`)

**File**: `backend/src/routes/zones.ts`

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | `/api/zones/detect` | Yes | Detect hardiness zone from postal code |
| GET | `/api/zones/user` | Yes | Get current user's zone settings |
| PUT | `/api/zones/user` | Yes | Update user's zone |

**Supported Regions**:
- United States (ZIP codes)
- Canada (postal codes)

---

### 5. Care History Routes (`/api/care-history`)

**File**: `backend/src/routes/careHistory.ts`

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | `/api/care-history` | Yes | Log a care action |
| GET | `/api/care-history` | Yes | Get all care history with filters |
| GET | `/api/care-history/plant/:plantId` | Yes | Get care history for specific plant |
| DELETE | `/api/care-history/:id` | Yes | Delete care history entry |

**Care Action Types**:
- water
- fertilize
- prune
- harvest
- repot
- other

---

### 6. Journal Routes (`/api/journal`)

**File**: `backend/src/routes/journal.ts`

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | `/api/journal` | Yes | Create journal entry |
| GET | `/api/journal` | Yes | Get all journal entries |
| GET | `/api/journal/:id` | Yes | Get single journal entry |
| PUT | `/api/journal/:id` | Yes | Update journal entry |
| DELETE | `/api/journal/:id` | Yes | Delete journal entry |

---

## Authentication & Middleware

### Authentication Middleware

**File**: `backend/src/middleware/auth.ts`

#### 1. `authenticateJWT` - Required Authentication

```typescript
import { authenticateJWT } from "../middleware";

router.get("/protected", authenticateJWT, async (req, res) => {
  // req.user is guaranteed to exist
  const userId = req.user!.id;
  // ... your logic
});
```

**Behavior**:
- Checks for token in cookies (`accessToken`) OR Authorization header (`Bearer <token>`)
- Verifies JWT signature
- Fetches user from database
- Attaches `req.user` and `req.token` to request
- Returns 401 if token missing, invalid, or expired

**Extended Request Type**:
```typescript
interface Request {
  user?: User;      // Sequelize User model instance
  token?: string;   // The JWT token
}
```

#### 2. `optionalAuthJWT` - Optional Authentication

```typescript
import { optionalAuthJWT } from "../middleware";

router.get("/public-with-personalization", optionalAuthJWT, async (req, res) => {
  if (req.user) {
    // User is authenticated - provide personalized response
  } else {
    // User is not authenticated - provide generic response
  }
});
```

**Behavior**:
- Tries to authenticate but doesn't fail if no token
- Useful for public endpoints that can be personalized when user is logged in

### Token Flow

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       │ 1. POST /api/auth/login
       │    { email, password }
       │
       ▼
┌─────────────────────┐
│   Auth Route        │
│   (No middleware)   │
└──────┬──────────────┘
       │
       │ 2. Validates credentials
       │ 3. Generates JWT tokens
       │    - Access: 15min
       │    - Refresh: 7 days
       │
       ▼
┌─────────────────────┐
│   Set Cookies +     │
│   Return Tokens     │
└──────┬──────────────┘
       │
       │ 4. Client stores tokens
       │
       ▼
┌─────────────────────┐
│   Subsequent        │
│   Requests          │
│   (authenticateJWT) │
└──────┬──────────────┘
       │
       │ 5a. Cookie: accessToken
       │     OR
       │ 5b. Header: Authorization: Bearer <token>
       │
       ▼
┌─────────────────────┐
│   Middleware        │
│   - Verify token    │
│   - Load user       │
│   - Attach to req   │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│   Route Handler     │
│   Access req.user   │
└─────────────────────┘
```

### Cookie Configuration

**File**: `backend/src/config/cookies.ts`

```typescript
// Refresh Token (7 days)
COOKIE_OPTIONS = {
  httpOnly: false,        // Accessible to JavaScript
  secure: production,     // HTTPS only in production
  sameSite: 'strict',     // CSRF protection
  path: '/',
  maxAge: 7 days
}

// Access Token (15 minutes)
ACCESS_TOKEN_COOKIE_OPTIONS = {
  ...COOKIE_OPTIONS,
  maxAge: 15 minutes
}
```

---

## How to Add a New Endpoint

Follow these steps to add a new endpoint to the GrowBuddy API:

### Step 1: Create Route File

Create a new file in `backend/src/routes/`:

```typescript
// backend/src/routes/myNewFeature.ts
import { Router, Request, Response } from "express";
import { body, param, query, validationResult } from "express-validator";
import { authenticateJWT } from "../middleware";
import { MyModel } from "../models";

const router: Router = Router();

// Your routes will go here...

export default router;
```

### Step 2: Define Validation Rules

Use `express-validator` for input validation:

```typescript
// Validation for POST/PUT
const validateCreate = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description must be 500 characters or less"),
  body("status")
    .isIn(["active", "inactive"])
    .withMessage("Status must be active or inactive"),
];

// Validation for params
const validateId = [
  param("id")
    .isUUID()
    .withMessage("Invalid ID format"),
];

// Validation for query strings
const validateQuery = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
];
```

### Step 3: Create Route Handlers

#### Example: Protected POST Route

```typescript
router.post(
  "/",
  authenticateJWT,              // 1. Require authentication
  validateCreate,               // 2. Validate input
  async (req: Request, res: Response): Promise<Response> => {
    try {
      // 3. Check validation results
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // 4. Extract data from request
      const { name, description, status } = req.body;
      const userId = req.user!.id;  // User guaranteed to exist

      // 5. Create database record
      const record = await MyModel.create({
        name,
        description,
        status,
        user_id: userId,
      });

      // 6. Return success response
      return res.status(201).json({
        message: "Record created successfully",
        data: record,
      });
    } catch (error) {
      console.error("Create error:", error);
      return res.status(500).json({
        error: "Error creating record",
      });
    }
  }
);
```

#### Example: Protected GET Route (List)

```typescript
router.get(
  "/",
  authenticateJWT,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const records = await MyModel.findAll({
        where: { user_id: req.user!.id },  // Scope to user's data
        order: [["created_at", "DESC"]],
      });

      return res.json({
        data: records,
        count: records.length,
      });
    } catch (error) {
      console.error("Get records error:", error);
      return res.status(500).json({
        error: "Error retrieving records",
      });
    }
  }
);
```

#### Example: Protected GET Route (Single Item)

```typescript
router.get(
  "/:id",
  authenticateJWT,
  validateId,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const record = await MyModel.findOne({
        where: {
          id: req.params.id,
          user_id: req.user!.id,  // Ensure user owns this record
        },
      });

      if (!record) {
        return res.status(404).json({
          error: "Record not found",
        });
      }

      return res.json({
        data: record,
      });
    } catch (error) {
      console.error("Get record error:", error);
      return res.status(500).json({
        error: "Error retrieving record",
      });
    }
  }
);
```

#### Example: Protected PUT Route

```typescript
router.put(
  "/:id",
  authenticateJWT,
  validateId,
  validateCreate.map(v => v.optional()),  // Make all fields optional for updates
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Find and verify ownership
      const record = await MyModel.findOne({
        where: {
          id: req.params.id,
          user_id: req.user!.id,
        },
      });

      if (!record) {
        return res.status(404).json({
          error: "Record not found",
        });
      }

      // Update
      await record.update(req.body);

      return res.json({
        message: "Record updated successfully",
        data: record,
      });
    } catch (error) {
      console.error("Update record error:", error);
      return res.status(500).json({
        error: "Error updating record",
      });
    }
  }
);
```

#### Example: Protected DELETE Route

```typescript
router.delete(
  "/:id",
  authenticateJWT,
  validateId,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const record = await MyModel.findOne({
        where: {
          id: req.params.id,
          user_id: req.user!.id,
        },
      });

      if (!record) {
        return res.status(404).json({
          error: "Record not found",
        });
      }

      await record.destroy();

      return res.json({
        message: "Record deleted successfully",
      });
    } catch (error) {
      console.error("Delete record error:", error);
      return res.status(500).json({
        error: "Error deleting record",
      });
    }
  }
);
```

#### Example: Public Route (Optional Auth)

```typescript
import { optionalAuthJWT } from "../middleware";

router.get(
  "/public",
  optionalAuthJWT,  // User may or may not be authenticated
  async (req: Request, res: Response): Promise<Response> => {
    try {
      let records;

      if (req.user) {
        // Personalized results for authenticated user
        records = await MyModel.findAll({
          where: {
            OR: [
              { user_id: req.user.id },
              { is_public: true }
            ]
          },
        });
      } else {
        // Public results only
        records = await MyModel.findAll({
          where: { is_public: true },
        });
      }

      return res.json({
        data: records,
      });
    } catch (error) {
      console.error("Error:", error);
      return res.status(500).json({
        error: "Error retrieving records",
      });
    }
  }
);
```

### Step 4: Register Route in Main Router

Edit `backend/src/routes/index.ts`:

```typescript
import { Router } from 'express';
import authRoutes from './auth';
import plantRoutes from './plants';
import journalRoutes from './journal';
import plantProfileRoutes from './plantProfiles';
import zoneRoutes from './zones';
import careHistoryRoutes from './careHistory';
import myNewFeatureRoutes from './myNewFeature';  // ADD THIS

const router: Router = Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/plants', plantRoutes);
router.use('/journal', journalRoutes);
router.use('/plant-profiles', plantProfileRoutes);
router.use('/zones', zoneRoutes);
router.use('/care-history', careHistoryRoutes);
router.use('/my-new-feature', myNewFeatureRoutes);  // ADD THIS

export default router;
```

### Step 5: Test Your Endpoints

Use the backend test structure:

```typescript
// backend/src/tests/api/myNewFeature.test.ts
import request from "supertest";
import { expect } from "chai";
import { setupTestDatabase, teardownTestDatabase } from "../setup";

describe("My New Feature API", () => {
  let authToken: string;

  before(async () => {
    await setupTestDatabase();
    // Create test user and get token
  });

  after(async () => {
    await teardownTestDatabase();
  });

  describe("POST /api/my-new-feature", () => {
    it("should create a new record", async () => {
      const res = await request(app)
        .post("/api/my-new-feature")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "Test Record",
          description: "Test Description",
        });

      expect(res.status).to.equal(201);
      expect(res.body).to.have.property("data");
    });

    it("should require authentication", async () => {
      const res = await request(app)
        .post("/api/my-new-feature")
        .send({ name: "Test" });

      expect(res.status).to.equal(401);
    });
  });
});
```

---

## Best Practices

### 1. Security

- **Always scope data to user**: Never trust client-provided user IDs
  ```typescript
  // BAD - Client could send any user_id
  const plants = await Plant.findAll({ where: { user_id: req.body.user_id } });

  // GOOD - Use authenticated user's ID
  const plants = await Plant.findAll({ where: { user_id: req.user!.id } });
  ```

- **Validate all inputs**: Use express-validator for type checking and sanitization
- **Use parameterized queries**: Sequelize handles this automatically
- **Rate limiting**: Consider adding rate limiting for public endpoints

### 2. Error Handling

- **Always use try-catch**: Prevent server crashes
- **Log errors**: Use console.error for debugging
- **Return appropriate status codes**:
  - 200: Success
  - 201: Created
  - 400: Bad Request (validation errors)
  - 401: Unauthorized (not authenticated)
  - 403: Forbidden (authenticated but not allowed)
  - 404: Not Found
  - 500: Internal Server Error

### 3. Response Structure

**Consistency is key**:

```typescript
// Success response
{
  message?: "Optional success message",
  data: { /* your data */ },
  count?: 123  // For lists
}

// Error response
{
  error: "Human-readable error message"
}

// Validation error response
{
  errors: [
    { field: "email", message: "Invalid email format" }
  ]
}
```

### 4. TypeScript Types

- **Always type your route handlers**: `Promise<Response>`
- **Use non-null assertion** for authenticated requests: `req.user!.id`
- **Define interfaces** for complex request bodies

### 5. Database Queries

- **Use eager loading** for related data:
  ```typescript
  const plants = await Plant.findAll({
    include: [{ model: PlantProfile }],
  });
  ```

- **Order results** consistently:
  ```typescript
  order: [["created_at", "DESC"]]
  ```

- **Use transactions** for multi-step operations:
  ```typescript
  const transaction = await sequelize.transaction();
  try {
    await Model1.create({ ... }, { transaction });
    await Model2.create({ ... }, { transaction });
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
  ```

### 6. Documentation

- **Document your endpoints** in this file
- **Add JSDoc comments** to complex functions
- **Update API tests** when changing endpoints

---

## Examples

### Full Example: Notifications Endpoint

```typescript
// backend/src/routes/notifications.ts
import { Router, Request, Response } from "express";
import { body, param, validationResult } from "express-validator";
import { authenticateJWT } from "../middleware";
import { Notification } from "../models";

const router: Router = Router();

// Validation
const validateMarkAsRead = [
  param("id").isUUID().withMessage("Invalid notification ID"),
];

// Get all notifications for user
router.get(
  "/",
  authenticateJWT,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const notifications = await Notification.findAll({
        where: { user_id: req.user!.id },
        order: [["created_at", "DESC"]],
        limit: 50,
      });

      const unreadCount = notifications.filter(n => !n.is_read).length;

      return res.json({
        data: notifications,
        count: notifications.length,
        unread_count: unreadCount,
      });
    } catch (error) {
      console.error("Get notifications error:", error);
      return res.status(500).json({
        error: "Error retrieving notifications",
      });
    }
  }
);

// Mark notification as read
router.patch(
  "/:id/read",
  authenticateJWT,
  validateMarkAsRead,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const notification = await Notification.findOne({
        where: {
          id: req.params.id,
          user_id: req.user!.id,
        },
      });

      if (!notification) {
        return res.status(404).json({
          error: "Notification not found",
        });
      }

      await notification.update({ is_read: true });

      return res.json({
        message: "Notification marked as read",
        data: notification,
      });
    } catch (error) {
      console.error("Mark notification as read error:", error);
      return res.status(500).json({
        error: "Error updating notification",
      });
    }
  }
);

// Mark all notifications as read
router.patch(
  "/read-all",
  authenticateJWT,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const [updatedCount] = await Notification.update(
        { is_read: true },
        {
          where: {
            user_id: req.user!.id,
            is_read: false,
          },
        }
      );

      return res.json({
        message: "All notifications marked as read",
        updated_count: updatedCount,
      });
    } catch (error) {
      console.error("Mark all notifications as read error:", error);
      return res.status(500).json({
        error: "Error updating notifications",
      });
    }
  }
);

// Delete notification
router.delete(
  "/:id",
  authenticateJWT,
  validateMarkAsRead,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const notification = await Notification.findOne({
        where: {
          id: req.params.id,
          user_id: req.user!.id,
        },
      });

      if (!notification) {
        return res.status(404).json({
          error: "Notification not found",
        });
      }

      await notification.destroy();

      return res.json({
        message: "Notification deleted successfully",
      });
    } catch (error) {
      console.error("Delete notification error:", error);
      return res.status(500).json({
        error: "Error deleting notification",
      });
    }
  }
);

export default router;
```

---

## Quick Reference Checklist

When adding a new endpoint, ensure you:

- [ ] Create route file in `backend/src/routes/`
- [ ] Import necessary dependencies (Router, Request, Response, validators, middleware)
- [ ] Define validation rules using express-validator
- [ ] Add authentication middleware (`authenticateJWT` or `optionalAuthJWT`)
- [ ] Implement route handlers with proper TypeScript types
- [ ] Check validation results in each handler
- [ ] Scope data to authenticated user (where applicable)
- [ ] Use try-catch for error handling
- [ ] Return appropriate HTTP status codes
- [ ] Log errors with console.error
- [ ] Export the router as default
- [ ] Register route in `backend/src/routes/index.ts`
- [ ] Write API tests in `backend/src/tests/api/`
- [ ] Document the endpoint in this guide
- [ ] Test manually with Postman or similar tool

---

## Additional Resources

- **Express Documentation**: https://expressjs.com/
- **express-validator**: https://express-validator.github.io/
- **Sequelize ORM**: https://sequelize.org/
- **JWT Best Practices**: https://tools.ietf.org/html/rfc8725

---

## Phase 3: Community, AI, and Garden Planner Endpoints

### 7. Community Q&A Routes (`/api/questions`)

**File**: `backend/src/routes/questions.ts`

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/api/questions` | No | Get all questions with pagination and filtering |
| GET | `/api/questions/:id` | No | Get single question with answers |
| POST | `/api/questions` | Yes | Create a new question |
| PUT | `/api/questions/:id` | Yes | Update question (author only) |
| DELETE | `/api/questions/:id` | Yes | Delete question (author only) |

**Query Parameters**:
- `page`: Page number (default: 1)
- `limit`: Results per page (default: 20, max: 100)
- `tag`: Filter by tag
- `search`: Search in title and body

---

### 8. Answer Routes (`/api/answers`)

**File**: `backend/src/routes/answers.ts`

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | `/api/answers` | Yes | Create an answer to a question |
| PUT | `/api/answers/:id` | Yes | Update answer (author only) |
| DELETE | `/api/answers/:id` | Yes | Delete answer (author only) |
| POST | `/api/answers/:id/vote` | Yes | Vote on an answer (+1 or -1) |
| DELETE | `/api/answers/:id/vote` | Yes | Remove your vote from an answer |

---

### 9. Garden Planner Routes (`/api/gardens`)

**File**: `backend/src/routes/gardens.ts`

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/api/gardens` | Yes | Get all gardens for user |
| GET | `/api/gardens/:id` | Yes | Get single garden with plots |
| POST | `/api/gardens` | Yes | Create a new garden |
| PUT | `/api/gardens/:id` | Yes | Update garden |
| DELETE | `/api/gardens/:id` | Yes | Delete garden |
| POST | `/api/gardens/:id/plots` | Yes | Add plot to garden |
| PUT | `/api/gardens/:id/plots/:plotId` | Yes | Update plot |
| DELETE | `/api/gardens/:id/plots/:plotId` | Yes | Delete plot |

**Features**:
- Automatic plot overlap detection
- Garden boundary validation
- Integration with plant profiles

---

### 10. Recommendation Routes (`/api/recommendations`)

**File**: `backend/src/routes/recommendations.ts`

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/api/recommendations` | Yes | Get recommendations for user |
| GET | `/api/recommendations/summary` | Yes | Get recommendation counts by severity/type |
| POST | `/api/recommendations/generate` | Yes | Manually trigger recommendation generation |
| POST | `/api/recommendations/generate-all` | Yes | Generate recommendations for all users (admin) |
| DELETE | `/api/recommendations/:id` | Yes | Dismiss recommendation |

**Query Parameters**:
- `limit`: Number of results (default: 20, max: 100)
- `severity`: Filter by severity (low, medium, high)
- `type`: Filter by type (water, fertilize, prune, pest_check, harvest, general)

---

### 11. Companion Planting Routes (`/api/companions`)

**File**: `backend/src/routes/companions.ts`

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/api/companions` | No | Get all companion relationships |
| GET | `/api/companions/:plantProfileId` | No | Get companions for specific plant |
| POST | `/api/companions` | Yes | Create companion relationship |
| DELETE | `/api/companions/:id` | Yes | Delete companion relationship |

**Returns**: Beneficial and harmful companion plants organized by relationship type.

---

## Phase 3 Services

### Weather Service

**File**: `backend/src/services/weatherService.ts`

Integrates with OpenWeatherMap API to provide:
- Current weather conditions
- 5-day forecast
- Precipitation data
- Weather-based care recommendations

**Configuration**: Set `OPENWEATHER_API_KEY` in environment variables.

---

### Recommendation Generator

**File**: `backend/src/services/recommendationGenerator.ts`

Analyzes:
- Care history for overdue tasks
- Weather data for watering adjustments
- Seasonal timing based on zone
- Plant-specific needs

**CRON Job**: Runs daily at 6 AM via `backend/src/scripts/generateDailyRecommendations.ts`

---

### Garden Layout Suggester

**File**: `backend/src/services/gardenLayoutSuggester.ts`

Generates optimal garden layouts based on:
- Plant spacing requirements
- Companion planting relationships
- Sunlight requirements
- Garden dimensions

---

## Phase 3 Setup Instructions

### 1. Run Migrations

```bash
cd backend && npm run migrate:dev
```

### 2. Seed Companion Data

```bash
npx ts-node src/scripts/seedCompanionData.ts
```

### 3. Configure Environment Variables

Add to `.env`:
```
OPENWEATHER_API_KEY=your_api_key_here
```

### 4. Test CRON Job (Optional)

```bash
npx ts-node src/scripts/generateDailyRecommendations.ts
```

---

*Last Updated: 2025-01-18 (Phase 3 Implementation Complete)*
