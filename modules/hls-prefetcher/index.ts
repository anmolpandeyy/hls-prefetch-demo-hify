// Reexport the native module. On web, it will be resolved to HlsPrefetcherModule.web.ts
// and on native platforms to HlsPrefetcherModule.ts
export * from './src/HlsPrefetcher.types';
export { default } from './src/HlsPrefetcherModule';

