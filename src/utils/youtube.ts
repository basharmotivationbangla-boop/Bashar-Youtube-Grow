/**
 * YouTube URL Parser and Utility Functions
 * Supports standard URLs, youtu.be, shorts, live streams, mobile links, and embed codes.
 */

export function extractYouTubeVideoId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  let trimmed = urlOrId.trim();

  // If user pasted an iframe tag, extract the src URL first
  const iframeMatch = trimmed.match(/src=["']([^"']+)["']/i);
  if (iframeMatch && iframeMatch[1]) {
    trimmed = iframeMatch[1];
  }

  // If already an 11-character video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // Regex patterns covering standard watch, shorts, live, embed, and mobile URLs
  const patterns = [
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([a-zA-Z0-9_-]{11})/i,
    /(?:m\.youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([a-zA-Z0-9_-]{11})/i,
    /v=([a-zA-Z0-9_-]{11})/i,
    /\/([a-zA-Z0-9_-]{11})(?:\?|&|$)/,
  ];

  for (const regex of patterns) {
    const match = trimmed.match(regex);
    if (match && match[1] && match[1].length === 11) {
      return match[1];
    }
  }

  return null;
}

export function getYouTubeThumbnail(videoId: string): string {
  if (!videoId) return '';
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export function formatSecondsToTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '০ সেকেন্ড';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs} সেকেন্ড`;
  if (secs === 0) return `${mins} মিনিট`;
  return `${mins} মি. ${secs} সে.`;
}

// In-memory cache for fetched YouTube video titles
const titleCache = new Map<string, string>();

/**
 * Fetch the real YouTube video title via YouTube oEmbed API or NoEmbed fallback
 */
export async function fetchYouTubeVideoTitle(videoId: string): Promise<string> {
  if (!videoId) return '';
  if (titleCache.has(videoId)) {
    return titleCache.get(videoId)!;
  }

  const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // 1. Try official YouTube oEmbed endpoint (public & CORS supported)
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`;
    const res = await fetch(oembedUrl);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.title === 'string' && data.title.trim().length > 0) {
        const cleanTitle = data.title.trim().slice(0, 190);
        titleCache.set(videoId, cleanTitle);
        return cleanTitle;
      }
    }
  } catch (err) {
    console.warn('YouTube oEmbed title fetch failed, trying fallback:', err);
  }

  // 2. Try noembed fallback
  try {
    const noembedUrl = `https://noembed.com/embed?url=${encodeURIComponent(cleanUrl)}`;
    const res = await fetch(noembedUrl);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.title === 'string' && data.title.trim().length > 0) {
        const cleanTitle = data.title.trim().slice(0, 190);
        titleCache.set(videoId, cleanTitle);
        return cleanTitle;
      }
    }
  } catch (err) {
    console.warn('Noembed title fetch failed:', err);
  }

  const fallback = `ইউটিউব ভিডিও (${videoId})`;
  titleCache.set(videoId, fallback);
  return fallback;
}

