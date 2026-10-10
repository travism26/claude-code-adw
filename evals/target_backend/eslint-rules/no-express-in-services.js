/**
 * Custom ESLint Rule: no-express-in-services
 *
 * Enforces service layer isolation from HTTP framework dependencies.
 * Prevents importing Express types (Request, Response, NextFunction) in service files.
 *
 * This maintains architectural boundaries:
 * Services should remain framework-agnostic so they can be reused by:
 * - API routes (Express-based)
 * - Background workers (BullMQ-based)
 * - CLI tools
 * - Tests
 *
 * Exception: Files in services middleware directories are allowed to import
 * Express types since middleware is inherently Express-specific.
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow Express type imports in service files. Services should remain framework-agnostic.',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      noExpressImport: 'Services should not import Express types ({{importedTypes}}). Keep services framework-agnostic so they can be reused by API routes, workers, and tests.',
      noExpressInService: 'Services should not import from the \'express\' package. Extract HTTP-specific logic to routes or middleware.',
    },
    schema: [], // No options
  },

  create(context) {
    const filename = context.getFilename();

    // Only apply this rule to files in the services directory
    if (!filename.includes('/services/') && !filename.includes('\\services\\')) {
      return {};
    }

    // Exclude middleware directories - they legitimately need Express types
    if (filename.includes('/middleware/') || filename.includes('\\middleware\\')) {
      return {};
    }

    // Exclude test files and migration files
    if (filename.includes('/tests/') || filename.includes('\\tests\\') ||
        filename.includes('.test.') || filename.includes('.spec.') ||
        filename.includes('/migrations/') || filename.includes('\\migrations\\')) {
      return {};
    }

    return {
      ImportDeclaration(node) {
        const importSource = node.source.value;

        // Check if importing from 'express' package
        if (importSource === 'express') {
          // Try to extract the imported type names
          let importedTypes = [];
          if (node.specifiers && node.specifiers.length > 0) {
            importedTypes = node.specifiers.map(spec => {
              if (spec.type === 'ImportSpecifier') {
                return spec.imported.name;
              }
              if (spec.type === 'ImportDefaultSpecifier') {
                return spec.local.name;
              }
              if (spec.type === 'ImportNamespaceSpecifier') {
                return `${spec.local.name}.*`;
              }
              return spec.local.name;
            });
          }

          // Report the violation with helpful context
          if (importedTypes.length > 0) {
            context.report({
              node,
              messageId: 'noExpressImport',
              data: {
                importedTypes: importedTypes.join(', '),
              },
            });
          } else {
            context.report({
              node,
              messageId: 'noExpressInService',
            });
          }
        }
      },
    };
  },
};
