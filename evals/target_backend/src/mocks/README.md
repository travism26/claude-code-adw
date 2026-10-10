# AI Mock Responses

This directory contains mock AI responses used during development when `MOCK_AI=true` is set in your `.env` file.

## Overview

Mock responses allow you to develop and test AI features without needing actual API keys for Anthropic Claude or OpenAI. The responses are loaded from `ai-responses.json` and interpolated with request data.

## File Structure

```
backend/src/mocks/
├── README.md              # This file
└── ai-responses.json      # Mock response templates
```

## How It Works

1. When `MOCK_AI=true`, the AIWrapper service loads mock responses from `ai-responses.json`
2. Response templates can include placeholders like `{plantName}` or `{plantType}`
3. Placeholders are replaced with actual values from the request payload
4. Confidence scores get slight randomization (±0.05) to simulate real AI variance

## ai-responses.json Structure

The JSON file contains response templates for each AI request type:

```json
{
  "request_type": {
    "action": "The recommended action (supports {placeholders})",
    "reason": "Explanation for the action (supports {placeholders})",
    "confidence": 0.85,
    "additionalInfo": {
      "key": "value"
    }
  }
}
```

## Available Request Types

Current mock responses support these AI request types:

- `plant_update_suggestion` - Plant care recommendations
- `weather_based_action` - Weather-based garden actions
- `care_recommendation` - General plant care advice
- `pest_diagnosis` - Pest identification and treatment
- `garden_analysis` - Garden layout optimization
- `general` - Generic gardening questions

## Adding New Mock Responses

To add a new AI request type:

### 1. Add the type to AIRequestType (if not already present)

In `backend/src/services/aiWrapper.ts`:

```typescript
export type AIRequestType =
  | 'plant_update_suggestion'
  | 'weather_based_action'
  | 'care_recommendation'
  | 'pest_diagnosis'
  | 'garden_analysis'
  | 'general'
  | 'your_new_type_here'; // Add your new type
```

### 2. Add mock response to ai-responses.json

```json
{
  "your_new_type_here": {
    "action": "Do something with {plantName}",
    "reason": "This helps {plantType} grow better",
    "confidence": 0.8,
    "additionalInfo": {
      "tip": "Some helpful advice",
      "warning": "Something to watch out for"
    }
  }
}
```

### 3. Test your new response type

```bash
curl -X POST http://localhost:3000/api/ai-tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "type": "your_new_type_here",
    "payload": {
      "plantName": "Rose",
      "plantType": "Flowering Plant"
    }
  }'
```

## Template Placeholders

The system supports these placeholders out of the box:

| Placeholder | Default Value | Source |
|-------------|---------------|--------|
| `{plantName}` | "plant" | `payload.plantName` |
| `{plantType}` | "plant" | `payload.plantType` |
| `{growthStage}` | "active growth" | `payload.growthStage` |
| `{symptoms}` | "discolored leaves..." | `payload.symptoms` |
| `{location}` | "garden" | `payload.location` |

### Adding New Placeholders

To add support for new placeholders, update the `interpolateTemplate()` method in `aiWrapper.ts`:

```typescript
private interpolateTemplate(template: string, payload: Record<string, any>): string {
  let result = template;

  const placeholders: Record<string, string> = {
    plantName: payload.plantName || 'plant',
    plantType: payload.plantType || 'plant',
    growthStage: payload.growthStage || 'active growth',
    symptoms: payload.symptoms || 'discolored leaves, sticky residue',
    location: payload.location || 'garden',
    // Add your new placeholder here:
    yourNewField: payload.yourNewField || 'default value',
  };

  // ... rest of method
}
```

## Example Responses

### Simple Response
```json
{
  "care_recommendation": {
    "action": "Water your {plantType} twice weekly",
    "reason": "{plantType} needs consistent moisture",
    "confidence": 0.8,
    "additionalInfo": {
      "frequency": "Every 3-4 days"
    }
  }
}
```

### Complex Response with Arrays
```json
{
  "garden_analysis": {
    "action": "Optimize plant spacing and companion planting",
    "reason": "Improves air circulation and pest resistance",
    "confidence": 0.82,
    "additionalInfo": {
      "improvements": [
        "Increase spacing to 24 inches",
        "Add companion plants",
        "Improve drainage"
      ],
      "estimatedBenefit": "30-40% pest reduction"
    }
  }
}
```

## Tips for Writing Good Mock Responses

1. **Be Realistic**: Mock responses should simulate actual AI output
2. **Use Placeholders**: Make responses dynamic with `{placeholders}`
3. **Vary Confidence**: Different tasks should have different confidence levels
4. **Add Context**: Use `additionalInfo` for detailed guidance
5. **Keep It Concise**: Action should be clear and actionable
6. **Explain Why**: Reason should justify the recommendation

## Confidence Score Guidelines

- **0.5-0.6**: Low confidence, general advice
- **0.7-0.8**: Medium confidence, solid recommendations
- **0.8-0.9**: High confidence, well-established practices
- **0.9-0.95**: Very high confidence, critical actions

The system adds ±0.05 variation automatically.

## Testing Mock Responses

### 1. Enable Mock Mode
```bash
echo "MOCK_AI=true" >> .env
```

### 2. Restart Server
```bash
npm run dev
npm run start:worker  # In another terminal
```

### 3. Make Test Request
```bash
curl -X POST http://localhost:3000/api/ai-tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "type": "care_recommendation",
    "payload": {
      "plantType": "tomato",
      "growthStage": "flowering"
    }
  }'
```

### 4. Check Response
You should see:
- `model_used: 'mock-ai-service'`
- Action with interpolated values (e.g., "tomato" instead of "{plantType}")
- Confidence with slight variation from JSON value

## Switching Between Mock and Real AI

### Development (Mock)
```bash
MOCK_AI=true
# No API keys needed
```

### Production (Real)
```bash
MOCK_AI=false
ANTHROPIC_API_KEY=sk-ant-...
# OR
OPENAI_API_KEY=sk-...
```

## Troubleshooting

### Mock responses not loading?

1. Check JSON syntax: `npm run build` will catch errors
2. Verify file location: `backend/src/mocks/ai-responses.json`
3. Check tsconfig includes JSON: `"include": ["src/**/*.json"]`

### Placeholders not being replaced?

1. Check placeholder name matches exactly (case-sensitive)
2. Verify placeholder is in `interpolateTemplate()` method
3. Ensure payload contains the field (or default is acceptable)

### Getting TypeScript errors?

Make sure your `tsconfig.json` includes:
```json
{
  "compilerOptions": {
    "resolveJsonModule": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*.ts", "src/**/*.json"]
}
```

## Version History

### Version 1.0.0 (2025-11-09)
- Initial mock response system
- Support for 6 AI request types
- Template placeholder interpolation
- Confidence randomization

## Related Files

- `backend/src/services/aiWrapper.ts` - Loads and processes mock responses
- `backend/src/config/ai.ts` - Mock mode configuration
- `backend/MOCK_AI_GUIDE.md` - User guide for mock AI mode
- `backend/.env.sample` - Sample environment configuration

---

**Need help?** Check the main [MOCK_AI_GUIDE.md](../../MOCK_AI_GUIDE.md) for setup and usage instructions.
