# Native HLS Prefetching Implementation

## Overview

This implementation provides native-side HLS segment prefetching for React Native, enabling instant video playback in a TikTok-style feed without forking `react-native-video`.

## How It Works

### Architecture

The solution uses **native HTTP cache prefetching** where:

1. **iOS**: Uses `URLSession` with `URLCache.shared` - the same cache used by AVPlayer
2. **Android**: Uses `OkHttp` with a cache that stores segments for reuse by ExoPlayer
3. **React Native**: TypeScript interface exposes prefetch methods to JavaScript

### Key Components

#### 1. Native Modules

**iOS** (`modules/hls-prefetcher/ios/HlsPrefetcherModule.swift`):
- Uses `URLSession.shared` which shares cache with AVPlayer
- Downloads m3u8 playlists and parses segment URLs
- Prefetches segments into the shared cache
- Supports concurrent prefetching with proper cancellation

**Android** (`modules/hls-prefetcher/android/src/main/java/expo/modules/hlsprefetcher/HlsPrefetcherModule.kt`):
- Uses OkHttp with a 50MB cache
- Downloads and caches segments using Kotlin coroutines
- Provides the same API as iOS for consistency

#### 2. TypeScript Interface

**Types** (`modules/hls-prefetcher/src/HlsPrefetcher.types.ts`):
- `PrefetchResult`: Result of a prefetch operation
- `PrefetchProgressEvent`: Progress events for individual segments
- `CacheStats`: Cache statistics (size, hit rate, etc.)

**Module** (`modules/hls-prefetcher/src/HlsPrefetcherModule.ts`):
```typescript
prefetchPlaylist(playlistUrl: string, segmentCount: number): Promise<PrefetchResult>
cancelPrefetch(playlistUrl: string): void
clearCache(): void
getCacheStats(): Promise<CacheStats>
```

#### 3. Feed Integration

**Feed Component** (`app/(tabs)/feed.tsx`):
- Prefetches videos adjacent to current video (±1 by default)
- Prefetches first 5 segments for instant playback
- When user watches for 5+ seconds, prefetches remaining segments
- Tracks prefetched videos to avoid duplicate requests
- Automatically handles index changes

## Prefetching Strategy

### Initial Prefetch (On Scroll)
- Prefetches **first 5 segments** of current, previous, and next videos
- Ensures instant playback when user swipes to new video
- Minimal data usage (~2-5MB per video depending on quality)

### Extended Prefetch (Long View)
- After 5 seconds of viewing, prefetches up to **50 more segments**
- Ensures smooth playback for longer videos
- Only triggered if user is actively watching

### Configuration
You can adjust these constants in `feed.tsx`:
```typescript
const INITIAL_SEGMENT_COUNT = 5;      // Segments to prefetch initially
const PREFETCH_WINDOW = 1;            // Videos to prefetch (±N)
```

## Cache Behavior

### iOS (URLCache)
- Shared cache with AVPlayer (automatic integration)
- Default size: 50MB memory, 500MB disk
- Cache policy: `returnCacheDataElseLoad`
- Expires based on HTTP cache headers from CDN

### Android (OkHttp Cache)
- 50MB dedicated cache for HLS segments
- Stored in app cache directory
- Automatically evicts old segments when full
- Shared with network requests

## Testing the Implementation

### Prerequisites
1. Rebuild the native modules:
```bash
# iOS
cd ios && pod install && cd ..
npx expo run:ios

# Android
npx expo run:android
```

### What to Test

#### 1. Instant Playback
- **Test**: Scroll to a new video
- **Expected**: Video starts playing immediately (within 100-200ms)
- **Check logs**: Look for `[Prefetch] Completed video X` messages

#### 2. Prefetch Behavior
- **Test**: Open the feed
- **Expected**: Console shows prefetch starting for videos 0, 1, 2
- **Check logs**: 
  ```
  [Prefetch] Starting prefetch for video 0: https://...
  [Prefetch] Completed video 0: 5/150 segments
  ```

#### 3. Long View Prefetch
- **Test**: Watch a video for 5+ seconds
- **Expected**: Additional segments are prefetched
- **Check logs**:
  ```
  [Prefetch] User watching video 0, prefetching remaining segments...
  [Prefetch] Completed remaining segments for video 0: 50/150
  ```

