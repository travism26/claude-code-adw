# Project

This is the frontend application for GrowBuddy, built with Next.js and TypeScript. This should follow the hook component architecture pattern this way we can easily swap out the frontend framework if needed.

# How to start the frontend

There is a .env file that needs to be created this will hold the public api base url for the backend api.

## Example .env file

```bash
NEXT_PUBLIC_API_BASE_URL="PUBLIC_API_GATEWAY_URL"
```

## Running the frontend

```bash
pnpm run dev
```

This will start the frontend on http://localhost:3000
