import HlsPrefetcherModule from '@/modules/hls-prefetcher';
import { logCacheStats } from '@/utils/cacheStatsFormatter';
import { useCallback, useEffect, useRef } from 'react';

interface UseVideoPrefetchOptions {
  playlists: string[];
  currentIndex: number;
  initialSegmentCount?: number;
  prefetchWindow?: number;
  extendedSegmentCount?: number;
}

/**
 * Custom hook for managing HLS video prefetching
 * Handles initial prefetch, adjacent video prefetch, and extended prefetch for long-viewed videos
 */
export function useVideoPrefetch({
  playlists,
  currentIndex,
  initialSegmentCount = 2,
  prefetchWindow = 2,
  extendedSegmentCount = 50,
}: UseVideoPrefetchOptions) {
  // Track which videos have been prefetched to avoid duplicates
  const prefetchedVideos = useRef(new Set<string>());
  const longViewedVideos = useRef(new Set<string>());

  /**
   * Prefetch videos adjacent to current index (within prefetch window)
   */
  const prefetchAdjacentVideos = useCallback(async (centerIndex: number) => {
    const indicesToPrefetch: number[] = [];
    
    // Prefetch videos within the window (previous and next)
    for (let i = -prefetchWindow; i <= prefetchWindow; i++) {
      const index = centerIndex + i;
      if (index >= 0 && index < playlists.length) {
        indicesToPrefetch.push(index);
      }
    }

    // Prefetch each video
    for (const index of indicesToPrefetch) {
      const videoUrl = playlists[index];
      
      // Skip if already prefetched
      if (prefetchedVideos.current.has(videoUrl)) {
        continue;
      }

      try {
        console.log(`[Prefetch] Starting prefetch for video ${index}: ${videoUrl}`);
        
        const result = await HlsPrefetcherModule.prefetchPlaylist(
          videoUrl,
          initialSegmentCount
        );
        
        prefetchedVideos.current.add(videoUrl);
        
        console.log(`[Prefetch] Completed video ${index}: ${result.prefetchedSegments}/${result.totalSegments} segments`);
      } catch (error) {
        console.warn(`[Prefetch] Error prefetching video ${index}:`, error);
      }
    }
  }, [playlists, initialSegmentCount, prefetchWindow]);

  /**
   * Prefetch remaining segments when user watches video for extended time
   */
  const prefetchRemainingSegments = useCallback(async (uri: string, videoIndex: number) => {
    // Skip if already prefetched all segments
    if (longViewedVideos.current.has(uri)) {
      return;
    }

    try {
      console.log(`[Prefetch] User watching video ${videoIndex}, prefetching remaining segments...`);
      
      // Prefetch a larger number of segments (or all by using a high number)
      const result = await HlsPrefetcherModule.prefetchPlaylist(uri, extendedSegmentCount);
      
      longViewedVideos.current.add(uri);
      
      console.log(`[Prefetch] Completed remaining segments for video ${videoIndex}: ${result.prefetchedSegments}/${result.totalSegments}`);
      
      // Log cache stats after successful prefetch
      const cacheStats = await HlsPrefetcherModule.getCacheStats();
      logCacheStats(cacheStats, videoIndex);
    } catch (error) {
      console.warn(`[Prefetch] Error prefetching remaining segments for video ${videoIndex}:`, error);
    }
  }, [extendedSegmentCount]);

  // Prefetch initial and adjacent videos on mount and when index changes
  useEffect(() => {
    prefetchAdjacentVideos(currentIndex);
  }, [currentIndex, prefetchAdjacentVideos]);

  return {
    prefetchRemainingSegments,
  };
}

