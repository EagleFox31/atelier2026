import type { Config } from '@stryker-mutator/core';

const config: Config = {
  testRunner: 'jest',
  jest: {
    configFile: 'jest.config.ts',
    projectType: 'custom',
    config: {
      testPathIgnorePatterns: [
        '/node_modules/',
        '.*integration.*',
        '.*contract.*',
      ],
    },
  },

  // Cible : logique métier des services uniquement
  mutate: [
    'src/modules/**/*.service.ts',
    '!src/**/__tests__/**',
    '!src/**/*.spec.ts',
    '!src/modules/auth/jwt-secrets.service.ts', // lecture env uniquement
  ],

  reporters: ['html', 'progress', 'clear-text'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },

  // Analyse de couverture par test → réduit fortement le temps d'exécution
  coverageAnalysis: 'perTest',

  // Timeouts généreux pour NestJS (démarrage app dans chaque sandbox)
  timeoutMS: 15000,
  timeoutFactor: 3,

  // Parallélisme : moitié des cœurs pour ne pas saturer la machine
  concurrency: 4,

  // Seuil minimum acceptable
  thresholds: { high: 80, low: 60, break: 50 },

  ignoreStatic: true,
};

export default config;
