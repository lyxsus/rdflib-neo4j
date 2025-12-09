module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts', '**/*.test.ts', '**/*_test.ts'],
  maxWorkers: 1, // Run tests serially to avoid database conflicts
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
    '^.+\\.js$': ['babel-jest', {
      presets: [['@babel/preset-env', { modules: 'commonjs' }]],
    }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@rdfjs|n3)/)',
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  moduleFileExtensions: ['ts', 'js', 'json'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  testTimeout: 30000, // 30 second timeout per test
  forceExit: true, // Force exit after tests complete
};

