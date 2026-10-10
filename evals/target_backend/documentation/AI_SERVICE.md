# AI Service Documentation

The GrowBuddy AI Service (AIWrapper) provides secure, validated AI inference for plant care recommendations using Anthropic Claude and OpenAI models. It's an internal-only service designed to prevent prompt injection attacks and ensure consistent, safe AI interactions.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [AI Request Types](#ai-request-types)
- [Making AI Requests](#making-ai-requests)
- [Prompt Building](#prompt-building)
- [Response Processing](#response-processing)
- [Provider Fallback](#provider-fallback)
- [Configuration](#configuration)
- [Integration with Queue and MessageBus](#integration-with-queue-and-messagebus)
- [Security Considerations](#security-considerations)
- [Error Handling](#error-handling)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Advanced Topics](#advanced-topics)

## Overview

The AI Service is a **pure processing service** that accepts structured requests, calls AI providers, and returns sanitized responses. It has no knowledge of queues, HTTP endpoints, or WebSockets—these are handled by other services.

### Key Features

- **Multi-Provider Support**: Anthropic Claude (primary) and OpenAI (fallback)
- **Automatic Fallback**: If primary provider fails, switches to backup
- **Retry Logic**: Exponential backoff for transient failures
- **Prompt Engineering**: Task-specific prompts for consistent results
- **Response Sanitization**: Removes HTML, scripts, and harmful content
- **Message Bus Integration**: Publishes results for real-time notifications
- **Database Tracking**: Stores all requests and responses in PostgreSQL

### Use Cases

- Plant care recommendations based on current conditions
- Weather-based action suggestions
- Pest and disease diagnosis
- General gardening questions
- Personalized growing tips

### Security Note

**IMPORTANT**: The AI Service is for **internal use only**. It should **never** be exposed directly to users via HTTP endpoints. All user input must be validated and sanitized by API routes before reaching the AI Service to prevent prompt injection attacks.

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      API Layer / Worker                     │
│  (Validates input, constructs AIRequest)                    │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ aiWrapper.makeRequest(request)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      AIWrapper                              │
│  1. Validate request                                        │
│  2. Update task status to 'processing'                      │
│  3. Build prompts based on task type                        │
│  4. Call AI provider with retry logic                       │
│  5. Parse and sanitize response                             │
│  6. Store result in database                                │
│  7. Publish to MessageBus                                   │
│  8. Return AIResponse                                       │
└─────────┬───────────────────────────────┬───────────────────┘
          │                               │
          │ Primary Provider              │ Fallback
          ▼                               ▼
┌────────────────────┐          ┌────────────────────┐
│  Anthropic Claude  │          │      OpenAI        │
│   API (Claude 3.5) │          │   (GPT-4 Turbo)    │
└────────────────────┘          └────────────────────┘
          │                               │
          └───────────────┬───────────────┘
                          │ AI Response
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  Response Processing                        │
│  - Parse JSON from AI response                              │
│  - Sanitize strings (remove HTML, scripts)                  │
│  - Validate confidence scores                               │
│  - Structure as AISuggestion                                │
└───────────────────────────┬─────────────────────────────────┘
                            │
                 ┌──────────┴──────────┐
                 │                     │
                 ▼                     ▼
┌────────────────────────┐  ┌────────────────────────┐
│  PostgreSQL Database   │  │    Message Bus         │
│  (ai_tasks table)      │  │  (AI_RESULT_READY)     │
└────────────────────────┘  └────────────────────────┘
```

### Design Principles

1. **Separation of Concerns**: AI Service only handles AI inference, not HTTP, queues, or WebSockets
2. **Provider Abstraction**: Supports multiple AI providers with automatic fallback
3. **Idempotency**: Same request produces consistent results (with some temperature variance)
4. **Security**: Internal-only, validated inputs, sanitized outputs
5. **Observability**: All requests logged and stored in database

## Getting Started

### Prerequisites

- At least one AI provider API key (Anthropic or OpenAI)
- PostgreSQL database with `ai_tasks` table
- Environment variables configured

### Installation

The AI Service is included in the main GrowBuddy backend. Install dependencies:

```bash
npm install @anthropic-ai/sdk openai
```

### Initialization

The AI Service is initialized with a Sequelize instance:

```typescript
import { AIWrapper } from './services/aiWrapper';
import sequelize from './database';

// Create AI service instance
const aiService = new AIWrapper(sequelize);

console.log('AI Service initialized');
```

The service will:
1. Initialize Anthropic client if `ANTHROPIC_API_KEY` is set
2. Initialize OpenAI client if `OPENAI_API_KEY` is set
3. Warn if no API keys are configured

## AI Request Types

The AI Service supports five task types, each with specialized prompts:

### 1. Plant Update Suggestion

**Type**: `plant_update_suggestion`

**Purpose**: Recommend care actions based on plant's current status

**Payload**:
```typescript
{
  plantName: string;
  currentConditions: {
    water_level?: string;
    temperature?: number;
    humidity?: number;
    soil_ph?: number;
  };
  recentCare?: {
    lastWatered?: string;
    lastFertilized?: string;
  };
  environment?: {
    light?: string;
    location?: string;
  };
}
```

**Example**:
```typescript
await aiService.makeRequest({
  taskId: uuidv4(),
  type: 'plant_update_suggestion',
  userId: 'user-123',
  plantId: 'plant-456',
  payload: {
    plantName: 'Tomato',
    currentConditions: {
      water_level: 'low',
      temperature: 75,
      humidity: 60,
    },
    environment: {
      light: 'full sun',
      location: 'indoor',
    },
  },
});
```

### 2. Weather-Based Action

**Type**: `weather_based_action`

**Purpose**: Recommend actions based on upcoming weather

**Payload**:
```typescript
{
  weatherForecast: {
    temperature?: number;
    precipitation?: string;
    wind?: string;
  };
  plants: Array<{ name: string; type: string }>;
  season?: string;
  zone?: string; // Hardiness zone
}
```

**Example**:
```typescript
await aiService.makeRequest({
  taskId: uuidv4(),
  type: 'weather_based_action',
  userId: 'user-123',
  payload: {
    weatherForecast: {
      temperature: 32,
      precipitation: 'heavy rain',
      wind: 'strong',
    },
    plants: [
      { name: 'Tomato', type: 'vegetable' },
      { name: 'Basil', type: 'herb' },
    ],
    season: 'spring',
    zone: '7a',
  },
});
```

### 3. Care Recommendation

**Type**: `care_recommendation`

**Purpose**: General care advice for a plant type

**Payload**:
```typescript
{
  plantType: string;
  growthStage?: string;
  location?: string;
  context?: Record<string, any>;
}
```

**Example**:
```typescript
await aiService.makeRequest({
  taskId: uuidv4(),
  type: 'care_recommendation',
  userId: 'user-123',
  payload: {
    plantType: 'tomato',
    growthStage: 'flowering',
    location: 'indoor',
    context: {
      experience: 'beginner',
      climate: 'temperate',
    },
  },
});
```

### 4. Pest Diagnosis

**Type**: `pest_diagnosis`

**Purpose**: Diagnose and recommend treatment for plant issues

**Payload**:
```typescript
{
  plantName: string;
  symptoms: string;
  photoDescription?: string;
  recentChanges?: string;
}
```

**Example**:
```typescript
await aiService.makeRequest({
  taskId: uuidv4(),
  type: 'pest_diagnosis',
  userId: 'user-123',
  plantId: 'plant-456',
  payload: {
    plantName: 'Tomato',
    symptoms: 'Yellow leaves with brown spots, wilting stems',
    photoDescription: 'Leaves have circular brown spots with yellow halos',
    recentChanges: 'Moved to sunnier location 3 days ago',
  },
});
```

### 5. General

**Type**: `general`

**Purpose**: Answer general gardening questions

**Payload**:
```typescript
{
  question?: string;
  prompt?: string;
  [key: string]: any;
}
```

**Example**:
```typescript
await aiService.makeRequest({
  taskId: uuidv4(),
  type: 'general',
  userId: 'user-123',
  payload: {
    question: 'When is the best time to prune tomato plants?',
  },
});
```

## Making AI Requests

### Basic Request

```typescript
import { AIWrapper } from './services/aiWrapper';
import sequelize from './database';
import { v4 as uuidv4 } from 'uuid';

const aiService = new AIWrapper(sequelize);

const response = await aiService.makeRequest({
  taskId: uuidv4(),
  type: 'care_recommendation',
  userId: 'user-123',
  plantId: 'plant-456',
  payload: {
    plantType: 'tomato',
    growthStage: 'flowering',
  },
});

if (response.status === 'completed') {
  console.log('AI Suggestion:', response.suggestion);
  // {
  //   action: "Increase watering frequency to twice daily",
  //   reason: "Flowering tomatoes need consistent moisture",
  //   confidence: 0.89,
  //   additionalInfo: {}
  // }
} else {
  console.error('AI Request Failed:', response.error);
}
```

### Request Interface

```typescript
export interface AIRequest {
  taskId: string;        // Unique identifier for this task
  type: AIRequestType;   // Task type (see above)
  payload: Record<string, any>; // Task-specific data
  userId?: string;       // Optional: User ID (for MessageBus notification)
  plantId?: string;      // Optional: Plant ID (for tracking)
}
```

### Response Interface

```typescript
export interface AIResponse {
  taskId: string;
  status: 'completed' | 'failed';
  suggestion?: AISuggestion;  // Available if status is 'completed'
  error?: string;             // Available if status is 'failed'
}

export interface AISuggestion {
  action: string;           // Actionable recommendation
  reason: string;           // Explanation for the action
  confidence: number;       // 0-1 (e.g., 0.85 = 85% confident)
  additionalInfo?: Record<string, any>; // Extra data
}
```

## Prompt Building

The AI Service builds specialized prompts for each task type to ensure consistent, high-quality responses.

### System Prompt (Common)

All requests use this base system prompt:

```
You are GrowBuddy AI, an expert gardening assistant specializing in plant care recommendations.
Your responses must be in JSON format with the following structure:
{
  "action": "A clear, actionable recommendation",
  "reason": "Brief explanation of why this action is recommended",
  "confidence": 0.85,
  "additionalInfo": {}
}

Confidence should be a number between 0 and 1, where 1 is completely certain.
Keep responses concise, practical, and focused on actionable advice.
```

### Task-Specific User Prompts

#### Plant Update Suggestion

```
Analyze this plant's current status and provide a care recommendation:
Plant: Tomato
Current Conditions: {"water_level":"low","temperature":75}
Recent Care History: {"lastWatered":"2025-01-20"}
Environmental Data: {"light":"full sun","location":"indoor"}

Based on this information, what care action should the gardener take next?
```

#### Care Recommendation

```
Provide general care recommendations for this plant:
Plant Type: tomato
Growth Stage: flowering
Location: indoor
Additional Context: {"experience":"beginner"}

What care does this plant need right now?
```

#### Pest Diagnosis

```
Help diagnose and treat a potential pest or disease issue:
Plant: Tomato
Symptoms: Yellow leaves with brown spots
Photos Description: Circular spots with yellow halos
Recent Changes: Moved to sunnier location

What is likely affecting this plant and how should it be treated?
```

### Customizing Prompts

To customize prompts, edit the prompt building methods in `aiWrapper.ts`:

```typescript
private buildPlantUpdatePrompt(payload: Record<string, any>): string {
  return `Analyze this plant's current status and provide a care recommendation:
Plant: ${payload.plantName || 'Unknown'}
Current Conditions: ${JSON.stringify(payload.currentConditions || {})}
...`;
}
```

## Response Processing

### Parsing AI Output

The AI Service attempts to parse responses as JSON:

```typescript
private parseAIResponse(responseText: string): any {
  try {
    // Try direct JSON parse
    return JSON.parse(responseText);
  } catch (error) {
    // Try extracting JSON from markdown code blocks
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }

    // Fall back to structured response from text
    return {
      action: responseText.substring(0, 200),
      reason: 'AI response was not in expected JSON format',
      confidence: 0.5,
      additionalInfo: { rawResponse: responseText },
    };
  }
}
```

### Sanitization

All AI responses are sanitized to remove potentially harmful content:

```typescript
private sanitize(result: any): AISuggestion {
  const action = this.sanitizeString(result.action || result.recommendation || '');
  const reason = this.sanitizeString(result.reason || result.explanation || '');
  const confidence = this.sanitizeConfidence(result.confidence);

  return { action, reason, confidence, additionalInfo: result.additionalInfo || {} };
}

private sanitizeString(text: string): string {
  let sanitized = text;

  // Remove HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // Remove script tags and content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove harmful protocols
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/data:text\/html/gi, '');

  // Normalize whitespace
  sanitized = sanitized.trim().replace(/\s+/g, ' ');

  return sanitized;
}
```

### Confidence Validation

Confidence scores are clamped to [0, 1]:

```typescript
private sanitizeConfidence(confidence: any): number {
  const num = parseFloat(confidence);
  if (isNaN(num)) {
    return 0.5; // Default confidence
  }
  return Math.max(0, Math.min(1, num)); // Clamp to [0, 1]
}
```

## Provider Fallback

The AI Service supports automatic fallback between providers:

### Fallback Logic

```typescript
// Step 1: Try primary provider (based on AI_DEFAULT_PROVIDER)
try {
  if (this.anthropic && aiConfig.defaultProvider === 'anthropic') {
    aiResult = await this.callClaudeAPI(request);
    modelUsed = 'claude-3-5-sonnet-20241022';
  } else if (this.openai) {
    aiResult = await this.callOpenAIAPI(request);
    modelUsed = 'gpt-4-turbo-preview';
  } else {
    throw new Error('No AI provider available');
  }
} catch (primaryError) {
  // Step 2: Try fallback provider
  console.warn('Primary AI provider failed, trying fallback:', primaryError);

  if (this.openai && aiConfig.defaultProvider === 'anthropic') {
    aiResult = await this.callOpenAIAPI(request);
    modelUsed = 'gpt-4-turbo-preview';
  } else if (this.anthropic && aiConfig.defaultProvider === 'openai') {
    aiResult = await this.callClaudeAPI(request);
    modelUsed = 'claude-3-5-sonnet-20241022';
  } else {
    throw primaryError; // Both providers failed
  }
}
```

### Retry Logic (Per Provider)

Each provider call has its own retry logic with exponential backoff:

```typescript
let lastError: Error | null = null;

for (let attempt = 0; attempt < aiConfig.retryAttempts; attempt++) {
  try {
    // Make API call
    const response = await this.anthropic.messages.create({ ... });
    return this.parseAIResponse(response);
  } catch (error) {
    lastError = error;
    console.error(`Claude API attempt ${attempt + 1} failed:`, error.message);

    if (attempt < aiConfig.retryAttempts - 1) {
      // Exponential backoff: 1s, 2s, 4s, ...
      const delay = aiConfig.retryDelay * Math.pow(2, attempt);
      await this.sleep(delay);
    }
  }
}

throw lastError;
```

### Total Retry Attempts

With default settings (`AI_RETRY_ATTEMPTS=3`):
- **Primary provider**: 3 attempts with exponential backoff
- **Fallback provider**: 3 attempts with exponential backoff
- **Total**: Up to 6 attempts before giving up

## Configuration

### Environment Variables

```bash
# AI Provider Keys (at least one required)
ANTHROPIC_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-...

# Model Selection (optional - defaults shown)
AI_ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
AI_OPENAI_MODEL=gpt-4-turbo-preview

# Default Provider (optional - defaults to Anthropic if key is set)
AI_DEFAULT_PROVIDER=anthropic  # or 'openai'

# Generation Parameters (optional)
AI_MAX_TOKENS=1024           # Maximum tokens in response
AI_TEMPERATURE=0.7           # Creativity level (0-1)
AI_TIMEOUT=30000             # API timeout in milliseconds (30s)

# Retry Configuration (optional)
AI_RETRY_ATTEMPTS=3          # Number of retry attempts per provider
AI_RETRY_DELAY=1000          # Base delay for exponential backoff (ms)
```

### Configuration Object

AI configuration in `src/config/ai.ts`:

```typescript
export interface AIConfig {
  anthropic: {
    apiKey: string;
    defaultModel: string;
  };
  openai: {
    apiKey: string;
    defaultModel: string;
  };
  defaultProvider: 'anthropic' | 'openai';
  maxTokens: number;
  temperature: number;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}
```

### Provider Selection

**Automatic**: If `ANTHROPIC_API_KEY` is set, Anthropic is used by default. Otherwise, OpenAI.

**Manual**: Set `AI_DEFAULT_PROVIDER=openai` to use OpenAI as primary (even if Anthropic key is configured).

### Model Selection

**Anthropic Models**:
- `claude-3-5-sonnet-20241022` (default, recommended)
- `claude-3-opus-20240229` (most capable, slower, expensive)
- `claude-3-sonnet-20240229` (balanced)
- `claude-3-haiku-20240307` (fast, cheaper)

**OpenAI Models**:
- `gpt-4-turbo-preview` (default)
- `gpt-4` (original GPT-4)
- `gpt-3.5-turbo` (faster, cheaper, less capable)

### Temperature

Controls randomness in AI responses:
- `0.0`: Deterministic, focused responses
- `0.7`: Balanced (default)
- `1.0`: Creative, varied responses

## Integration with Queue and MessageBus

### Database Tracking

All AI tasks are stored in the `ai_tasks` table:

```typescript
await AITask.create({
  id: taskId,
  user_id: userId,
  plant_id: plantId,
  task_type: type,
  status: 'processing',
  request_payload: payload,
  response_data: null,
  model_used: null,
  error_message: null,
  created_at: new Date(),
  completed_at: null,
});
```

After completion:

```typescript
await task.update({
  status: 'completed',
  response_data: suggestion,
  model_used: 'claude-3-5-sonnet-20241022',
  completed_at: new Date(),
});
```

### MessageBus Publishing

When an AI task completes successfully, the service publishes to MessageBus:

```typescript
import { messageBus, MessageBusEvent } from './messageBus';

// Publish AI result ready event
messageBus.publish(MessageBusEvent.AI_RESULT_READY, {
  taskId: taskId,
  userId: request.userId,
  plantId: request.plantId,
  suggestion: {
    type: request.type,
    content: suggestion.action,
    confidence: suggestion.confidence,
    actionItems: suggestion.reason ? [suggestion.reason] : undefined,
  },
  timestamp: new Date(),
});
```

This event is then picked up by WebSocket Service and pushed to the user in real-time.

### Queue Integration

The AI Service is called by the Queue Worker:

```typescript
// In AITaskWorker
async processJob(job: Job): Promise<any> {
  const aiService = new AIWrapper(this.sequelize);

  const response = await aiService.makeRequest({
    taskId: job.id,
    type: job.type,
    payload: job.payload,
    userId: job.payload.userId,
    plantId: job.payload.plantId,
  });

  if (response.status === 'failed') {
    throw new Error(response.error);
  }

  return response.suggestion;
}
```

## Security Considerations

### Internal Use Only

**CRITICAL**: The AI Service should **NEVER** be exposed directly via HTTP endpoints.

**Why?**
- **Prompt Injection**: Users could manipulate prompts to extract sensitive data or bypass restrictions
- **Cost Control**: Direct access could lead to abuse and excessive API costs
- **Quality Control**: Bypassing validation could produce poor-quality responses

**Correct Architecture**:
```
User → API Route (validates input) → Queue → Worker → AIWrapper
```

**Incorrect (NEVER DO THIS)**:
```
User → POST /api/ai/raw → AIWrapper  ❌ DANGEROUS
```

### Input Validation

Always validate inputs before calling AI Service:

```typescript
// In API route
router.post('/ai-tasks', authenticateJWT, [
  body('type').isIn(['plant_update_suggestion', 'care_recommendation', ...]),
  body('payload').isObject().notEmpty(),
  body('userId').optional().isUUID(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  // Only now is it safe to enqueue
  await queueService.enqueue(req.body.type, req.body.payload);
});
```

### Output Sanitization

The AI Service sanitizes all responses, but consumers should also:
- Escape HTML when rendering in UI
- Validate data types before using
- Never execute AI-generated code

### API Key Security

**Protect API keys**:
- Store in environment variables, not code
- Never commit `.env` to version control
- Use secret management in production (AWS Secrets Manager, HashiCorp Vault)
- Rotate keys regularly

**Monitor usage**:
- Track API costs via provider dashboards
- Set up billing alerts
- Log all AI requests for audit

## Error Handling

### Common Errors

#### Invalid API Key

```
Error: Anthropic API key is invalid
```

**Solution**: Verify `ANTHROPIC_API_KEY` is correct

#### Rate Limit Exceeded

```
Error: Rate limit exceeded. Please try again later.
```

**Solution**:
- Reduce `QUEUE_CONCURRENCY` to limit concurrent requests
- Add delays between requests
- Upgrade to higher rate limit tier

#### Timeout

```
Error: AI request timed out after 30000ms
```

**Solution**: Increase `AI_TIMEOUT` or use faster model (e.g., Claude Haiku)

#### Invalid Response Format

```
Warning: AI response was not in expected JSON format
```

**Result**: Service returns low-confidence suggestion with raw response in `additionalInfo`

**Solution**: Review and improve system prompt for better JSON compliance

### Error Recovery

The AI Service handles errors gracefully:

1. **Retry with backoff**: Transient errors (network, rate limit) are retried
2. **Provider fallback**: If primary provider fails, try secondary
3. **Database update**: Failed tasks are marked as 'failed' with error message
4. **MessageBus notification**: Failure events published to WebSocket
5. **Return error response**: Caller receives structured error

## Testing

### Unit Tests

Test AI Service in isolation:

```typescript
import { AIWrapper } from './services/aiWrapper';
import { Sequelize } from 'sequelize';

describe('AIWrapper', () => {
  let aiService: AIWrapper;
  let sequelize: Sequelize;

  beforeEach(() => {
    sequelize = new Sequelize('sqlite::memory:');
    aiService = new AIWrapper(sequelize);
  });

  it('should validate request with missing taskId', async () => {
    await expect(
      aiService.makeRequest({
        taskId: '',
        type: 'care_recommendation',
        payload: {},
      })
    ).rejects.toThrow('taskId is required');
  });

  it('should validate request with invalid type', async () => {
    await expect(
      aiService.makeRequest({
        taskId: '123',
        type: 'invalid_type' as any,
        payload: {},
      })
    ).rejects.toThrow('Invalid task type');
  });
});
```

### Integration Tests

Test AI Service with real AI providers (requires API keys):

```bash
# Set test API keys
export ANTHROPIC_API_KEY=your-test-key

# Run tests
npm run test:api
```

### Manual Testing

```typescript
import { AIWrapper } from './services/aiWrapper';
import sequelize from './database';
import { v4 as uuidv4 } from 'uuid';

const aiService = new AIWrapper(sequelize);

async function testAI() {
  const response = await aiService.makeRequest({
    taskId: uuidv4(),
    type: 'care_recommendation',
    payload: {
      plantType: 'tomato',
      growthStage: 'seedling',
    },
  });

  console.log('Status:', response.status);
  console.log('Suggestion:', response.suggestion);
}

testAI();
```

## Troubleshooting

### No AI Providers Available

**Symptom**: `Error: No AI provider available`

**Diagnosis**:
```bash
# Check if API keys are set
echo $ANTHROPIC_API_KEY
echo $OPENAI_API_KEY
```

**Solution**: Set at least one API key in `.env`

### All Requests Failing

**Symptom**: All AI requests return `status: 'failed'`

**Diagnosis**:
- Check error message in response
- Review server logs for API errors
- Test API key directly via provider's playground

**Common Causes**:
- Invalid API key
- Insufficient credits
- API service outage
- Network connectivity issues

**Solution**:
- Verify API key at provider dashboard
- Check account balance
- Check provider status page (e.g., status.anthropic.com)

### Low Confidence Scores

**Symptom**: AI returns suggestions with confidence < 0.5

**Diagnosis**: Review `additionalInfo.rawResponse` for formatting issues

**Common Causes**:
- Ambiguous or incomplete payload data
- AI couldn't parse request clearly
- System prompt needs improvement

**Solution**:
- Provide more context in payload
- Improve task-specific prompts
- Increase `AI_TEMPERATURE` for more creative responses

### High Latency

**Symptom**: AI requests taking >10 seconds

**Diagnosis**:
- Check which provider is being used
- Review `AI_MAX_TOKENS` setting
- Check network latency to AI provider

**Solutions**:
- Use faster model (Claude Haiku, GPT-3.5)
- Reduce `AI_MAX_TOKENS`
- Use provider with lower latency
- Cache common requests (future enhancement)

## Advanced Topics

### Custom Task Types

Add a new task type:

**Step 1**: Add to type union

```typescript
// In aiWrapper.ts
export type AIRequestType =
  | 'plant_update_suggestion'
  | 'weather_based_action'
  | 'care_recommendation'
  | 'pest_diagnosis'
  | 'general'
  | 'companion_planting';  // New type
```

**Step 2**: Add validation

```typescript
const validTypes: AIRequestType[] = [
  'plant_update_suggestion',
  'weather_based_action',
  'care_recommendation',
  'pest_diagnosis',
  'general',
  'companion_planting',  // New type
];
```

**Step 3**: Add prompt builder

```typescript
private buildPrompts(request: AIRequest): { systemPrompt: string; userPrompt: string } {
  // ... existing code ...

  switch (request.type) {
    // ... existing cases ...

    case 'companion_planting':
      userPrompt = this.buildCompanionPlantingPrompt(request.payload);
      break;
  }
}

private buildCompanionPlantingPrompt(payload: Record<string, any>): string {
  return `Recommend companion plants for this plant:
Plant: ${payload.plantName}
Current Garden: ${JSON.stringify(payload.currentPlants || [])}
Goals: ${payload.goals || 'pest control, yield improvement'}

What plants would grow well alongside this plant and why?`;
}
```

### Structured Output (Future)

For even more reliable JSON responses, consider using provider-specific structured output features:

**Anthropic** (when available):
```typescript
const response = await this.anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  response_format: { type: 'json_object' },  // When supported
  ...
});
```

**OpenAI** (already supported):
```typescript
const response = await this.openai.chat.completions.create({
  model: 'gpt-4-turbo-preview',
  response_format: { type: 'json_object' },  // Forces JSON
  ...
});
```

### Caching Responses

To reduce costs and latency, implement response caching:

```typescript
// Pseudo-code
const cacheKey = `ai:${type}:${hash(payload)}`;
const cached = await redis.get(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

const response = await aiService.makeRequest(request);
await redis.setex(cacheKey, 3600, JSON.stringify(response)); // Cache for 1 hour

return response;
```

### Multi-Model Ensemble

For critical decisions, query multiple models and aggregate responses:

```typescript
const responses = await Promise.all([
  callClaudeAPI(request),
  callOpenAIAPI(request),
]);

const aggregated = aggregateResponses(responses);
// Average confidence scores, merge action items, etc.
```

---

## See Also

- [Main Documentation](./README.md)
- [Queue Service](./QUEUE_SERVICE.md) - How AI tasks are queued
- [WebSocket Service](./WEBSOCKET_SERVICE.md) - Real-time result delivery
- [Anthropic Documentation](https://docs.anthropic.com/claude/reference/getting-started-with-the-api)
- [OpenAI Documentation](https://platform.openai.com/docs/api-reference)

---

**Last Updated**: 2025-01-23
