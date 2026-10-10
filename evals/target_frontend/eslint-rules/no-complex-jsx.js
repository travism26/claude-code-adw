/**
 * ESLint Rule: no-complex-jsx
 *
 * Prevents deeply nested JSX (more than 7 levels).
 * Deep nesting is a sign that logic should be extracted into separate components.
 *
 * This enforces:
 * - Component composition
 * - Easier to read and maintain code
 * - Better component reusability
 *
 * Max depth: 7 levels (configurable)
 *
 * Note: Threshold increased from 5 to 7 to accommodate Chakra UI patterns
 * (e.g., Field.Root → Field.Label → Input, Card.Root → Card.Body → Grid → Box)
 */

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce maximum JSX nesting depth',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      tooDeep: 'JSX nesting is {{depth}} levels deep (max {{maxDepth}}). Extract nested elements into separate components.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          max: {
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
    const maxDepth = options.max || 7;

    // Only apply to component files
    const isComponentFile =
      (filename.endsWith('.tsx') || filename.endsWith('.jsx'));

    if (!isComponentFile) {
      return {};
    }

    // Calculate JSX depth by traversing up the tree
    function getJSXDepth(node) {
      let depth = 1;
      let parent = node.parent;
      while (parent) {
        if (parent.type === 'JSXElement' || parent.type === 'JSXFragment') {
          depth++;
        }
        parent = parent.parent;
      }
      return depth;
    }

    // Track reported nodes to avoid duplicates
    const reportedNodes = new Set();

    return {
      JSXElement(node) {
        const depth = getJSXDepth(node);
        if (depth > maxDepth && !reportedNodes.has(node)) {
          reportedNodes.add(node);
          context.report({
            node,
            messageId: 'tooDeep',
            data: {
              depth,
              maxDepth,
            },
          });
        }
      },
    };
  },
};
