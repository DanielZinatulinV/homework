import React from 'react';

export default function PlayerShell({ videoId, containerRef, ready }) {
  return (
    <div className="player-shell" data-testid="player-shell">
      <iframe
        ref={containerRef}
        title="Livestream player"
        data-testid="player-container"
        className="video-frame"
        key={videoId}
        src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&playsinline=1&controls=1`}
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
      {!ready && (
        <div className="player-overlay" role="status" aria-label="Loading player">
          <span>Loading player...</span>
        </div>
      )}
    </div>
  );
}

