# Testing Guide - Native HLS Prefetching

## Quick Start

### 1. Rebuild Native Modules

The native modules have been updated, so you need to rebuild:

#### iOS
```bash
cd ios
pod install
cd ..
npx expo run:ios
```

#### Android
```bash
npx expo run:android
```

### 2. Open the Feed Tab

Once the app launches, navigate to the Feed tab to see the video feed.

## What to Expect

### Immediate Behavior
When the app loads:
1. Console will show prefetch starting for videos 0, 1, and 2
2. First video should start playing instantly
3. You should see logs like:
   ```
   [Prefetch] Starting prefetch for video 0: https://...
   [Prefetch] Completed video 0: 5/150 segments
   ```

### Scrolling Behavior
When you swipe to the next video:
1. Video should start playing **instantly** (within 100-200ms)
2. No loading spinner or buffering delay
3. Console shows prefetch starting for the next adjacent video

### Long View Behavior
After watching a video for 5+ seconds:
1. Console shows: `[Prefetch] User watching video X, prefetching remaining segments...`
2. Additional segments are prefetched in the background
3. Video continues playing smoothly

## Test Scenarios

### ✅ Test 1: Initial Load
**Action**: Launch app and go to Feed tab  
**Expected**:
- First video plays immediately
- Console shows prefetch for videos 0, 1, 2
- No errors in console

**Success Criteria**:
- Video playback starts within 1 second
- At least 5 segments prefetched per video

---

### ✅ Test 2: Scroll to Next Video
**Action**: Swipe up to go to the next video  
**Expected**:
- Video starts playing instantly (no loading)
- Smooth transition
- Console shows prefetch for the new adjacent video

**Success Criteria**:
- Playback starts within 200ms
- No visible loading spinner

---

### ✅ Test 3: Scroll Back to Previous Video
**Action**: Swipe down to return to a previously viewed video  
**Expected**:
- Video plays instantly (already cached)
- No new prefetch logs for that video URL
- Smooth transition

**Success Criteria**:
- Instant playback (cache hit)
- No network requests for that video

---

### ✅ Test 4: Long View Prefetch
**Action**: Watch a video for 5+ seconds  
**Expected**:
- Console shows prefetch of remaining segments
- Video continues playing without interruption
- Logs show: `Completed remaining segments for video X: 50/150`

**Success Criteria**:
- Background prefetch doesn't affect playback
- Additional segments successfully cached

---

### ✅ Test 5: Rapid Scrolling
**Action**: Quickly swipe through multiple videos  
**Expected**:
- Each video starts playing instantly
- Prefetch keeps up with scrolling
- No crashes or memory issues

**Success Criteria**:
- Smooth scrolling experience
- Videos play without buffering

---

### ✅ Test 6: Network Conditions

#### iOS - Enable Slow Network
1. Settings → Developer → Network Link Conditioner
2. Enable "3G" or "Edge" profile
3. Test video playback

#### Android - Limit Network Speed
1. Use Android Studio → Network Profiler
2. Or use developer options to limit bandwidth

**Expected**:
- First 5 segments load and video starts playing
- Additional segments load in background
- No playback interruption

**Success Criteria**:
- Video still starts within 2-3 seconds
- Prefetch completes without errors

---

## Monitoring & Debugging

### Console Logs to Watch For

**Successful Prefetch**:
```
[Prefetch] Starting prefetch for video 0: https://assets.hify.club/...
[Prefetch] Completed video 0: 5/150 segments
```

**Long View Trigger**:
```
[Prefetch] User watching video 0, prefetching remaining segments...
[Prefetch] Completed remaining segments for video 0: 50/150
```

**Error Handling**:
```
[Prefetch] Error prefetching video 0: <error message>
```

### Check Cache Statistics

Add this to `feed.tsx` temporarily to see cache stats:

```typescript
useEffect(() => {
  const interval = setInterval(async () => {
    try {
      const stats = await HlsPrefetcherModule.getCacheStats();
      console.log('📊 Cache Stats:', stats);
    } catch (e) {
      console.log('Cache stats error:', e);
    }
  }, 10000); // Every 10 seconds
  
  return () => clearInterval(interval);
}, []);
```

**iOS Output**:
```
📊 Cache Stats: {
  currentMemoryUsage: 15728640,    // ~15 MB
  memoryCapacity: 52428800,        // 50 MB
  currentDiskUsage: 104857600,     // ~100 MB
  diskCapacity: 524288000          // 500 MB
}
```

**Android Output**:
```
📊 Cache Stats: {
  currentDiskUsage: 25165824,      // ~25 MB
  diskCapacity: 52428800,          // 50 MB
  hitCount: 45,                     // Cache hits
  networkCount: 15,                 // Network requests
  requestCount: 60                  // Total requests
}
```

