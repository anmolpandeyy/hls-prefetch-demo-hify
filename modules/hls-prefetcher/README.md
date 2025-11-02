# HLS Prefetcher Module

A React Native Expo module for prefetching HLS (HTTP Live Streaming) video segments to enable instant video playback in TikTok-style feeds.

## Overview

This module provides native-side HLS segment prefetching that works seamlessly with `react-native-video`. By prefetching video segments into the platform's native HTTP cache (URLSession cache on iOS, OkHttp cache on Android), videos play instantly when users scroll to them, eliminating loading delays.

## Features

- ✅ **Native Implementation**: Uses platform-native HTTP clients (URLSession on iOS, OkHttp on Android)
- ✅ **Shared Cache**: Prefetched segments are stored in the same cache used by video players (AVPlayer/ExoPlayer)
- ✅ **TypeScript Support**: Full TypeScript definitions included
- ✅ **Event-based**: Progress, completion, and error events for monitoring
- ✅ **Cache Management**: Clear cache and get statistics
- ✅ **Cross-platform**: Works on iOS, Android (web support available but prefetching not functional)

## Installation

### Prerequisites

- Expo SDK 54+ (or React Native 0.81+)
- `react-native-video` for video playback
- Native build required (not supported in Expo Go)

### Setup

1. **Copy the module** to your project:
   ```
   modules/hls-prefetcher/
   ```

2. **Rebuild native code**:
   ```bash
   # iOS
   cd ios && pod install && cd ..
   npx expo run:ios

   # Android
   npx expo run:android
   ```

3. **Import and use**:
   ```typescript
   import HlsPrefetcherModule from '@/modules/hls-prefetcher';
   ```

## API Reference

### Methods

#### `prefetchPlaylist(playlistUrl: string, segmentCount: number): Promise<PrefetchResult>`

Prefetches the first N segments of an HLS playlist into the native HTTP cache.

**Parameters:**
- `playlistUrl` (string): URL of the `.m3u8` playlist file
- `segmentCount` (number): Number of segments to prefetch

**Returns:** `Promise<PrefetchResult>`
```typescript
{
  success: boolean;
  totalSegments: number;
  prefetchedSegments: number;
  playlistUrl: string;
}
```

**Example:**
```typescript
const result = await HlsPrefetcherModule.prefetchPlaylist(
  'https://example.com/video.m3u8',
  2 // Prefetch first 2 segments
);
console.log(`Prefetched ${result.prefetchedSegments}/${result.totalSegments} segments`);
```

#### `cancelPrefetch(playlistUrl: string): void`

Cancels an ongoing prefetch operation for a specific playlist.

**Parameters:**
- `playlistUrl` (string): URL of the playlist to cancel

**Example:**
```typescript
HlsPrefetcherModule.cancelPrefetch('https://example.com/video.m3u8');
```

#### `clearCache(): void`

Clears all cached segments from the native HTTP cache.

**Example:**
```typescript
HlsPrefetcherModule.clearCache();
```

#### `getCacheStats(): Promise<CacheStats>`

Returns cache statistics (size, hit rate, etc.).

**Returns:** `Promise<CacheStats>`
```typescript
// iOS format
{
  currentDiskUsage: number;      // bytes
  diskCapacity: number;          // bytes
  currentMemoryUsage: number;    // bytes
  memoryCapacity: number;        // bytes
}

// Android format
{
  size: number;                  // bytes
  maxSize: number;               // bytes
  requestCount: number;
  hitCount: number;
  networkCount: number;
}
```

**Example:**
```typescript
const stats = await HlsPrefetcherModule.getCacheStats();
console.log(`Cache size: ${(stats.currentDiskUsage / 1024 / 1024).toFixed(2)} MB`);
```

### Events

Subscribe to prefetch events using Expo's event system:

```typescript
import { NativeEventEmitter } from 'react-native';
import HlsPrefetcherModule from '@/modules/hls-prefetcher';

const eventEmitter = new NativeEventEmitter(HlsPrefetcherModule);

// Listen for progress events
eventEmitter.addListener('onPrefetchProgress', (event) => {
  console.log(`Segment ${event.segmentIndex} prefetched: ${event.success}`);
});

// Listen for completion events
eventEmitter.addListener('onPrefetchComplete', (event) => {
  console.log(`Prefetch complete: ${event.prefetchedSegments}/${event.totalSegments}`);
});

// Listen for error events
eventEmitter.addListener('onPrefetchError', (event) => {
  console.error(`Prefetch error: ${event.error}`);
});
```

## Usage Example

### Basic Usage

```typescript
import HlsPrefetcherModule from '@/modules/hls-prefetcher';
import Video from 'react-native-video';

// Prefetch segments before video is played
async function prefetchVideo(playlistUrl: string) {
  try {
    const result = await HlsPrefetcherModule.prefetchPlaylist(playlistUrl, 2);
    console.log(`Ready to play: ${result.prefetchedSegments} segments cached`);
  } catch (error) {
    console.error('Prefetch failed:', error);
  }
}

// Later, the video player will automatically use cached segments
<Video
  source={{ uri: playlistUrl }}
  // Video plays instantly because segments are cached!
/>
```

