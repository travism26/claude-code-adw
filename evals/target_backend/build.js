const esbuild = require('esbuild');
const { copy } = require('esbuild-plugin-copy');
const fs = require('fs');
const path = require('path');

// Function to get all TypeScript files recursively, excluding test files
function getTypeScriptFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    // Skip test files and test directories
    if (item === 'tests' || item.includes('.test.') || item.includes('.spec.')) {
      continue;
    }
    
    if (stat.isDirectory()) {
      files.push(...getTypeScriptFiles(fullPath));
    } else if (item.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Get all TypeScript files from src directory
const srcDir = path.join(__dirname, 'src');
const tsFiles = getTypeScriptFiles(srcDir);

// Create entry points object
const entryPoints = {};
tsFiles.forEach(file => {
  const relativePath = path.relative(srcDir, file);
  // Just remove the .ts extension, let esbuild add .js
  const outputPath = relativePath.replace('.ts', '');
  entryPoints[outputPath] = file;
});

esbuild.build({
  entryPoints,
  bundle: true,
  outdir: 'dist',
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  external: [
    'pg-native',
    '@types/jest',
    'jest',
    'mocha',
    // Add any other packages that should be excluded from the bundle
    'sequelize',
    'pg',
    'pg-hstore',
    'umzug'
  ],
  plugins: [
    copy({
      resolveFrom: 'cwd',
      assets: {
        from: ['src/migrations/*.js'],
        to: ['dist/migrations'],
      },
    }),
  ],
}).catch(() => process.exit(1));
