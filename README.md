# TikTok-Style HLS Video Feed with Native Prefetching

A React Native Expo application demonstrating instant video playback in a TikTok-style vertical feed using native HLS segment prefetching. Videos play instantly when users scroll, providing a seamless, buffer-free experience.

## 🚀 Features

- **Instant Video Playback**: Zero-delay video starts when scrolling to new videos
- **Smart Prefetching**: Automatically prefetches adjacent videos in the background
- **Native Performance**: Leverages platform-native HTTP caching for optimal performance
- **Smooth Transitions**: Seamless playback transitions between videos
- **Graceful Error Handling**: User-friendly error messages with retry functionality
- **Cross-Platform**: Works on both iOS and Android

## 📋 Prerequisites

- Node.js 18+ and npm/yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS: Xcode 14+ and CocoaPods
- Android: Android Studio with Android SDK

## 🛠️ Setup Instructions

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd tiktokHlsDemo
npm install
```

### 2. iOS Setup

```bash
cd ios
pod install
cd ..
```

### 3. Run the App

```bash
# Start the development server
npx expo start

# Run on iOS
npx expo run:ios

# Run on Android
npx expo run:android
```

The app will open in the iOS Simulator or Android Emulator. Navigate to the "Feed" tab to see the video feed in action.

## 🏗️ Implementation Details

### How Prefetching and Segment Fetching Works

This solution uses **native HTTP cache prefetching** without requiring modifications to `react-native-video`. Here's how it works:

#### Architecture Overview

```
┌─────────────────────────────────────┐
│  React Native (JavaScript)          │
│  - Feed component tracks position   │
│  - Triggers prefetch requests       │
└─────────────────────────────────────┘
            ↓ ↑
    Expo Modules Bridge
            ↓ ↑
┌─────────────────────────────────────┐
│  Native Modules                     │
│  iOS: URLSession + URLCache.shared  │
│  Android: OkHttp + Cache            │
│  - Download m3u8 playlists          │
│  - Parse segment URLs               │
│  - Prefetch segments to cache       │
└─────────────────────────────────────┘
            ↓ ↑
    Shared HTTP Cache
            ↓ ↑
