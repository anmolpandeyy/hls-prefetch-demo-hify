// utils/fetchHlsSegments.js
export async function fetchHlsSegments(manifestUrl, options = {}) {
  const { limit = 10, concurrency = 3, onProgress } = options;
  const baseUrl = manifestUrl.substring(0, manifestUrl.lastIndexOf('/') + 1);

  // 1. Download playlist
  const res = await fetch(manifestUrl);
  if (!res.ok) throw new Error(`Failed to fetch playlist: ${res.status}`);
  const text = await res.text();

  if(!text) throw new Error('Empty playlist');

  // 2. Extract segment lines (#EXTINF is followed by the .ts file)
  const segmentLines = text?.split('\n').filter(line =>
    line.trim() && !line.startsWith('#')
  );

  const resolvedUrls = segmentLines?.map(line =>
    line.startsWith('http') ? line : baseUrl + line
  );

  // 3. Limit how many segments you want to prefetch
  const toFetch = resolvedUrls.slice(0, limit);

  // 4. Fetch in parallel batches
  const fetchBatch = async (urls) => {
    await Promise.all(urls.map(async (url) => {
      try {
        const r = await fetch(url, { method: 'HEAD' }); // HEAD = lightweight prefetch
        // console.log(JSON.stringify(r, null, 2))
        if (onProgress) onProgress(url, true);
      } catch (err) {
        if (onProgress) onProgress(url, false);
      }
    }));
  };

  // simple concurrency control
  for (let i = 0; i < toFetch.length; i += concurrency) {
    const batch = toFetch.slice(i, i + concurrency);
    await fetchBatch(batch);
  }

  return { total: resolvedUrls.length, fetched: toFetch.length };
}
