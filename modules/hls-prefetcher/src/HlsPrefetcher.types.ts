export type PrefetchResult = {
  success: boolean;
  totalSegments: number;
  prefetchedSegments: number;
  playlistUrl: string;
};

export type PrefetchProgressEvent = {
  playlistUrl: string;
  segmentUrl: string;
  segmentIndex: number;
  success: boolean;
  error?: string;
};

export type PrefetchCompleteEvent = {
  url: string;
  totalSegments: number;
  prefetchedSegments: number;
};

export type PrefetchErrorEvent = {
  url: string;
  error: string;
};

export type CacheStats = {
  currentMemoryUsage?: number;
  memoryCapacity?: number;
  currentDiskUsage: number;
  diskCapacity: number;
  hitCount?: number;
  networkCount?: number;
  requestCount?: number;
};

export type HlsPrefetcherModuleEvents = {
  onPrefetchProgress: (event: PrefetchProgressEvent) => void;
  onPrefetchComplete: (event: PrefetchCompleteEvent) => void;
  onPrefetchError: (event: PrefetchErrorEvent) => void;
};
