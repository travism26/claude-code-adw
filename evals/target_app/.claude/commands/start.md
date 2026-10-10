# Start Python Application

## Instructions

This command starts the Python application in development or production mode.

### Prerequisites

Before running these commands, ensure:

1. Dependencies are installed: `uv sync`
2. Environment variables are configured in `.env` if needed
3. Configuration file exists (check README.md for location)

### Running the Application

The application can be run in several ways:

## Run

# Run the application directly
uv run python -m app.notes

# Or build first, then run
uv sync
uv run python -m app.notes

# Run a specific subcommand / mode
uv run python -m app.notes list
