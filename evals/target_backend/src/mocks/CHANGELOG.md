# Mock AI System Changelog

## 2025-11-09 - JSON-Based Mock Responses

### Summary
Refactored mock AI responses from hardcoded TypeScript to centralized JSON file for easier maintenance and extensibility.

### Changes Made

#### New Files
- ✅ `src/mocks/ai-responses.json` - Centralized mock response templates
- ✅ `src/mocks/README.md` - Comprehensive guide for managing mock responses
- ✅ `src/mocks/CHANGELOG.md` - This file

#### Modified Files
- ✅ `src/services/aiWrapper.ts`
  - Added JSON import: `import mockResponses from '../mocks/ai-responses.json'`
  - Refactored `generateMockResponse()` to load from JSON
  - Added `interpolateTemplate()` method for placeholder replacement

- ✅ `tsconfig.json`
  - Added `"resolveJsonModule": true` for JSON imports
  - Added `"esModuleInterop": true` for better module compatibility
  - Updated include to `["src/**/*.ts", "src/**/*.json"]`

- ✅ `MOCK_AI_GUIDE.md`
  - Added section on customizing mock responses
  - Updated notes to mention template placeholders

### Benefits

1. **Easier Maintenance**: Edit JSON directly without touching TypeScript code
2. **Version Control**: JSON changes are clearly visible in diffs
3. **Non-Developer Friendly**: Product managers or QA can modify responses
4. **Template System**: Support for `{placeholder}` syntax in responses
5. **Extensibility**: Add new response types by just adding JSON entries
6. **Documentation**: Centralized README explains everything

### Template System

Mock responses now support placeholder interpolation:

```json
{
  "action": "Water your {plantName} thoroughly",
  "reason": "{plantType} needs consistent moisture"
}
```

Gets interpolated with request payload:
```javascript
payload = { plantName: "Rose", plantType: "Flowering Plant" }
// Result: "Water your Rose thoroughly"
// Result: "Flowering Plant needs consistent moisture"
```

### Supported Placeholders

- `{plantName}` → `payload.plantName` or "plant"
- `{plantType}` → `payload.plantType` or "plant"
- `{growthStage}` → `payload.growthStage` or "active growth"
- `{symptoms}` → `payload.symptoms` or "discolored leaves, sticky residue"
- `{location}` → `payload.location` or "garden"

### Adding New Response Types

Before (TypeScript):
```typescript
// Edit aiWrapper.ts
const mockResponses: Record<AIRequestType, any> = {
  // Add 20+ lines of TypeScript
  new_type: { ... },
};
```

After (JSON):
```json
// Edit ai-responses.json
{
  "new_type": {
    "action": "Simple action text",
    "reason": "Simple reason",
    "confidence": 0.8
  }
}
```

### Migration Notes

All existing mock functionality preserved:
- ✅ Confidence randomization (±0.05)
- ✅ Special handling for `weather_based_action` with plant arrays
- ✅ Special handling for `general` type with questions
- ✅ Default fallback to `general` for unknown types
- ✅ Deep cloning to prevent mutation

### Testing

TypeScript compilation: ✅ Passes
- `npx tsc --noEmit` completes without errors
- JSON module resolution working correctly

### Documentation

- `src/mocks/README.md` - Complete guide with examples
- `MOCK_AI_GUIDE.md` - Updated user guide
- JSON file includes `_metadata` section with version and notes

### Future Enhancements

Potential improvements for future versions:

1. **Multiple Scenarios**: Support different mock response sets (optimistic, pessimistic, error cases)
2. **Localization**: Multi-language mock responses
3. **Mock Modes**: Different confidence levels for testing edge cases
4. **Response Variants**: Multiple possible responses per type with random selection
5. **Conditional Logic**: Support for if/else in templates based on payload
6. **Mock Analytics**: Track which mock responses are used most during development

### Breaking Changes

None - This is a backwards-compatible refactor. The API and behavior remain identical.

---

**Questions or Issues?** See `src/mocks/README.md` for detailed documentation.
