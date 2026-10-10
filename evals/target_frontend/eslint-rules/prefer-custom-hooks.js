/**
 * ESLint Rule: prefer-custom-hooks
 *
 * Encourages extraction of complex useState/useEffect logic into custom hooks.
 * This is detected when a component has:
 * - More than 3 useState calls
 * - More than 2 useEffect calls
 *
 * Benefits:
 * - Reusable stateful logic
 * - Easier testing
 * - Cleaner component code
 * - Better separation of concerns
 */

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Suggest extracting complex state logic into custom hooks',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      tooManyStateHooks: 'Component has {{count}} useState calls (max 3). Consider extracting state logic to a custom hook.',
      tooManyEffectHooks: 'Component has {{count}} useEffect calls (max 2). Consider extracting side effects to a custom hook.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          maxUseState: {
            type: 'integer',
            minimum: 1,
          },
          maxUseEffect: {
            type: 'integer',
            minimum: 1,
          },
        },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    const filename = context.getFilename();
    const options = context.options[0] || {};
    const maxUseState = options.maxUseState || 3;
    const maxUseEffect = options.maxUseEffect || 2;

    // Only apply to component files (not custom hooks themselves)
    const isComponentFile =
      (filename.includes('components/') || filename.includes('routes/') || filename.includes('app/')) &&
      !filename.includes('hooks/') &&
      (filename.endsWith('.tsx') || filename.endsWith('.jsx'));

    if (!isComponentFile) {
      return {};
    }

    // Track components and their hook usage
    const componentHookCounts = new Map();

    // Helper to get component name from function node
    function getComponentName(node) {
      if (node.type === 'FunctionDeclaration' && node.id) {
        return node.id.name;
      }
      if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') {
        if (node.parent && node.parent.type === 'VariableDeclarator' && node.parent.id) {
          return node.parent.id.name;
        }
      }
      return null;
    }

    // Find containing component for a CallExpression
    function findContainingComponent(node) {
      let current = node.parent;
      while (current) {
        if (current.type === 'FunctionDeclaration' ||
            current.type === 'ArrowFunctionExpression' ||
            current.type === 'FunctionExpression') {
          const name = getComponentName(current);
          if (name && /^[A-Z]/.test(name)) {
            return { node: current, name };
          }
        }
        current = current.parent;
      }
      return null;
    }

    return {
      CallExpression(node) {
        if (!node.callee.name || !['useState', 'useEffect'].includes(node.callee.name)) {
          return;
        }

        const component = findContainingComponent(node);
        if (!component) return;

        if (!componentHookCounts.has(component.name)) {
          componentHookCounts.set(component.name, {
            node: component.node,
            useStateCount: 0,
            useEffectCount: 0,
          });
        }

        const counts = componentHookCounts.get(component.name);
        if (node.callee.name === 'useState') {
          counts.useStateCount++;
        } else if (node.callee.name === 'useEffect') {
          counts.useEffectCount++;
        }
      },

      Program() {
        // Using Program listener to process at the end
        // We'll process in the next tick to ensure all CallExpressions are visited
      },

      // Use 'Program[body]' as a way to run after AST is fully traversed
      'Program > :last-child'() {
        // This runs after the last child of Program is visited
        for (const [, entry] of componentHookCounts.entries()) {
          if (entry.useStateCount > maxUseState) {
            context.report({
              node: entry.node,
              messageId: 'tooManyStateHooks',
              data: { count: entry.useStateCount },
            });
          }
          if (entry.useEffectCount > maxUseEffect) {
            context.report({
              node: entry.node,
              messageId: 'tooManyEffectHooks',
              data: { count: entry.useEffectCount },
            });
          }
        }
      },
    };
  },
};