### TikTok-Style Feed Example

```typescript
import { useCallback, useEffect } from 'react';
import HlsPrefetcherModule from '@/modules/hls-prefetcher';

function VideoFeed({ currentIndex, playlists }: Props) {
  // Prefetch adjacent videos
  useEffect(() => {
    const prefetchWindow = 2; // Prefetch 2 videos ahead/behind
    
    for (let i = -prefetchWindow; i <= prefetchWindow; i++) {
      const index = currentIndex + i;
      if (index >= 0 && index < playlists.length) {
        HlsPrefetcherModule.prefetchPlaylist(playlists[index], 2);
      }
    }
  }, [currentIndex, playlists]);

  // When user watches for 5+ seconds, prefetch remaining segments
  const handleLongView = useCallback(async (videoUrl: string) => {
    await HlsPrefetcherModule.prefetchPlaylist(videoUrl, 50);
  }, []);

  // ... render video feed
}
```

## How It Works

1. **Parse Playlist**: Module fetches the `.m3u8` file and parses segment URLs
2. **Prefetch Segments**: Downloads specified number of segments using native HTTP clients
3. **Cache Storage**: Segments are stored in platform's native HTTP cache:
   - **iOS**: `URLCache.shared` (same cache used by AVPlayer)
   - **Android**: OkHttp cache (50MB, accessible by ExoPlayer)
4. **Instant Playback**: When video player requests segments, they're already cached = instant playback!

## Platform Details

### iOS
- Uses `URLSession.shared` with `URLCache.shared`
- Cache is automatically shared with AVPlayer
- Supports concurrent prefetching with cancellation

### Android
- Uses OkHttp with a 50MB cache
- Cache directory: `context.cacheDir/okhttp-cache`
- ExoPlayer automatically uses OkHttp cache if available
- Uses Kotlin Coroutines for async operations

### Web
- Module exports but prefetching doesn't function (different cache mechanism)

## Dependencies

### Native Dependencies

**iOS:**
- Foundation framework (URLSession)
- No additional pods required

**Android:**
- `okhttp:4.12.0` (for HTTP and caching)
- `kotlinx-coroutines-android` (for async operations)

These are automatically included when you install the module.

## Configuration

### Android Cache Size

Default cache size is 50MB. To change it, edit:
```
modules/hls-prefetcher/android/src/main/java/expo/modules/hlsprefetcher/HlsPrefetcherModule.kt
```

Look for:
```kotlin
Cache(File(cacheDir, "okhttp-cache"), 50 * 1024 * 1024) // 50MB
```

### iOS Cache

iOS uses `URLCache.shared` which is managed by the system. No configuration needed.

## Troubleshooting

### Videos still show loading delay
- Check if prefetch completed successfully (check console logs)
- Verify cache isn't full (check cache stats)
- Ensure video URLs are accessible
- On Android, verify ExoPlayer is using the cache (check network logs)

### Prefetch errors
- Verify playlist URL is accessible
- Check network connectivity
- Some CDNs block automated requests (may need User-Agent headers)

### High memory usage
- Reduce segment count in prefetch calls
- Call `clearCache()` periodically
- Monitor cache stats

### Android build errors
- Ensure OkHttp dependency is installed: `cd android && ./gradlew app:dependencies | grep okhttp`
- Check Kotlin version compatibility
- Clean build: `cd android && ./gradlew clean`

## Limitations

1. **Shared Cache Dependency**: Relies on video player using the same HTTP cache. Works with AVPlayer (iOS) and ExoPlayer (Android) which are used by `react-native-video`.

2. **Playlist Format**: Currently supports standard HLS playlists. Doesn't handle:
   - Master playlists with multiple bitrates (uses whatever is in the provided m3u8)
   - DRM-protected streams

3. **Network Awareness**: Doesn't automatically adjust prefetch count based on network speed (could be added as enhancement).

4. **Cache Policies**: Cache eviction is managed by the OS/native libraries. Very large caches may be evicted on memory pressure.

## Best Practices

1. **Prefetch Strategy**:
   - Prefetch 2-5 initial segments for instant playback
   - Prefetch adjacent videos in a feed (±2 videos)
   - Prefetch remaining segments only if user watches for 5+ seconds

2. **Memory Management**:
   - Monitor cache size regularly
   - Clear cache when switching content categories
   - Don't prefetch too many videos at once

3. **Error Handling**:
   - Always wrap prefetch calls in try-catch
   - Handle network errors gracefully
   - Don't block UI if prefetch fails

4. **Testing**:
   - Test on both iOS and Android (different caching mechanisms)
   - Test with slow network conditions
   - Monitor cache hit rates

## License

This module is part of the TikTok HLS Demo project.

## Support

For issues or questions, please check:
- [React Native Video](https://github.com/TheWidlarzGroup/react-native-video)
- [Expo Modules](https://docs.expo.dev/modules/overview/)

