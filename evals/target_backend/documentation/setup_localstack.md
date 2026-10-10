# LocalStack Setup Guide

This guide explains how to set up and use LocalStack for local development and testing of the GrowBuddy application.

## Prerequisites

- Docker
- Node.js 18+
- pnpm
- AWS CLI (optional, for debugging)

## Installation

1. **Install LocalStack**

   ```bash
   docker run --rm -it -p 4566:4566 -p 4510-4559:4510-4559 localstack/localstack
   ```

2. **Install PostgreSQL for Local Development**

   ```bash
   docker run --name postgres \
     -e POSTGRES_PASSWORD=postgres \
     -e POSTGRES_DB=growbuddy \
     -p 5432:5432 \
     -d postgres:14
   ```

## Configuration

1. **Create LocalStack Configuration**
   Create `infra/localstack-config.ts`:

   ```typescript
   import * as cdk from 'aws-cdk-lib';

   export const localstackConfig = {
     env: {
       account: '000000000000',
       region: 'us-east-1',
     },
     endpoint: 'http://localhost:4566',
   };
   ```

2. **Environment Variables**
   Create `.env.localstack` in the backend directory:

   ```env
   AWS_ENDPOINT_URL=http://localhost:4566
   AWS_ACCESS_KEY_ID=test
   AWS_SECRET_ACCESS_KEY=test
   AWS_REGION=us-east-1
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=growbuddy
   DB_USER=postgres
   DB_PASSWORD=postgres
   ```

## Usage

1. **Start LocalStack**

   ```bash
   # From the infra directory
   pnpm localstack:start
   ```

2. **Deploy Stack to LocalStack**

   ```bash
   # From the infra directory
   pnpm deploy:local
   ```

3. **Start Backend with LocalStack**

   ```bash
   # From the backend directory
   pnpm dev:localstack
   ```

## Available Scripts

### infra/package.json

```json
{
  "scripts": {
    "localstack:start": "docker compose up localstack",
    "deploy:local": "USE_LOCALSTACK=true cdk deploy --require-approval never",
    "destroy:local": "USE_LOCALSTACK=true cdk destroy"
  }
}
```

### backend/package.json

```json
{
  "scripts": {
    "deploy:local": "ts-node scripts/deploy-local.ts",
    "validate:localstack": "ts-node scripts/validate-localstack.ts"
  }
}
```

### backend/package.json

```json
{
  "scripts": {
    "dev:localstack": "dotenv -e .env.localstack -- ts-node-dev --respawn --transpile-only src/index.ts",
    "build:localstack": "USE_LOCALSTACK=true node build.js"
  }
}
```

## Service Support

LocalStack supports the following AWS services used in GrowBuddy:

- Lambda
- API Gateway
- RDS (PostgreSQL)
- S3
- CloudFront
- Cognito
- Secrets Manager

## Limitations and Considerations

1. **Persistence**

   - By default, LocalStack doesn't persist data between restarts
   - To enable persistence, mount a volume:

     ```bash
     docker run --rm -it \
       -p 4566:4566 \
       -p 4510-4559:4510-4559 \
       -v /var/run/docker.sock:/var/run/docker.sock \
       -v "${LOCALSTACK_VOLUME_DIR:-./volume}:/var/lib/localstack" \
       localstack/localstack
     ```

2. **Service Limitations**
   - Some advanced features might not work exactly like in AWS
   - Performance characteristics will be different
   - Some services might have limited functionality
   - CloudFront might not work exactly the same way

## Best Practices

1. **Development Workflow**

```bash
# Start all services
docker compose up -d

# Deploy infrastructure
pnpm -C infra deploy:local

# Deploy Lambda function
pnpm -C backend deploy:local

# Validate setup
pnpm -C backend validate:localstack

# Expected successful output:
# Lambda connection successful. Found functions: growbuddy-api
# PostgreSQL connection successful. Current time: [timestamp]
```

2. **Environment Management**

- Use separate `.env.localstack` file for LocalStack configuration
- Configure AWS credentials explicitly for LocalStack:

  ```env
  AWS_ACCESS_KEY_ID=test
  AWS_SECRET_ACCESS_KEY=test
  AWS_ENDPOINT_URL=http://localhost:4566
  ```

- Use Docker network for inter-service communication

3. **Testing & Validation**

- Run automated validation after deployment:

  ```bash
  pnpm -C backend validate:localstack
  ```

- Include LocalStack testing in CI/CD pipelines
- Test service failure scenarios by stopping containers:

  ```bash
  docker compose stop localstack
  pnpm -C backend validate:localstack # Should show connection errors
  ```

## Troubleshooting

1. **Common Issues**

   - Service not available: Check if LocalStack is running
   - Connection refused: Verify ports are not in use
   - Database connection issues: Ensure PostgreSQL is running
   - Permission errors: Check AWS credentials configuration

2. **Debugging**
   - Use LocalStack CLI to inspect resources
   - Check LocalStack logs for errors
   - Verify environment variables
   - Test individual services separately

## Cleanup

To clean up LocalStack resources:

1. **Stop LocalStack**

   ```bash
   docker stop $(docker ps -q --filter ancestor=localstack/localstack)
   ```

2. **Stop PostgreSQL**

   ```bash
   docker stop postgres
   ```

3. **Remove Volumes (if used)**

   ```bash
   docker volume rm $(docker volume ls -q --filter name=localstack)
   ```

## Additional Resources

- [LocalStack Documentation](https://docs.localstack.cloud/)
- [LocalStack GitHub Repository](https://github.com/localstack/localstack)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/latest/guide/home.html)
