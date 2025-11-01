package expo.modules.hlsprefetcher

import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import kotlinx.coroutines.*
import okhttp3.*
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit

class HlsPrefetcherModule : Module() {
  private lateinit var context: Context
  private val prefetchJobs = mutableMapOf<String, Job>()
  private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
  
  // OkHttp client with cache configuration
  private val okHttpClient: OkHttpClient by lazy {
    val cacheDir = File(context.cacheDir, "hls_prefetch_cache")
    val cacheSize = 50L * 1024 * 1024 // 50 MB cache
    val cache = Cache(cacheDir, cacheSize)
    
    OkHttpClient.Builder()
      .cache(cache)
      .connectTimeout(10, TimeUnit.SECONDS)
      .readTimeout(30, TimeUnit.SECONDS)
      .build()
  }
  
  override fun definition() = ModuleDefinition {
    Name("HlsPrefetcher")
    
    // Get context reference
    OnCreate {
      context = appContext.reactContext ?: throw IllegalStateException("React context is null")
    }
    
    OnDestroy {
      // Cancel all ongoing prefetch jobs
      prefetchJobs.values.forEach { it.cancel() }
      prefetchJobs.clear()
      scope.cancel()
    }
    
    // Defines event names that the module can send to JavaScript.
    Events("onPrefetchProgress", "onPrefetchComplete", "onPrefetchError")
    
    // Prefetch playlist segments
    AsyncFunction("prefetchPlaylist") { playlistUrl: String, segmentCount: Int, promise: Promise ->
      prefetchPlaylist(playlistUrl, segmentCount, promise)
    }
    
    // Cancel ongoing prefetch for a specific URL
    Function("cancelPrefetch") { playlistUrl: String ->
      cancelPrefetch(playlistUrl)
    }
    
    // Clear all prefetch cache
    Function("clearCache") {
      try {
        okHttpClient.cache?.evictAll()
      } catch (e: Exception) {
        // Ignore errors
      }
    }
    
    // Get cache statistics
    AsyncFunction("getCacheStats") { promise: Promise ->
      try {
        val cache = okHttpClient.cache
        promise.resolve(mapOf(
          "currentDiskUsage" to (cache?.size() ?: 0),
          "diskCapacity" to (cache?.maxSize() ?: 0),
          "hitCount" to (cache?.hitCount() ?: 0),
          "networkCount" to (cache?.networkCount() ?: 0),
          "requestCount" to (cache?.requestCount() ?: 0)
        ))
      } catch (e: Exception) {
        promise.reject("CACHE_ERROR", "Failed to get cache stats: ${e.message}", e)
      }
    }
  }
  
  private fun prefetchPlaylist(playlistUrl: String, segmentCount: Int, promise: Promise) {
    // Cancel any existing prefetch for this URL
    cancelPrefetch(playlistUrl)
    
    val job = scope.launch {
      try {
        // Fetch the playlist
        val request = Request.Builder()
          .url(playlistUrl)
          .build()
        
        val response = okHttpClient.newCall(request).execute()
        
        if (!response.isSuccessful) {
          promise.reject("FETCH_ERROR", "Failed to fetch playlist: ${response.code}", null)
          sendEvent("onPrefetchError", mapOf(
            "url" to playlistUrl,
            "error" to "HTTP ${response.code}"
          ))
          return@launch
        }
        
        val playlistContent = response.body?.string()
        if (playlistContent == null) {
          promise.reject("PARSE_ERROR", "Failed to parse playlist", null)
          sendEvent("onPrefetchError", mapOf(
            "url" to playlistUrl,
            "error" to "Empty playlist"
          ))
          return@launch
        }
        
        // Parse segment URLs from playlist
        val segmentUrls = parseSegmentUrls(playlistContent, playlistUrl)
        val urlsToPrefetch = segmentUrls.take(segmentCount)
        
        if (urlsToPrefetch.isEmpty()) {
          promise.resolve(mapOf(
            "success" to true,
            "totalSegments" to 0,
            "prefetchedSegments" to 0,
            "playlistUrl" to playlistUrl
          ))
          return@launch
        }
        
        // Prefetch segments
        val prefetchedCount = prefetchSegments(urlsToPrefetch, playlistUrl)
        
        promise.resolve(mapOf(
          "success" to true,
          "totalSegments" to segmentUrls.size,
          "prefetchedSegments" to prefetchedCount,
          "playlistUrl" to playlistUrl
        ))
        
        sendEvent("onPrefetchComplete", mapOf(
          "url" to playlistUrl,
          "totalSegments" to segmentUrls.size,
          "prefetchedSegments" to prefetchedCount
        ))
        
      } catch (e: Exception) {
        promise.reject("PREFETCH_ERROR", "Prefetch failed: ${e.message}", e)
        sendEvent("onPrefetchError", mapOf(
          "url" to playlistUrl,
          "error" to (e.message ?: "Unknown error")
        ))
      } finally {
        prefetchJobs.remove(playlistUrl)
      }
    }
    
    prefetchJobs[playlistUrl] = job
  }
  
