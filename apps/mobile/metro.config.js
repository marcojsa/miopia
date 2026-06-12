// Configuração Metro para monorepo npm workspaces (doc oficial Expo: Work with monorepos).
// O Metro precisa enxergar a raiz do monorepo (pacotes compartilhados + node_modules hoisted).
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..', '..');

const config = getDefaultConfig(projectRoot);

// 1. Observa todos os arquivos do monorepo (ex.: packages/shared)
config.watchFolders = [monorepoRoot];

// 2. Resolve dependências primeiro no node_modules do app, depois no da raiz (hoisted)
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = config;
