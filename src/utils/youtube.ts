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

export interface YouTubeVideoDetails {
  title: string;
  authorName: string;
  authorUrl?: string;
}

// In-memory cache for fetched YouTube video details
const detailsCache = new Map<string, YouTubeVideoDetails>([
  ['kJQP7kiw5Fk', { title: 'Luis Fonsi - Despacito ft. Daddy Yankee', authorName: 'Luis Fonsi', authorUrl: 'https://www.youtube.com/@LuisFonsi' }],
  ['fJ9rUzIMcZQ', { title: 'Queen – Bohemian Rhapsody (Official Video Remastered)', authorName: 'Queen Official', authorUrl: 'https://www.youtube.com/@Queen' }],
  ['JGwWNGJdvx8', { title: 'Ed Sheeran - Shape of You (Official Music Video)', authorName: 'Ed Sheeran', authorUrl: 'https://www.youtube.com/@EdSheeran' }],
  ['9bZkp7q19f0', { title: 'PSY - GANGNAM STYLE(강남스타일) M/V', authorName: 'officialpsy', authorUrl: 'https://www.youtube.com/@officialpsy' }],
  ['09R8_2nJtjg', { title: 'Maroon 5 - Sugar (Official Music Video)', authorName: 'Maroon 5', authorUrl: 'https://www.youtube.com/@Maroon5' }],
  ['2Vv-BfVoq4g', { title: 'Ed Sheeran - Perfect (Official Music Video)', authorName: 'Ed Sheeran', authorUrl: 'https://www.youtube.com/@EdSheeran' }],
  ['kXYiU_JCYtU', { title: 'Linkin Park - Numb (Official Music Video) [4K Upgrade]', authorName: 'Linkin Park', authorUrl: 'https://www.youtube.com/@LinkinPark' }],
]);

/**
 * Fetch YouTube video details (title, channel author name) via official oEmbed or noembed
 */
export async function fetchYouTubeVideoDetails(videoId: string): Promise<YouTubeVideoDetails> {
  if (!videoId) {
    return { title: '', authorName: 'YouTube Creator' };
  }

  if (detailsCache.has(videoId)) {
    return detailsCache.get(videoId)!;
  }

  const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // 1. Try official YouTube oEmbed endpoint (CORS enabled for web clients)
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`;
    const res = await fetch(oembedUrl);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.title === 'string' && data.title.trim().length > 0) {
        const details: YouTubeVideoDetails = {
          title: data.title.trim().slice(0, 190),
          authorName: data.author_name ? data.author_name.trim().slice(0, 80) : 'YouTube Creator',
          authorUrl: data.author_url || `https://www.youtube.com/watch?v=${videoId}`,
        };
        detailsCache.set(videoId, details);
        return details;
      }
    }
  } catch (err) {
    console.warn('YouTube oEmbed fetch failed, trying fallback:', err);
  }

  // 2. Try noembed fallback
  try {
    const noembedUrl = `https://noembed.com/embed?url=${encodeURIComponent(cleanUrl)}`;
    const res = await fetch(noembedUrl);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.title === 'string' && data.title.trim().length > 0) {
        const details: YouTubeVideoDetails = {
          title: data.title.trim().slice(0, 190),
          authorName: data.author_name ? data.author_name.trim().slice(0, 80) : 'YouTube Creator',
          authorUrl: data.author_url || `https://www.youtube.com/watch?v=${videoId}`,
        };
        detailsCache.set(videoId, details);
        return details;
      }
    }
  } catch (err) {
    console.warn('Noembed fetch failed:', err);
  }

  const fallback: YouTubeVideoDetails = {
    title: `YouTube Video (${videoId})`,
    authorName: 'YouTube Creator',
  };
  detailsCache.set(videoId, fallback);
  return fallback;
}

/**
 * Fetch the real YouTube video title via YouTube oEmbed API or NoEmbed fallback
 */
export async function fetchYouTubeVideoTitle(videoId: string): Promise<string> {
  const details = await fetchYouTubeVideoDetails(videoId);
  return details.title;
}