  private fun parseSegmentUrls(playlist: String, baseUrl: String): List<String> {
    val segmentUrls = mutableListOf<String>()
    val lines = playlist.split("\n")
    
    // Extract base URL (remove filename)
    val baseUrlWithoutFile = baseUrl.substringBeforeLast("/")
    
    for (line in lines) {
      val trimmedLine = line.trim()
      
      // Skip comments and empty lines
      if (trimmedLine.isEmpty() || trimmedLine.startsWith("#")) {
        continue
      }
      
      // Check if it's a segment file (usually .ts or .m4s)
      if (trimmedLine.endsWith(".ts") || trimmedLine.endsWith(".m4s") || trimmedLine.endsWith(".aac")) {
        val segmentUrl = if (trimmedLine.startsWith("http")) {
          // Absolute URL
          trimmedLine
        } else {
          // Relative URL
          "$baseUrlWithoutFile/$trimmedLine"
        }
        segmentUrls.add(segmentUrl)
      }
    }
    
    return segmentUrls
  }
  
  private suspend fun prefetchSegments(segmentUrls: List<String>, playlistUrl: String): Int {
    var prefetchedCount = 0
    
    // Prefetch segments in parallel with limited concurrency
    val results = coroutineScope {
      segmentUrls.mapIndexed { index, segmentUrl ->
        async(Dispatchers.IO) {
          try {
            val request = Request.Builder()
              .url(segmentUrl)
              .build()
            
            val response = okHttpClient.newCall(request).execute()
            
            if (response.isSuccessful) {
              // Read the response to ensure it's cached
              response.body?.bytes()
              response.close()
              
              withContext(Dispatchers.Main) {
                sendEvent("onPrefetchProgress", mapOf(
                  "playlistUrl" to playlistUrl,
                  "segmentUrl" to segmentUrl,
                  "segmentIndex" to index,
                  "success" to true
                ))
              }
              
              1
            } else {
              withContext(Dispatchers.Main) {
                sendEvent("onPrefetchProgress", mapOf(
                  "playlistUrl" to playlistUrl,
                  "segmentUrl" to segmentUrl,
                  "segmentIndex" to index,
                  "success" to false,
                  "error" to "HTTP ${response.code}"
                ))
              }
              0
            }
          } catch (e: Exception) {
            withContext(Dispatchers.Main) {
              sendEvent("onPrefetchProgress", mapOf(
                "playlistUrl" to playlistUrl,
                "segmentUrl" to segmentUrl,
                "segmentIndex" to index,
                "success" to false,
                "error" to (e.message ?: "Unknown error")
              ))
            }
            0
          }
        }
      }.awaitAll()
    }
    
    results.forEach { prefetchedCount += it }
    
    return prefetchedCount
  }
  
  private fun cancelPrefetch(playlistUrl: String) {
    prefetchJobs[playlistUrl]?.cancel()
    prefetchJobs.remove(playlistUrl)
  }
}
