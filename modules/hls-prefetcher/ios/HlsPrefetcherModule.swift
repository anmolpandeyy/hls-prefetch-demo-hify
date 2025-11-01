import ExpoModulesCore
import Foundation

public class HlsPrefetcherModule: Module {
  // URLSession that shares cache with AVPlayer
  private let urlSession: URLSession = {
    let config = URLSessionConfiguration.default
    config.requestCachePolicy = .returnCacheDataElseLoad
    config.urlCache = URLCache.shared
    return URLSession(configuration: config)
  }()
  
  // Track ongoing prefetch tasks
  private var prefetchTasks: [String: [URLSessionDataTask]] = [:]
  private let taskQueue = DispatchQueue(label: "com.hlsprefetcher.taskqueue", attributes: .concurrent)
  
  public func definition() -> ModuleDefinition {
    Name("HlsPrefetcher")
    
    // Defines event names that the module can send to JavaScript.
    Events("onPrefetchProgress", "onPrefetchComplete", "onPrefetchError")
    
    // Prefetch playlist segments
    AsyncFunction("prefetchPlaylist") { (playlistUrl: String, segmentCount: Int, promise: Promise) in
      self.prefetchPlaylist(url: playlistUrl, segmentCount: segmentCount, promise: promise)
    }
    
    // Cancel ongoing prefetch for a specific URL
    Function("cancelPrefetch") { (playlistUrl: String) in
      self.cancelPrefetch(url: playlistUrl)
    }
    
    // Clear all prefetch cache
    Function("clearCache") {
      URLCache.shared.removeAllCachedResponses()
    }
    
    // Get cache statistics
    AsyncFunction("getCacheStats") { (promise: Promise) in
      let cache = URLCache.shared
      promise.resolve([
        "currentMemoryUsage": cache.currentMemoryUsage,
        "memoryCapacity": cache.memoryCapacity,
        "currentDiskUsage": cache.currentDiskUsage,
        "diskCapacity": cache.diskCapacity
      ])
    }
  }
  
  // MARK: - Private Methods
  
  private func prefetchPlaylist(url: String, segmentCount: Int, promise: Promise) {
    guard let playlistURL = URL(string: url) else {
      promise.reject("INVALID_URL", "Invalid playlist URL")
      return
    }
    
    // Cancel any existing prefetch for this URL
    cancelPrefetch(url: url)
    
    // Fetch the playlist
    let task = urlSession.dataTask(with: playlistURL) { [weak self] data, response, error in
      guard let self = self else { return }
      
      if let error = error {
        promise.reject("FETCH_ERROR", "Failed to fetch playlist: \(error.localizedDescription)")
        self.sendEvent("onPrefetchError", ["url": url, "error": error.localizedDescription])
        return
      }
      
      guard let data = data, let playlistContent = String(data: data, encoding: .utf8) else {
        promise.reject("PARSE_ERROR", "Failed to parse playlist")
        self.sendEvent("onPrefetchError", ["url": url, "error": "Failed to parse playlist"])
        return
      }
      
      // Parse segment URLs from playlist
      let segmentUrls = self.parseSegmentUrls(from: playlistContent, baseUrl: playlistURL)
      let urlsToPrefetch = Array(segmentUrls.prefix(segmentCount))
      
      if urlsToPrefetch.isEmpty {
        promise.resolve([
          "success": true,
          "totalSegments": 0,
          "prefetchedSegments": 0,
          "playlistUrl": url
        ])
        return
      }
      
      // Prefetch segments
      self.prefetchSegments(segmentUrls: urlsToPrefetch, playlistUrl: url) { prefetchedCount in
        promise.resolve([
          "success": true,
          "totalSegments": segmentUrls.count,
          "prefetchedSegments": prefetchedCount,
          "playlistUrl": url
        ])
        
        self.sendEvent("onPrefetchComplete", [
          "url": url,
          "totalSegments": segmentUrls.count,
          "prefetchedSegments": prefetchedCount
        ])
      }
    }
    
    task.resume()
  }
  
  private func parseSegmentUrls(from playlist: String, baseUrl: URL) -> [URL] {
    var segmentUrls: [URL] = []
    let lines = playlist.components(separatedBy: .newlines)
    
    let baseUrlString = baseUrl.deletingLastPathComponent().absoluteString
    
    for line in lines {
      let trimmedLine = line.trimmingCharacters(in: .whitespaces)
      
      // Skip comments and empty lines
      guard !trimmedLine.isEmpty && !trimmedLine.hasPrefix("#") else {
        continue
      }
      
      // Check if it's a segment file (usually .ts or .m4s)
      if trimmedLine.hasSuffix(".ts") || trimmedLine.hasSuffix(".m4s") || trimmedLine.hasSuffix(".aac") {
        if trimmedLine.hasPrefix("http") {
          // Absolute URL
          if let url = URL(string: trimmedLine) {
            segmentUrls.append(url)
          }
        } else {
          // Relative URL
          let fullUrlString = baseUrlString.hasSuffix("/") ? baseUrlString + trimmedLine : baseUrlString + "/" + trimmedLine
          if let url = URL(string: fullUrlString) {
            segmentUrls.append(url)
          }
        }
      }
    }
    
    return segmentUrls
  }
  
  private func prefetchSegments(segmentUrls: [URL], playlistUrl: String, completion: @escaping (Int) -> Void) {
    var tasks: [URLSessionDataTask] = []
    let prefetchGroup = DispatchGroup()
    var prefetchedCount = 0
    let countLock = NSLock()
    
    for (index, segmentUrl) in segmentUrls.enumerated() {
      prefetchGroup.enter()
      
      let task = urlSession.dataTask(with: segmentUrl) { [weak self] data, response, error in
        defer { prefetchGroup.leave() }
        
        if error == nil && data != nil {
          countLock.lock()
          prefetchedCount += 1
          countLock.unlock()
          
          self?.sendEvent("onPrefetchProgress", [
            "playlistUrl": playlistUrl,
            "segmentUrl": segmentUrl.absoluteString,
            "segmentIndex": index,
            "success": true
          ])
        } else {
          self?.sendEvent("onPrefetchProgress", [
            "playlistUrl": playlistUrl,
            "segmentUrl": segmentUrl.absoluteString,
            "segmentIndex": index,
            "success": false,
            "error": error?.localizedDescription ?? "Unknown error"
          ])
        }
      }
      
      tasks.append(task)
      task.resume()
    }
    
    // Store tasks so they can be cancelled if needed
    taskQueue.async(flags: .barrier) {
      self.prefetchTasks[playlistUrl] = tasks
    }
    
    // Wait for all tasks to complete
    prefetchGroup.notify(queue: .global()) {
      self.taskQueue.async(flags: .barrier) {
        self.prefetchTasks.removeValue(forKey: playlistUrl)
      }
      completion(prefetchedCount)
    }
  }
  
  private func cancelPrefetch(url: String) {
    taskQueue.async(flags: .barrier) {
      if let tasks = self.prefetchTasks[url] {
        tasks.forEach { $0.cancel() }
        self.prefetchTasks.removeValue(forKey: url)
      }
    }
  }
}
