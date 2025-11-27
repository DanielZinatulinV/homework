import { useEffect, useMemo, useRef, useState } from 'react';
import { loadYouTubeIframeApi } from '../utils/youtubeApiLoader';
import { defaultPlayerFactory } from '../utils/playerFactory';
import { FALLBACK_STATES } from '../utils/youtubeUtils';

export function useYouTubePlayer({
  videoId,
  onTrack,
  playerFactory,
  playerStates,
  containerRef,
}) {
  const lastTimeRef = useRef(0);
  const onTrackRef = useRef(onTrack);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onTrackRef.current = onTrack;
  }, [onTrack]);

  useEffect(() => {
    setReady(false);
  }, [videoId]);

  const resolvedStates = useMemo(
    () => playerStates ?? window.YT?.PlayerState ?? FALLBACK_STATES,
    [playerStates],
  );

  useEffect(() => {
    let playerInstance;
    let cancelled = false;
    let lastKnownTime = 0;
    let lastState = null;
    let seekCheckTimeout = null;
    let timeBeforePause = null;
    let seekTracked = false;

    const track = (payload) => {
      if (cancelled) return;
      if (typeof onTrackRef.current === 'function') {
        onTrackRef.current({ ...payload, at: Date.now() });
      }
    };

    const checkForSeek = (player, previousTime, forceCheck = false) => {
      if (cancelled || !player) return;
      
      try {
        seekCheckTimeout = setTimeout(() => {
          if (cancelled) return;
          const currentTime = Math.round(player.getCurrentTime?.() ?? 0);
          const timeDiff = Math.abs(currentTime - previousTime);
          
          if (timeDiff > 0.5 || (forceCheck && timeDiff > 0.1 && previousTime >= 0)) {
            track({ type: 'seek', from: previousTime, to: currentTime });
            lastTimeRef.current = currentTime;
            lastKnownTime = currentTime;
            seekTracked = true;
          }
        }, 200);
      } catch (err) {
      }
    };

    const handleStateChange = (event) => {
      if (cancelled) return;

      const player = event?.target;
      const currentState = event?.data;
      let current = 0;
      
      try {
        current = Math.round(player?.getCurrentTime?.() ?? lastTimeRef.current);
      } catch (err) {
        current = lastTimeRef.current;
      }

      if (seekCheckTimeout) {
        clearTimeout(seekCheckTimeout);
        seekCheckTimeout = null;
      }

      if (currentState === resolvedStates.PLAYING) {
        if (!seekTracked && 
            lastState !== null && 
            lastState !== resolvedStates.PLAYING && 
            (lastState === resolvedStates.PAUSED || lastState === resolvedStates.BUFFERING)) {
          const timeToCheck = timeBeforePause !== null ? timeBeforePause : lastKnownTime;
          checkForSeek(player, timeToCheck, true);
          seekTracked = true;
        }
        lastTimeRef.current = current;
        lastKnownTime = current;
        seekTracked = false;
        timeBeforePause = null;
        track({ type: 'play', position: current });
      } else if (currentState === resolvedStates.PAUSED) {
        timeBeforePause = lastKnownTime;
        lastTimeRef.current = current;
        lastKnownTime = current;
        track({ type: 'pause', position: current });
      } else if (currentState === resolvedStates.BUFFERING) {
        const from = lastKnownTime;
        const timeDiff = Math.abs(current - from);
        
        if (timeDiff > 0.5) {
          track({ type: 'seek', from, to: current });
          lastTimeRef.current = current;
          lastKnownTime = current;
          seekTracked = true;
          timeBeforePause = null;
        } else if (lastState === resolvedStates.PAUSED) {
          const timeToCheck = timeBeforePause !== null ? timeBeforePause : from;
          checkForSeek(player, timeToCheck, true);
          seekTracked = true;
        } else if (lastState !== null) {
          checkForSeek(player, from, false);
        } else {
          lastKnownTime = current;
        }
      }

      lastState = currentState;
    };

    const setupPlayer = async () => {
      if (!containerRef.current) return;

      const factory = playerFactory ?? defaultPlayerFactory;

      if (!playerFactory) {
        try {
          await loadYouTubeIframeApi();
        } catch (err) {
          console.error(err);
        }
      }

      if (cancelled) return;

      if (!playerFactory && !window.YT?.Player) {
        setReady(true);
        return;
      }

      playerInstance = factory(containerRef.current, videoId, {
        onReady: () => {
          if (!cancelled) {
            setReady(true);
          }
        },
        onStateChange: handleStateChange,
      });

      if (playerFactory || !playerInstance?.addEventListener) {
        setReady(true);
      }
    };

    setupPlayer();

    return () => {
      cancelled = true;
      if (seekCheckTimeout) {
        clearTimeout(seekCheckTimeout);
      }
      playerInstance?.destroy?.();
    };
  }, [videoId, playerFactory, resolvedStates, containerRef]);

  return {
    ready,
    lastTimeRef,
    onTrackRef,
  };
}

