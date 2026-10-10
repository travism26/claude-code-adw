/**
 * ESLint Rule: no-console-in-components
 *
 * Prevents console.log/warn/error in component files.
 * Console statements should be removed before production.
 *
 * Allowed in:
 * - utils/ directory (debugging utilities)
 * - Development-only code blocks
 *
 * Use proper error boundaries and logging instead.
 */

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow console statements in component files',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      noConsole: 'Unexpected console.{{method}} statement in component. Remove before production or use proper error handling.',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename();

    // Only apply to component files (not utils/, api/, etc.)
    const isComponentFile =
      (filename.includes('components/') || filename.includes('routes/') || filename.includes('app/')) &&
      (filename.endsWith('.tsx') || filename.endsWith('.jsx'));

    // Allowed in utils and other non-component files
    if (!isComponentFile) {
      return {};
    }

    return {
      MemberExpression(node) {
        if (
          node.object.name === 'console' &&
          ['log', 'warn', 'error', 'info', 'debug'].includes(node.property.name)
        ) {
          context.report({
            node,
            messageId: 'noConsole',
            data: {
              method: node.property.name,
            },
          });
        }
      },
    };
  },
};
