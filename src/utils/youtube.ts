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
