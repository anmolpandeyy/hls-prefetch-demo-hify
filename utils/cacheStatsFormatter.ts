/**
 * Utility for formatting and logging cache statistics
 */

type IOSCacheStats = {
  currentDiskUsage: number;
  diskCapacity: number;
  currentMemoryUsage: number;
  memoryCapacity: number;
};

type AndroidCacheStats = {
  size: number;
  maxSize: number;
  requestCount: number;
  hitCount: number;
  networkCount: number;
};

type CacheStats = IOSCacheStats | AndroidCacheStats;

/**
 * Converts bytes to megabytes with 2 decimal places
 */
const formatMB = (bytes: number | undefined): string => {
  return bytes ? (bytes / (1024 * 1024)).toFixed(2) : '0.00';
};

/**
 * Logs formatted cache statistics to console
 */
export function logCacheStats(cacheStats: CacheStats, videoIndex: number): void {
  if ('currentDiskUsage' in cacheStats) {
    // iOS format
    const iosStats = cacheStats as IOSCacheStats;
    console.log(`[Cache Stats] After prefetching video ${videoIndex}:`);
    console.log(`  💾 Disk: ${formatMB(iosStats.currentDiskUsage)}MB / ${formatMB(iosStats.diskCapacity)}MB`);
    console.log(`  🧠 Memory: ${formatMB(iosStats.currentMemoryUsage)}MB / ${formatMB(iosStats.memoryCapacity)}MB`);
  } else if ('size' in cacheStats) {
    // Android format
    const androidStats = cacheStats as AndroidCacheStats;
    const hitRate = androidStats.requestCount > 0 
      ? ((androidStats.hitCount / androidStats.requestCount) * 100).toFixed(1)
      : '0.0';
    console.log(`[Cache Stats] After prefetching video ${videoIndex}:`);
    console.log(`  💾 Cache: ${formatMB(androidStats.size)}MB / ${formatMB(androidStats.maxSize)}MB`);
    console.log(`  📊 Requests: ${androidStats.requestCount} (${androidStats.hitCount} hits, ${androidStats.networkCount} network)`);
    console.log(`  ✅ Hit Rate: ${hitRate}%`);
  }
}

