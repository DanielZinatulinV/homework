const YT_IFRAME_SRC = 'https://www.youtube.com/iframe_api';

const YouTubeApiLoader = (() => {
  let apiPromise = null;

  const loadYouTubeIframeApi = () => {
    if (typeof window === 'undefined') {
      return Promise.reject(new Error('No window available'));
    }

    if (window.YT?.Player) {
      return Promise.resolve(window.YT);
    }

    if (!apiPromise) {
      apiPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${YT_IFRAME_SRC}"]`);
        if (!existing) {
          const tag = document.createElement('script');
          tag.src = YT_IFRAME_SRC;
          tag.async = true;
          tag.onerror = () => reject(new Error('Failed to load YouTube iframe API'));
          document.body.appendChild(tag);
        }

        const previous = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          previous?.();
          resolve(window.YT);
        };
      });
    }

    return apiPromise;
  };

  const reset = () => {
    apiPromise = null;
  };

  return {
    loadYouTubeIframeApi,
    reset,
  };
})();

export const loadYouTubeIframeApi = YouTubeApiLoader.loadYouTubeIframeApi;
export const resetYouTubeApiLoader = YouTubeApiLoader.reset;

