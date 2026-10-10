// Quick test script
try {
  const parser = require('@typescript-eslint/parser');
  console.log('SUCCESS: Parser loaded', typeof parser);
  console.log('Parser object keys:', Object.keys(parser).slice(0, 5));
} catch (error) {
  console.log('FAILED to load parser:', error.message);
  console.log('Stack:', error.stack);
}
