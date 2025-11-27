export const FALLBACK_STATES = { PLAYING: 1, PAUSED: 2, BUFFERING: 3 };

export const extractVideoId = (url) => {
  if (!url || typeof url !== 'string') return null;
  
  const trimmed = url.trim();
  
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*&v=([a-zA-Z0-9_-]{11})/,
  ];
  
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
};