#### 4. Cache Efficiency
- **Test**: Scroll back to a previously viewed video
- **Expected**: Plays instantly without re-downloading
- **Check**: No new prefetch logs for that video URL

#### 5. Network Conditions
- **Test**: Enable slow network (Settings > Developer > Network Link Conditioner on iOS)
- **Expected**: First 5 segments load, playback starts, more segments load in background

### Debugging

#### Enable Verbose Logging

**iOS**: In Xcode, check console for:
- URLSession activity
- Prefetch progress events
- Cache hit/miss information

**Android**: Use `adb logcat | grep HlsPrefetcher` for:
- OkHttp cache activity
- Prefetch progress
- Coroutine execution

#### Check Cache Stats

Add this to your component:
```typescript
useEffect(() => {
  const checkCache = async () => {
    const stats = await HlsPrefetcherModule.getCacheStats();
    console.log('Cache stats:', stats);
  };
  checkCache();
}, []);
```

#### Clear Cache for Testing
```typescript
HlsPrefetcherModule.clearCache();
```

## Performance Optimization

### Current Settings (Optimized for Balance)
- **5 segments** initially = ~2-5MB per video
- **±1 video** prefetch = 3 videos total (current + neighbors)
- Total prefetch on scroll: ~6-15MB

### For Better Networks
```typescript
const INITIAL_SEGMENT_COUNT = 10;     // More instant playback time
const PREFETCH_WINDOW = 2;            // Prefetch 2 videos ahead/behind
```

### For Slower Networks
```typescript
const INITIAL_SEGMENT_COUNT = 3;      // Minimal prefetch
const PREFETCH_WINDOW = 0;            // Only current video
```

## Known Limitations

1. **Cache Coordination**: While we use the same cache system as the video players, there's no guarantee 100% of prefetched segments will be used if the CDN cache headers are very short-lived.

2. **Master Playlist**: Currently parses segment URLs from the playlist directly. Doesn't handle adaptive bitrate selection (uses whatever segments are in the provided m3u8).

3. **Network Awareness**: Doesn't automatically adjust prefetch count based on network speed (could be added as enhancement).

4. **Memory**: Large videos with many segments may require cache management on older devices.

## Trade-offs & Assumptions

### Why This Approach?

✅ **Pros**:
- No need to fork `react-native-video` (maintainability)
- Uses native caching mechanisms (efficient, OS-managed)
- Works with existing video player components
- Relatively simple implementation
- Cross-platform consistency

❌ **Cons**:
- Not 100% guaranteed cache hit (depends on cache policies)
- Can't control exact segment loading in the video player
- Requires rebuilding native code

### Alternative Approaches Considered

1. **Forking react-native-video**: More control, but high maintenance burden
2. **Custom video player**: Maximum control, but requires reimplementing all video player features
3. **JavaScript-only prefetch**: Doesn't work (different cache than native players)

## Future Enhancements

Potential improvements:
- [ ] Adaptive prefetch based on network speed
- [ ] Prefetch priority queue (prioritize visible videos)
- [ ] Smart segment selection (prefetch lower quality for distant videos)
- [ ] Analytics/metrics for prefetch effectiveness
- [ ] Background prefetch for feed preloading

## Troubleshooting

### Videos not playing instantly
- Check if prefetch completed (logs should show "Completed video X")
- Verify cache isn't full (check cache stats)
- Ensure video URLs are accessible
- Check network connectivity

### High memory usage
- Reduce `INITIAL_SEGMENT_COUNT`
- Reduce `PREFETCH_WINDOW`
- Call `clearCache()` periodically

### Prefetch not working on Android
- Verify OkHttp dependency is installed: `cd android && ./gradlew app:dependencies | grep okhttp`
- Check cache directory permissions
- Verify ExoPlayer can access cache

### iOS cache not shared with AVPlayer
- Verify using `URLSession.shared` (we are)
- Check if videos use HTTPS (required for caching)
- Verify CDN sends appropriate cache headers

## Summary

This implementation achieves the goal of **instant video playback** in a TikTok-style feed by:
1. Prefetching segments into native HTTP caches
2. Using the same cache as AVPlayer (iOS) and ExoPlayer (Android)
3. Intelligently prefetching adjacent videos
4. Extending prefetch when users watch videos

The result is a smooth, seamless video experience without forking external libraries.