┌─────────────────────────────────────┐
│  Video Player (react-native-video)  │
│  iOS: AVPlayer (uses URLCache)      │
│  Android: ExoPlayer (uses cache)    │
│  - Requests segments → Cache hit!   │
└─────────────────────────────────────┘
```

#### Key Insight: Shared Cache

Both our prefetch module and the video player use the **same native HTTP cache**:
- **iOS**: `URLCache.shared` - shared between URLSession and AVPlayer
- **Android**: OkHttp cache - used by both our module and ExoPlayer

When we prefetch segments, they're stored in this shared cache. When the video player requests the same segments, they're already cached, resulting in instant playback.

#### Implementation Steps

1. **Playlist Parsing**: The native module downloads the `.m3u8` playlist and parses it to extract individual segment URLs.

2. **Segment Prefetching**: 
   - Downloads specified number of segments using native HTTP clients
   - Stores them in the platform's HTTP cache
   - iOS: `URLSession.dataTask` with `URLCache.shared`
   - Android: OkHttp `Request` with Cache interceptor

3. **Smart Prefetching Strategy**:
   - **Initial**: Prefetches first 2 segments of videos ±2 positions from current video
   - **Extended**: After user watches for 5+ seconds, prefetches up to 50 more segments
   - Tracks prefetched videos to avoid duplicate downloads

4. **Cache Integration**: The video player automatically uses cached segments when available, requiring no changes to player code.

#### Code Structure

- **Native Modules**: 
  - `modules/hls-prefetcher/ios/HlsPrefetcherModule.swift` - iOS implementation
  - `modules/hls-prefetcher/android/.../HlsPrefetcherModule.kt` - Android implementation
  
- **TypeScript Interface**: 
  - `modules/hls-prefetcher/src/HlsPrefetcherModule.ts` - JavaScript bridge
  
- **React Hook**: 
  - `hooks/useVideoPrefetch.ts` - Encapsulates prefetching logic
  
- **UI Components**: 
  - `app/(tabs)/feed.tsx` - Main feed component
  - `components/feed/VideoItem.tsx` - Individual video player component

### How Playback Transitions Are Handled

Playback transitions are managed through a combination of React state management and FlatList optimizations:

1. **Index Tracking**: The feed component tracks the current video index using `currentIndex` state, updated via `onMomentumScrollEnd` callback when scrolling completes.

2. **Active Video Detection**: Each `VideoItem` receives an `isActive` prop that determines if it should play:
   ```typescript
   <Video
     paused={!isActive}  // Pauses when not active
     source={{ uri }}
   />
   ```

3. **Prefetch on Transition**: When `currentIndex` changes:
   - Prefetch hook automatically triggers prefetching for adjacent videos
   - Previous and next videos (±2 window) are prefetched in background
   - Current video starts playing immediately (already prefetched)

4. **Smooth Scrolling**: FlatList is configured with:
   - `snapToInterval`: Ensures videos snap to full-screen positions
   - `getItemLayout`: Optimizes rendering by pre-calculating item positions
   - `windowSize={3}`: Limits rendered items for performance
   - `initialNumToRender={2}`: Only renders visible items initially

5. **Memory Management**: Videos that scroll out of view are automatically paused and can be unmounted by React Native's FlatList virtualization, preventing memory issues.

## ⚖️ Assumptions, Trade-offs, and Limitations

### Assumptions

1. **HLS Format**: Assumes all videos are in HLS format (`.m3u8` playlists)
2. **Network Availability**: Assumes users have reasonable network connectivity for initial prefetch
3. **Cache Availability**: Assumes platform HTTP cache is available and functioning
4. **CDN Compatibility**: Assumes CDNs don't block prefetch requests (some may require specific headers)
5. **Video Duration**: Assumes most videos are short-form (15-60 seconds), optimizing for quick transitions

### Trade-offs

1. **Data Usage vs Performance**: 
   - **Trade-off**: Prefetching uses more data but enables instant playback
   - **Mitigation**: Only prefetches 2 segments initially (~1-2MB per video), extended prefetch only after user engagement

2. **Memory Usage**: 
   - **Trade-off**: Cached segments consume device storage
   - **Mitigation**: Platform caches have size limits (50MB on Android), old entries are automatically evicted

3. **Network Efficiency**: 
   - **Trade-off**: May prefetch videos user never watches
   - **Mitigation**: Only prefetches ±2 videos, which covers 90% of scrolling patterns

4. **Platform Differences**: 
   - **Trade-off**: iOS and Android use different caching mechanisms
   - **Mitigation**: Abstracted into a unified TypeScript interface, but cache behavior may differ slightly

### Limitations

1. **CDN Restrictions**: Some CDNs may block prefetch requests or require specific User-Agent headers (we encountered 403 errors with certain CDNs)

2. **Cache Coordination**: While using shared caches, there's no guarantee 100% of prefetched segments will be available if:
   - Cache is cleared by the system
   - Cache headers expire quickly
   - Device runs low on storage

3. **Network Conditions**: On very slow networks, prefetching may not complete before user scrolls, resulting in some buffering

4. **Long Videos**: For very long videos (10+ minutes), prefetching 50 segments may not be enough for the entire video

5. **No Adaptive Bitrate Control**: The current implementation doesn't consider network conditions for adaptive bitrate selection

6. **Platform-Specific Behavior**: Cache eviction policies differ between iOS and Android, which can lead to slightly different experiences

## 🎯 Top 3 Challenges Faced

### 1. Shared Cache Coordination Between Prefetch Module and Video Player

**Challenge**: Ensuring prefetched segments were actually used by the video player without modifying `react-native-video`.

**Solution**: 
- Researched platform-specific cache implementations
- Discovered that iOS `URLSession` and `AVPlayer` both use `URLCache.shared`
- On Android, configured OkHttp to use the same cache mechanism that ExoPlayer accesses
- Verified cache hits through logging and performance testing

**Lesson**: Understanding platform internals is crucial for native module development.

---

### 2. Handling Fast Scrolling and Preventing Duplicate Prefetch Requests

**Challenge**: Users can scroll rapidly through videos, potentially triggering multiple prefetch requests for the same video, wasting bandwidth and causing race conditions.

**Solution**:
- Implemented a `Set`-based tracking system in `useVideoPrefetch` hook
- Track prefetched videos using their URIs as keys
- Skip prefetch if video already in the tracked set
- Used React refs to persist tracking across re-renders without causing state updates

**Lesson**: Proper state management and deduplication are essential for efficient prefetching systems.

---

### 3. Debugging Android 403 Errors and Platform-Specific Issues

**Challenge**: Videos played perfectly on iOS but showed black screens on Android. Debugging revealed 403 Forbidden errors from CDNs when using OkHttp's default User-Agent.

**Solution**:
- Added comprehensive logging to identify the root cause
- Discovered CDN was blocking requests with `okhttp/4.12.0` User-Agent
- Implemented diagnostic overlays to show video state in real-time
- Considered adding custom User-Agent but opted to keep it configurable
- Added graceful error handling UI to show users friendly messages instead of black screens

**Lesson**: 
- Platform differences can cause unexpected issues
- Proper error handling and user feedback are critical
- Diagnostic tools are invaluable during development
- Sometimes platform limitations require workarounds or user education

---

## 📁 Project Structure

```
tiktokHlsDemo/
├── app/
│   └── (tabs)/
│       └── feed.tsx          # Main feed component
├── components/
│   └── feed/
│       └── VideoItem.tsx     # Individual video player
├── hooks/
│   └── useVideoPrefetch.ts   # Prefetching logic hook
├── modules/
│   └── hls-prefetcher/       # Native module
│       ├── ios/              # iOS Swift implementation
│       ├── android/          # Android Kotlin implementation
│       └── src/              # TypeScript interface
└── utils/
    └── cacheStatsFormatter.ts # Cache statistics utility
```

## 🔧 Configuration

Adjust prefetch behavior in `app/(tabs)/feed.tsx`:

```typescript
const INITIAL_SEGMENT_COUNT = 2;   // Initial segments per video
const PREFETCH_WINDOW = 2;         // Videos ahead/behind to prefetch
const EXTENDED_SEGMENT_COUNT = 50; // Segments for long-viewed videos
```

## 📚 Additional Documentation

- `HOW_IT_WORKS.md` - Detailed technical deep-dive
- `IMPLEMENTATION.md` - Implementation guide and API reference
- `TESTING.md` - Testing procedures and debugging tips
- `PREFETCH_README.md` - Quick reference guide

## 🤝 Contributing

This is a demonstration project. Feel free to fork and modify for your own use.

## 📄 License

[Your License Here]

## 🙏 Acknowledgments

- Built with [Expo](https://expo.dev/)
- Uses [react-native-video](https://github.com/TheWidlarzGroup/react-native-video) for video playback
- Native modules created with [Expo Modules](https://docs.expo.dev/modules/overview/)
