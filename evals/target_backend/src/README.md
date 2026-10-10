# GrowBuddy

Home gardeners struggle to remember diverse care schedules and track plant health over time. GrowBuddy is a solution to help gardeners manage their plants and care schedules effectively.

## Project Overview

GrowBuddy is a full-stack application that helps gardeners:

- Track plant care schedules
- Monitor plant health
- Manage multiple plants
- Get reminders for plant care tasks

## Tech Stack

### Backend

- Node.js with Express
- TypeScript
- PostgreSQL with Sequelize ORM

### Frontend

- React
- TypeScript
- Modern UI components

## Development Setup

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:

   ```bash
   cd backend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up environment variables:

   - Create a `.env` file in the backend directory
   - Add necessary environment variables (see `.env.example`)

4. Start the development server:

   ```bash
   npm run dev
   ```

### Frontend Setup

1. Navigate to the frontend directory:

   ```bash
   cd frontend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm start
   ```

## Deployment

### Production Deployment

The backend runs as a standard Express server:

1. Build the application:

   ```bash
   npm run build
   ```

2. Set up production environment variables (database credentials, JWT secrets, etc.)

3. Start the server:

   ```bash
   npm start
   ```

The application will start on the port specified by the `PORT` environment variable (default: 3000).

## Project Structure

```
GrowBuddy/
├── backend/
│   ├── src/
│   │   ├── index.ts          # Express server entry point
│   │   ├── routes/           # API routes
│   │   ├── models/           # Database models
│   │   ├── config/           # Configuration files
│   │   ├── middleware/       # Express middleware
│   │   ├── migrations/       # Database migrations
│   │   └── utils/            # Utility functions
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── pages/            # Page components
│   │   └── services/         # API services
│   └── package.json
├── shared/
├── documentation/
├── package.json
└── README.md
```

## Environment Variables

The backend requires the following environment variables:

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development, test, production)
- `DB_HOST` - PostgreSQL host
- `DB_PORT` - PostgreSQL port (default: 5432)
- `DB_NAME` - Database name
- `DB_USER` - Database username
- `DB_PASSWORD` - Database password
- `JWT_SECRET` - Secret for JWT token generation
- `JWT_REFRESH_SECRET` - Secret for refresh token generation
