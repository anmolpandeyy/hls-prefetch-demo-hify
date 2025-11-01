import { NativeModules } from 'react-native';
const { HlsPrefetcher } = NativeModules;

if (!HlsPrefetcher) {
  console.warn('[HlsPrefetcher] Native module not linked. Did you build the iOS project?');
}

export default {
  /**
   * Prefetch a list of HLS URLs.
   * @param {string[]} urls - list of .m3u8 URLs
   * @param {number} segmentCount - (optional) number of segments to prefetch
   */
  prefetch(urls, segmentCount = 3) {
    if (!HlsPrefetcher) return;
    HlsPrefetcher.prefetch(urls, segmentCount);
  },

  cancelAll() {
    if (!HlsPrefetcher) return;
    HlsPrefetcher.cancelAll();
  },
};
