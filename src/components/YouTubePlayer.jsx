import React, { useRef } from 'react';
import { useYouTubePlayer } from '../hooks/useYouTubePlayer';
import PlayerShell from './PlayerShell';
import PlayerControls from './PlayerControls';

export { defaultPlayerFactory } from '../utils/playerFactory';
export { extractVideoId } from '../utils/youtubeUtils';
export { loadYouTubeIframeApi, resetYouTubeApiLoader } from '../utils/youtubeApiLoader';

export default function YouTubePlayer({
  videoId,
  onTrack,
  onVideoIdChange,
  playerFactory,
  playerStates,
}) {
  const containerRef = useRef(null);
  const { ready, lastTimeRef, onTrackRef } = useYouTubePlayer({
    videoId,
    onTrack,
    playerFactory,
    playerStates,
    containerRef,
  });

  return (
    <div className="stack">
      <PlayerShell
        videoId={videoId}
        containerRef={containerRef}
        ready={ready}
      />
      <PlayerControls
        videoId={videoId}
        onVideoIdChange={onVideoIdChange}
        onTrackRef={onTrackRef}
        lastTimeRef={lastTimeRef}
      />
    </div>
  );
}
