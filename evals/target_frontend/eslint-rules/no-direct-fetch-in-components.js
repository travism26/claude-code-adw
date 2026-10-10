/**
 * ESLint Rule: no-direct-fetch-in-components
 *
 * Prevents direct fetch/axios calls in component files.
 * Components should use the centralized API layer (api/) and React Query hooks (hooks/).
 *
 * This enforces:
 * - Separation of concerns
 * - Reusable API logic
 * - Consistent error handling
 * - Easier testing and mocking
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow direct fetch/axios calls in components. Use api layer and hooks instead.',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      noDirectFetch: 'Direct {{method}} call found in component. Use the api/ layer with React Query hooks instead.',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename();

    // Only apply to component files (not api/, hooks/, utils/)
    const isComponentFile =
      (filename.includes('components/') || filename.includes('routes/') || filename.includes('app/')) &&
      (filename.endsWith('.tsx') || filename.endsWith('.jsx'));

    if (!isComponentFile) {
      return {};
    }

    return {
      CallExpression(node) {
        // Check for fetch() calls
        if (node.callee.name === 'fetch') {
          context.report({
            node,
            messageId: 'noDirectFetch',
            data: { method: 'fetch()' },
          });
        }

        // Check for axios calls (axios.get, axios.post, etc.)
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.object.name === 'axios'
        ) {
          context.report({
            node,
            messageId: 'noDirectFetch',
            data: { method: 'axios' },
          });
        }

        // Check for ApiClient direct calls (should use hooks instead)
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.object.name === 'ApiClient'
        ) {
          context.report({
            node,
            messageId: 'noDirectFetch',
            data: { method: 'ApiClient' },
          });
        }
      },
    };
  },
};
