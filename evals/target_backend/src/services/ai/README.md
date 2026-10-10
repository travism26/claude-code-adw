# AI Services

Organized, reusable AI services following best practices from the LLM workflows guide.

**📋 IMPORTANT**: All AI services MUST follow the standards in `.claude/ai-services-standards.md`

## Architecture

```
services/ai/
├── core/                      # Shared utilities and base classes
│   ├── types.ts              # Common types (AIPrompts, Suggestion, etc.)
│   ├── BaseAIService.ts      # Base class with common AI functionality
│   ├── PromptLogger.ts       # Reusable prompt logging utility
│   └── index.ts              # Core exports
│
├── garden/                    # Garden analysis domain
│   ├── types.ts              # Garden-specific types
│   ├── GardenContextBuilder.ts    # Gathers garden data from database
│   ├── GardenPromptBuilder.ts     # Builds AI prompts for garden analysis
│   ├── GardenAnalysisService.ts   # Main service (slim orchestrator)
│   └── index.ts              # Garden exports
│
└── index.ts                   # Main exports for all AI services
```

## Design Principles

### 1. **Separation of Concerns**
Each component has a single, clear responsibility:
- **ContextBuilder**: Data gathering from database
- **PromptBuilder**: Prompt engineering and formatting
- **Service**: Orchestration and business logic
- **BaseService**: Shared AI interaction patterns

### 2. **Reusability**
Core components can be used by any AI service:
- `BaseAIService` - Common AI functionality
- `PromptLogger` - Console logging for debugging
- Shared types and utilities

### 3. **Testability**
Each component can be tested independently:
- ContextBuilder can be tested with mock data
- PromptBuilder can be tested with sample context
- Service orchestration can be tested with mocked dependencies

### 4. **Scalability**
Easy to add new AI services by following the same pattern:
```
services/ai/
├── plant/                     # New domain: plant care analysis
│   ├── types.ts
│   ├── PlantContextBuilder.ts
│   ├── PlantPromptBuilder.ts
│   ├── PlantAnalysisService.ts
│   └── index.ts
```

## Usage

### Garden Analysis Service

```typescript
import { GardenAnalysisService } from './services/ai/garden';

const service = new GardenAnalysisService();
const analysis = await service.analyzeGarden(gardenId, userId);
```

### Using Individual Components

```typescript
import { GardenContextBuilder, GardenPromptBuilder } from './services/ai/garden';
import { PromptLogger } from './services/ai/core';

// Build context
const contextBuilder = new GardenContextBuilder();
const context = await contextBuilder.build(gardenId, userId);

// Build prompts
const prompts = GardenPromptBuilder.build(context);

// Log for testing
PromptLogger.log(prompts, context, 'GARDEN ANALYSIS');
```

## Creating a New AI Service

Follow these steps to add a new AI service domain:

### 1. Create domain folder and types
```typescript
// services/ai/myservice/types.ts
export interface MyContext {
  // Define your context structure
}

export interface MyAnalysisResponse extends BaseAnalysisResponse<MyContext> {
  // Add domain-specific fields
}
```

### 2. Create ContextBuilder
```typescript
// services/ai/myservice/MyContextBuilder.ts
export class MyContextBuilder {
  async build(id: string, userId: string): Promise<MyContext> {
    // Gather data from database
  }
}
```

### 3. Create PromptBuilder
```typescript
// services/ai/myservice/MyPromptBuilder.ts
export class MyPromptBuilder {
  static build(context: MyContext): AIPrompts {
    const systemPrompt = // Define system prompt
    const userPrompt = // Build user prompt
    return { systemPrompt, userPrompt };
  }
}
```

### 4. Create Service extending BaseAIService
```typescript
// services/ai/myservice/MyAnalysisService.ts
export class MyAnalysisService extends BaseAIService {
  private contextBuilder: MyContextBuilder;

  constructor() {
    super({
      enableAICalls: false,
      logPrompts: true,
    });
    this.contextBuilder = new MyContextBuilder();
  }

  async analyze(id: string, userId: string): Promise<MyAnalysisResponse> {
    const context = await this.contextBuilder.build(id, userId);
    const prompts = MyPromptBuilder.build(context);

    if (this.config.logPrompts) {
      PromptLogger.log(prompts, context, 'MY ANALYSIS');
    }

    // Call AI or return mock
    // Build and return response
  }
}
```

### 5. Export from index files
```typescript
// services/ai/myservice/index.ts
export * from './types';
export * from './MyAnalysisService';
export * from './MyContextBuilder';
export * from './MyPromptBuilder';
```

Update main index:
```typescript
// services/ai/index.ts
export * from './core';
export * from './garden';
export * from './myservice';  // Add new export
```

## Configuration

### Enabling AI Calls

Each service has a feature flag at the top:

```typescript
// services/ai/garden/GardenAnalysisService.ts
const ENABLE_AI_CALLS = false;  // Change to true
```

Or configure via constructor:
```typescript
const service = new GardenAnalysisService();
service.config.enableAICalls = true;
```

### Disabling Prompt Logging

```typescript
const service = new GardenAnalysisService();
service.config.logPrompts = false;
```

## Testing

Use the test scripts in `backend/src/scripts/`:

```bash
# Test garden analysis
npx ts-node src/scripts/testGardenAnalysis.ts

# With specific IDs
npx ts-node src/scripts/testGardenAnalysis.ts <garden-id> <user-id>
```

## Base Service Features

All services extending `BaseAIService` get:

- ✅ AI wrapper integration (Anthropic Claude + OpenAI fallback)
- ✅ Automatic retry logic with exponential backoff
- ✅ Response parsing and sanitization
- ✅ Mock response generation for testing
- ✅ Zone parsing utilities
- ✅ Score calculation helpers
- ✅ Suggestion creation helpers

## Best Practices

1. **Keep services thin** - Delegate to builders and utilities
2. **Log prompts during development** - Review what's sent to AI
3. **Test with mock responses first** - Validate logic before enabling AI calls
4. **Use feature flags** - Easy toggle between mock and real AI
5. **Follow the single responsibility principle** - One class, one job
6. **Export through index files** - Clean import paths

## Future Enhancements

Potential additions to the AI services structure:

- `plant/` - Plant care and health analysis
- `care/` - Care schedule optimization
- `pest/` - Pest and disease diagnosis
- `yield/` - Yield prediction and optimization
- `common/` - Shared context builders (UserContext, ZoneContext, etc.)

---

## Standards & Best Practices

📋 **Required Reading**: [AI Services Standards](../../../../.claude/ai-services-standards.md)

This standards document provides:
- Complete implementation patterns
- Anti-patterns to avoid
- Checklist for new services
- Step-by-step guide
- Reference examples

**Always consult the standards before creating a new AI service.**