### Platform-Specific Debugging

#### iOS - Xcode Console
1. Open Xcode
2. Window → Devices and Simulators
3. Select your device
4. Click "Open Console"
5. Filter by "HlsPrefetcher" or "URLSession"

#### Android - Logcat
```bash
# Filter for HLS Prefetcher logs
adb logcat | grep -i "prefetch"

# Filter for OkHttp cache activity
adb logcat | grep -i "okhttp"

# Watch all relevant logs
adb logcat | grep -E "(Prefetch|OkHttp|Cache)"
```

## Performance Optimization

### Current Default Settings
```typescript
const INITIAL_SEGMENT_COUNT = 5;    // First segments to prefetch
const PREFETCH_WINDOW = 1;          // Videos ahead/behind to prefetch
```

### Adjust Based on Results

#### If videos load slowly:
```typescript
const INITIAL_SEGMENT_COUNT = 8;    // Prefetch more segments
const PREFETCH_WINDOW = 2;          // Prefetch 2 videos ahead
```

#### If app uses too much data:
```typescript
const INITIAL_SEGMENT_COUNT = 3;    // Prefetch fewer segments
const PREFETCH_WINDOW = 0;          // Only prefetch current video
```

#### If memory issues occur:
```typescript
// Reduce cache size in native modules

// iOS (HlsPrefetcherModule.swift):
// URLCache.shared has default 500MB disk, might need to reduce

// Android (HlsPrefetcherModule.kt):
val cacheSize = 25L * 1024 * 1024  // Reduce from 50MB to 25MB
```

## Troubleshooting

### Issue: Videos not playing instantly

**Check**:
1. Are prefetch logs showing in console?
2. Is prefetch completing before you scroll?
3. Are video URLs accessible?

**Fix**:
```typescript
// Increase prefetch count
const INITIAL_SEGMENT_COUNT = 10;

// Or prefetch earlier (in useEffect)
useEffect(() => {
  // Prefetch all videos on mount
  PLAYLISTS.forEach((url, index) => {
    HlsPrefetcherModule.prefetchPlaylist(url, 5);
  });
}, []);
```

---

### Issue: High memory usage

**Check**:
```typescript
const stats = await HlsPrefetcherModule.getCacheStats();
console.log('Memory usage:', stats.currentMemoryUsage / 1024 / 1024, 'MB');
```

**Fix**:
```typescript
// Clear cache periodically
useEffect(() => {
  const interval = setInterval(() => {
    HlsPrefetcherModule.clearCache();
    console.log('Cache cleared');
  }, 300000); // Every 5 minutes
  
  return () => clearInterval(interval);
}, []);
```

---

### Issue: Prefetch not working on Android

**Check**:
1. Verify OkHttp dependency installed:
   ```bash
   cd android
   ./gradlew app:dependencies | grep okhttp
   ```

2. Check for errors in logcat:
   ```bash
   adb logcat | grep -i "error"
   ```

**Fix**:
```bash
# Clean and rebuild
cd android
./gradlew clean
cd ..
npx expo run:android
```

---

### Issue: iOS cache not working

**Check**:
1. Verify URLs use HTTPS (required for caching)
2. Check CDN sends cache headers
3. Look for URLSession errors in Xcode console

**Fix**:
```bash
# Clean build
cd ios
rm -rf Pods Podfile.lock
pod install
cd ..
npx expo run:ios
```

---

## Success Metrics

After testing, you should observe:

✅ **Instant Playback**: Videos start within 100-200ms when scrolling  
✅ **Smooth UX**: No visible loading spinners between videos  
✅ **Efficient Caching**: Revisited videos play instantly (cache hits)  
✅ **Background Prefetch**: Long-view prefetch happens without affecting playback  
✅ **No Errors**: Console shows successful prefetch logs  
✅ **Reasonable Data Usage**: ~2-5MB per video initially, more if user watches

## Next Steps

Once testing is complete:

1. **Optimize Settings**: Adjust `INITIAL_SEGMENT_COUNT` and `PREFETCH_WINDOW` based on results
2. **Add Analytics**: Track prefetch success rate, cache hit rate, playback start time
3. **Network Awareness**: Potentially adjust prefetch strategy based on network type
4. **User Feedback**: Monitor if users notice instant playback improvement

## Comparison with Original

### Before (JavaScript fetch)
- Videos buffered when scrolled to
- 1-3 second delay before playback
- Loading spinner visible
- Cache not shared with video player

### After (Native prefetch)
- Videos play instantly
- <200ms delay
- No loading spinner
- Cache shared with AVPlayer/ExoPlayer

## Ready to Test!

Run the build commands and start testing. Report any issues you encounter and we can optimize further.

Good luck! 🚀

