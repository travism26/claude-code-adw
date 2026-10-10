/**
 * ESLint Rule: require-loading-error-states
 *
 * Ensures that components using React Query hooks (useQuery, useMutation)
 * handle loading and error states.
 *
 * This prevents:
 * - Blank screens during loading
 * - Unhandled errors causing crashes
 * - Poor user experience
 *
 * Example:
 *   const { data, isLoading, error } = useQuery(...);
 *
 *   if (isLoading) return <Loading />;
 *   if (error) return <Error />;
 *
 *   return <div>{data}</div>;
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require loading and error state handling for React Query hooks',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      missingLoadingState: 'useQuery/useMutation result "{{name}}" is missing loading state check. Add: if ({{name}}.isLoading) return <Loading />;',
      missingErrorState: 'useQuery/useMutation result "{{name}}" is missing error state check. Add: if ({{name}}.error) return <Error />;',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename();

    // Only apply to component files
    const isComponentFile =
      (filename.includes('components/') || filename.includes('routes/') || filename.includes('app/')) &&
      (filename.endsWith('.tsx') || filename.endsWith('.jsx'));

    if (!isComponentFile) {
      return {};
    }

    // Track useQuery/useMutation variable names and if they're checked
    const queryVars = new Map(); // { varName: { hasLoadingCheck: bool, hasErrorCheck: bool, node } }

    return {
      // Track useQuery/useMutation declarations
      VariableDeclarator(node) {
        if (
          node.init &&
          node.init.type === 'CallExpression' &&
          node.init.callee.name &&
          ['useQuery', 'useMutation', 'useInfiniteQuery'].includes(node.init.callee.name)
        ) {
          // Get the destructured variable name or direct assignment
          if (node.id.type === 'ObjectPattern') {
            // const { data, isLoading, error } = useQuery(...)
            // We'll track the whole object, but for simplicity, check if isLoading/error are destructured
            const hasLoading = node.id.properties.some(
              prop => prop.key && (prop.key.name === 'isLoading' || prop.key.name === 'isPending')
            );
            const hasError = node.id.properties.some(
              prop => prop.key && prop.key.name === 'error'
            );

            // If they destructure the states, they're likely using them (we'll verify later)
            if (hasLoading && hasError) {
              // Both destructured, assume they're handled (we could do deeper analysis)
              return;
            }
          } else if (node.id.type === 'Identifier') {
            // const query = useQuery(...)
            const varName = node.id.name;
            queryVars.set(varName, {
              hasLoadingCheck: false,
              hasErrorCheck: false,
              node,
            });
          }
        }
      },

      // Track member access like query.isLoading, query.error
      MemberExpression(node) {
        if (node.object.type === 'Identifier' && queryVars.has(node.object.name)) {
          const varName = node.object.name;
          const entry = queryVars.get(varName);

          if (node.property.name === 'isLoading' || node.property.name === 'isPending') {
            entry.hasLoadingCheck = true;
          }
          if (node.property.name === 'error') {
            entry.hasErrorCheck = true;
          }
        }
      },

      // Use last child of Program to run after all nodes are visited
      'Program > :last-child'() {
        for (const [varName, entry] of queryVars.entries()) {
          if (!entry.hasLoadingCheck) {
            context.report({
              node: entry.node,
              messageId: 'missingLoadingState',
              data: { name: varName },
            });
          }
          if (!entry.hasErrorCheck) {
            context.report({
              node: entry.node,
              messageId: 'missingErrorState',
              data: { name: varName },
            });
          }
        }
      },
    };
  },
};
