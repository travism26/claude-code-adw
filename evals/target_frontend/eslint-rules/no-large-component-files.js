/**
 * ESLint Rule: no-large-component-files
 *
 * Prevents component files from exceeding a maximum line count.
 * Large files are hard to maintain, test, and understand.
 *
 * When a component file grows too large, it's a sign that:
 * - Multiple responsibilities should be extracted to separate components
 * - Business logic should be moved to custom hooks
 * - Complex JSX should be broken into smaller components
 *
 * Max lines: 400 (configurable)
 */

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce maximum file length for component files',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      fileTooLong: 'Component file has {{lineCount}} lines (max {{maxLines}}). Consider breaking into smaller components or extracting logic to hooks.',
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
    const maxLines = options.max || 400;

    // Only apply to component files
    const isComponentFile =
      (filename.includes('components/') || filename.includes('routes/') || filename.includes('app/')) &&
      (filename.endsWith('.tsx') || filename.endsWith('.jsx'));

    if (!isComponentFile) {
      return {};
    }

    return {
      Program(node) {
        const sourceCode = context.getSourceCode();
        const lines = sourceCode.lines;
        const lineCount = lines.length;

        if (lineCount > maxLines) {
          context.report({
            node,
            messageId: 'fileTooLong',
            data: {
              lineCount,
              maxLines,
            },
          });
        }
      },
    };
  },
};
