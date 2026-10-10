/**
 * Custom ESLint Rule: no-model-in-routes
 *
 * Enforces service layer pattern by preventing direct model imports in route files.
 * Routes should import from services, which then interact with models.
 *
 * This maintains architectural boundaries:
 * Routes → Services → Models
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow direct model imports in route files. Routes should use services.',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      noModelImport: 'Routes should not directly import models. Use the {{serviceName}} service instead.',
      noModelPath: 'Routes should not import from the models directory. Use services for data access.',
    },
    schema: [], // No options
  },

  create(context) {
    const filename = context.getFilename();

    // Only apply this rule to files in the routes directory
    if (!filename.includes('/routes/') && !filename.includes('\\routes\\')) {
      return {};
    }

    return {
      ImportDeclaration(node) {
        const importSource = node.source.value;

        // Check if importing from models directory
        if (importSource.includes('../models') || importSource.includes('./models')) {
          // Try to determine which service should be used based on the model name
          let serviceName = 'appropriate';

          // Extract model names from the import
          if (node.specifiers && node.specifiers.length > 0) {
            const firstImport = node.specifiers[0];
            if (firstImport.type === 'ImportSpecifier' || firstImport.type === 'ImportDefaultSpecifier') {
              const modelName = firstImport.local.name;
              // Convert model name to service name (e.g., User -> UserService, Plant -> PlantService)
              serviceName = `${modelName}Service`;
            }
          }

          context.report({
            node,
            messageId: importSource.includes('..') ? 'noModelImport' : 'noModelPath',
            data: {
              serviceName,
            },
          });
        }

        // Also catch index imports from models
        if (importSource === '../models' || importSource === './models') {
          context.report({
            node,
            messageId: 'noModelPath',
            data: {
              serviceName: 'appropriate',
            },
          });
        }
      },
    };
  },
};
