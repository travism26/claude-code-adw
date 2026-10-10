/**
 * Custom ESLint Rule: require-worker-error-listener
 *
 * Enforces worker reliability by requiring all BullMQ Worker instances to have
 * an error event listener attached.
 *
 * Without an error listener, worker errors can:
 * - Cause silent crashes
 * - Result in Node.js throwing unhandled error exceptions
 * - Make debugging production issues difficult
 *
 * According to BullMQ documentation:
 * "It is important to attach an error listener to the worker to avoid Node.js
 * throwing an unhandled error exception."
 *
 * This rule detects Worker instantiation and verifies that .on('error', ...) is
 * called on the worker instance within the same scope.
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require BullMQ Worker instances to have an error event listener attached.',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      missingErrorListener: 'BullMQ Worker "{{workerName}}" must have an error event listener attached. Add {{workerName}}.on(\'error\', (error) => { ... }) to handle worker errors and prevent silent crashes.',
      missingErrorListenerGeneric: 'BullMQ Worker instances must have an error event listener attached. Call .on(\'error\', (error) => { ... }) on the worker to handle errors and prevent silent crashes.',
    },
    schema: [], // No options
  },

  create(context) {
    // Track worker variables and whether they have error listeners
    const workerVariables = new Map(); // Map<variableName, node>
    const hasErrorListener = new Set(); // Set<variableName>
    const workerFunctionCalls = new Map(); // Map<variableName, Set<functionNames>>

    /**
     * Check if a node represents a Worker instantiation
     * Matches: new Worker(...) or new BullWorker(...)
     */
    function isWorkerInstantiation(node) {
      if (!node || node.type !== 'NewExpression') {
        return false;
      }

      const calleeName = node.callee.name;
      return calleeName === 'Worker' || calleeName === 'BullWorker';
    }

    /**
     * Check if a call expression is an error listener attachment
     * Matches: worker.on('error', ...) or worker.on("error", ...)
     */
    function isErrorListenerCall(node) {
      if (node.type !== 'CallExpression') {
        return false;
      }

      // Check if it's a .on() call
      if (node.callee.type !== 'MemberExpression' ||
          node.callee.property.type !== 'Identifier' ||
          node.callee.property.name !== 'on') {
        return false;
      }

      // Check if first argument is 'error' string literal
      if (node.arguments.length < 1) {
        return false;
      }

      const firstArg = node.arguments[0];
      return firstArg.type === 'Literal' && firstArg.value === 'error';
    }

    /**
     * Get the object name from a call expression
     * For worker.on('error', ...) returns 'worker'
     */
    function getCalleeName(node) {
      if (node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier') {
        return node.callee.object.name;
      }
      return null;
    }

    /**
     * Check if a function call might be adding an error listener indirectly
     * Matches: setupEventListeners(worker) or similar helper functions
     */
    function trackWorkerFunctionCall(node) {
      if (node.type !== 'CallExpression') {
        return;
      }

      // Check if this is a function call with a worker variable as an argument
      if (node.arguments.length > 0) {
        for (const arg of node.arguments) {
          if (arg.type === 'Identifier' && workerVariables.has(arg.name)) {
            const workerName = arg.name;
            if (!workerFunctionCalls.has(workerName)) {
              workerFunctionCalls.set(workerName, new Set());
            }

            // Get the function name being called
            let functionName = null;
            if (node.callee.type === 'Identifier') {
              functionName = node.callee.name;
            }

            if (functionName) {
              workerFunctionCalls.get(workerName).add(functionName);
            }
          }
        }
      }
    }

    return {
      // Track: const worker = new BullWorker(...)
      VariableDeclarator(node) {
        if (node.id.type === 'Identifier' && isWorkerInstantiation(node.init)) {
          const workerName = node.id.name;
          workerVariables.set(workerName, node);
        }
      },

      // Track: worker.on('error', ...)
      CallExpression(node) {
        // Check for direct error listener attachment
        if (isErrorListenerCall(node)) {
          const workerName = getCalleeName(node);
          if (workerName && workerVariables.has(workerName)) {
            hasErrorListener.add(workerName);
          }
        }

        // Track function calls that take worker as argument
        trackWorkerFunctionCall(node);
      },

      // Report missing error listeners at the end of the program
      'Program:exit'() {
        for (const [workerName, node] of workerVariables.entries()) {
          // Check if this worker has a direct error listener
          if (hasErrorListener.has(workerName)) {
            continue;
          }

          // Check if this worker was passed to a function (like setupEventListeners)
          // We'll assume these functions might handle error listener setup
          const functionCalls = workerFunctionCalls.get(workerName);
          if (functionCalls && functionCalls.size > 0) {
            // Common patterns that indicate error listener setup
            const setupPatterns = ['setup', 'init', 'configure', 'listener', 'event'];
            const hasSetupFunction = Array.from(functionCalls).some(fnName =>
              setupPatterns.some(pattern => fnName.toLowerCase().includes(pattern))
            );

            if (hasSetupFunction) {
              continue; // Assume the setup function handles error listeners
            }
          }

          // Report violation
          context.report({
            node,
            messageId: 'missingErrorListener',
            data: {
              workerName,
            },
          });
        }
      },
    };
  },
};
