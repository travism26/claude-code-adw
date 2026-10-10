# Data Model Relationships

## Overview

This document outlines the relationships between the core data models in the GrowBuddy application.

## Models

### User

- Primary model for user authentication and profile management
- Fields:
  - `id`: UUID (Primary Key)
  - `email`: TEXT (Unique)
  - `password_hash`: TEXT
  - `tz`: STRING (Timezone)

### Plant

- Represents a plant being tracked by a user
- Fields:
  - `id`: UUID (Primary Key)
  - `user_id`: UUID (Foreign Key to User)
  - `name`: TEXT
  - `species`: TEXT (Optional)
  - `type`: ENUM ('indoor' | 'outdoor')
  - `water_interval_days`: INTEGER
  - `fert_interval_days`: INTEGER (Optional)
  - `last_watered`: DATE (Optional)
  - `last_fertilized`: DATE (Optional)
  - `photo_url`: TEXT (Optional)

### JournalEntry

- Represents a log entry for a plant
- Fields:
  - `id`: UUID (Primary Key)
  - `plant_id`: UUID (Foreign Key to Plant)
  - `entry_ts`: DATE
  - `note`: TEXT (Optional, max 1000 chars)
  - `photo_url`: TEXT (Optional)

## Relationships

### User ↔ Plant

- One-to-Many relationship
- A User can have multiple Plants
- Each Plant belongs to exactly one User
- Relationship is established through `user_id` foreign key in Plant model

### Plant ↔ JournalEntry

- One-to-Many relationship
- A Plant can have multiple JournalEntries
- Each JournalEntry belongs to exactly one Plant
- Relationship is established through `plant_id` foreign key in JournalEntry model

### User ↔ JournalEntry

- Indirect relationship through Plant
- A User's JournalEntries are accessed through their Plants
- No direct relationship to maintain data integrity and avoid redundancy

## Indexes

- Plant: Indexed on `user_id` for efficient user plant queries
- Plant: Indexed on `last_watered` for efficient watering schedule queries
- JournalEntry: Indexed on `plant_id` for efficient plant entry queries
- JournalEntry: Indexed on `entry_ts` for efficient chronological queries

## Design Decisions

### Indirect User-JournalEntry Relationship

The relationship between User and JournalEntry is intentionally indirect (through Plant) to:

1. Maintain data normalization
2. Prevent data redundancy
3. Ensure data consistency
4. Follow proper database design principles

### Cascading Relationships

- When a User is deleted, all associated Plants should be deleted
- When a Plant is deleted, all associated JournalEntries should be deleted

## Query Patterns

### Common Queries

1. Get all plants for a user:

   ```sql
   SELECT * FROM plants WHERE user_id = :userId
   ```

2. Get all journal entries for a plant:

   ```sql
   SELECT * FROM journal_entries WHERE plant_id = :plantId
   ```

3. Get all journal entries for a user (through plants):

   ```sql
   SELECT je.*
   FROM journal_entries je
   JOIN plants p ON je.plant_id = p.id
   WHERE p.user_id = :userId
   ```
