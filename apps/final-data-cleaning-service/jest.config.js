module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testRegex: [
    '\\.(test|spec)\\.ts$',
  ],
  // e2e-real-data 直连真实 ClickHouse 并写入/删除数据，默认排除，需用 yarn test:e2e 显式运行
  testPathIgnorePatterns: [
    '/node_modules/',
    'e2e-real-data\\.test\\.ts$',
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json',
      diagnostics: false,
    }],
  },
  moduleNameMapper: {
    '^@probe-x/shared-types/src$': '<rootDir>/../../libs/shared-types/src/index.ts',
    '^@probe-x/shared-types/src/(.*)$': '<rootDir>/../../libs/shared-types/src/$1',
    '^@probe-x/shared-utils/src$': '<rootDir>/../../libs/shared-utils/src/index.ts',
    '^@probe-x/shared-utils/src/(.*)$': '<rootDir>/../../libs/shared-utils/src/$1',
    '^@probe-x/shared-utils$': '<rootDir>/../../libs/shared-utils/src/index.ts',
    '^@src/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/__tests__/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 15000,
};
