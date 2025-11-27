export const defaultPlayerFactory = (element, videoId, events) =>
  new window.YT.Player(element, {
    videoId,
    events,
    playerVars: {
      enablejsapi: 1,
      origin: window.location.origin,
      playsinline: 1,
    },
  });

