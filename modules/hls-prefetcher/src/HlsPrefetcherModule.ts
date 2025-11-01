import { NativeModule, requireNativeModule } from 'expo';

import { HlsPrefetcherModuleEvents, PrefetchResult, CacheStats } from './HlsPrefetcher.types';

declare class HlsPrefetcherModule extends NativeModule<HlsPrefetcherModuleEvents> {
  /**
   * Prefetch the first N segments of an HLS playlist
   * @param playlistUrl - The URL of the .m3u8 playlist
   * @param segmentCount - Number of segments to prefetch (default: 5)
   * @returns Promise with prefetch result
   */
  prefetchPlaylist(playlistUrl: string, segmentCount: number): Promise<PrefetchResult>;
  
  /**
   * Cancel an ongoing prefetch operation for a specific playlist
   * @param playlistUrl - The URL of the playlist to cancel
   */
  cancelPrefetch(playlistUrl: string): void;
  
  /**
   * Clear all prefetch cache
   */
  clearCache(): void;
  
  /**
   * Get cache statistics
   * @returns Promise with cache statistics
   */
  getCacheStats(): Promise<CacheStats>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<HlsPrefetcherModule>('HlsPrefetcher');
