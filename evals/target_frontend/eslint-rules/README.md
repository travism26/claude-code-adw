# Frontend ESLint Custom Rules

This directory contains custom ESLint rules for enforcing frontend architectural patterns and best practices.

## Current Rules

Currently, no custom rules are defined. This infrastructure is in place to support staged deployment of architectural rules.

## Adding New Rules

To add a new custom rule:

1. Create a new file in this directory (e.g., `no-direct-api-calls-in-components.js`)
2. Export an ESLint rule following the ESLint rule format
3. The rule will be automatically loaded by `scripts/validate-architecture.js`
4. Add the rule name and configuration to the validation script

### Example Rule Structure

```javascript
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Description of what the rule enforces',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      messageId: 'Error message template',
    },
  },
  create(context) {
    return {
      // Rule implementation
    };
  },
};
```

## Future Rule Ideas

Potential rules to implement in stages:

- **no-direct-api-calls-in-components**: Enforce API calls through hooks only
- **require-error-boundaries**: Ensure components that may error have error boundaries
- **no-inline-styles**: Prevent inline styles in favor of Tailwind/CSS modules
- **require-loading-states**: Ensure async operations display loading states
- **require-accessibility-attrs**: Enforce aria-labels and semantic HTML
- **no-console-in-production**: Prevent console.log in production builds
- **prefer-custom-hooks**: Enforce business logic extraction to custom hooks
- **require-prop-types**: Ensure components have proper TypeScript types

## Testing Rules

Test custom rules by running:

```bash
npm run validate:architecture:json
```

## Deployment Strategy

Rules should be deployed in stages:

1. **Stage 1**: Add rule in warning mode, fix violations
2. **Stage 2**: Promote to error mode after all violations are fixed
3. **Stage 3**: Add to CI/CD pipeline
