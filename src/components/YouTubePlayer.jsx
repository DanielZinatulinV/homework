import React, { useEffect, useMemo, useRef, useState } from 'react';

const YT_IFRAME_SRC = 'https://www.youtube.com/iframe_api';
const FALLBACK_STATES = { PLAYING: 1, PAUSED: 2, BUFFERING: 3 };

// Модуль-синглтон для управления загрузкой YouTube API
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

  // Метод для сброса состояния (полезно в тестах)
  const reset = () => {
    apiPromise = null;
  };

  return {
    loadYouTubeIframeApi,
    reset,
  };
})();

const loadYouTubeIframeApi = YouTubeApiLoader.loadYouTubeIframeApi;

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

// Экспортируем для тестирования и переиспользования
export { loadYouTubeIframeApi };
export const resetYouTubeApiLoader = YouTubeApiLoader.reset;

// Функция для извлечения videoId из YouTube URL
export const extractVideoId = (url) => {
  if (!url || typeof url !== 'string') return null;
  
  // Убираем пробелы
  const trimmed = url.trim();
  
  // Если это уже videoId (11 символов, только буквы, цифры, дефисы и подчеркивания)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  
  // Паттерны для различных форматов YouTube URL
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

export default function YouTubePlayer({
  videoId,
  onTrack,
  onVideoIdChange,
  playerFactory,
  playerStates,
}) {
  const containerRef = useRef(null);
  const lastTimeRef = useRef(0);
  const onTrackRef = useRef(onTrack);
  const [ready, setReady] = useState(false);

  // Обновляем ref при изменении onTrack, чтобы всегда использовать актуальную версию
  useEffect(() => {
    onTrackRef.current = onTrack;
  }, [onTrack]);

  // Сбрасываем ready при изменении videoId, чтобы показать загрузку нового видео
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
    let timeBeforePause = null; // Время перед паузой (для определения seek)
    let seekTracked = false; // Флаг, что seek уже был зафиксирован для текущего перехода

    const track = (payload) => {
      if (cancelled) return;
      if (typeof onTrackRef.current === 'function') {
        onTrackRef.current({ ...payload, at: Date.now() });
      }
    };

    const checkForSeek = (player, previousTime, forceCheck = false) => {
      if (cancelled || !player) return;
      
      try {
        // Даем время API обновиться после клика на timeline
        seekCheckTimeout = setTimeout(() => {
          if (cancelled) return;
          const currentTime = Math.round(player.getCurrentTime?.() ?? 0);
          const timeDiff = Math.abs(currentTime - previousTime);
          
          // Если разница времени больше 0.5 секунды ИЛИ это принудительная проверка (клик на timeline)
          // При клике на timeline разница может быть любой, даже очень маленькой
          if (timeDiff > 0.5 || (forceCheck && timeDiff > 0.1 && previousTime >= 0)) {
            track({ type: 'seek', from: previousTime, to: currentTime });
            lastTimeRef.current = currentTime;
            lastKnownTime = currentTime;
            seekTracked = true; // Помечаем, что seek был зафиксирован
          }
        }, 200);
      } catch (err) {
        // Игнорируем ошибки при получении времени
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

      // Очищаем предыдущий таймаут проверки seek
      if (seekCheckTimeout) {
        clearTimeout(seekCheckTimeout);
        seekCheckTimeout = null;
      }

      if (currentState === resolvedStates.PLAYING) {
        // При переходе в PLAYING проверяем seek, если перед этим было PAUSE или BUFFERING
        // Это указывает на клик/перетаскивание по timeline
        // Но только если seek еще не был зафиксирован при BUFFERING
        if (!seekTracked && 
            lastState !== null && 
            lastState !== resolvedStates.PLAYING && 
            (lastState === resolvedStates.PAUSED || lastState === resolvedStates.BUFFERING)) {
          // Используем время перед паузой, если оно было сохранено
          const timeToCheck = timeBeforePause !== null ? timeBeforePause : lastKnownTime;
          // Принудительная проверка seek при переходе из PAUSE/BUFFERING в PLAYING
          checkForSeek(player, timeToCheck, true);
          seekTracked = true; // Помечаем, что seek был проверен
        }
        lastTimeRef.current = current;
        lastKnownTime = current;
        seekTracked = false; // Сбрасываем флаг для следующего цикла
        timeBeforePause = null; // Сбрасываем после проверки
        track({ type: 'play', position: current });
      } else if (currentState === resolvedStates.PAUSED) {
        // Сохраняем время перед паузой для последующей проверки seek
        timeBeforePause = lastKnownTime;
        lastTimeRef.current = current;
        lastKnownTime = current;
        track({ type: 'pause', position: current });
      } else if (currentState === resolvedStates.BUFFERING) {
        // При BUFFERING проверяем seek сразу
        const from = lastKnownTime;
        const timeDiff = Math.abs(current - from);
        
        // Если разница времени больше 0.5 секунды, это точно seek
        if (timeDiff > 0.5) {
          track({ type: 'seek', from, to: current });
          lastTimeRef.current = current;
          lastKnownTime = current;
          seekTracked = true; // Помечаем, что seek уже зафиксирован
          timeBeforePause = null; // Seek уже зафиксирован
        } else if (lastState === resolvedStates.PAUSED) {
          // Если перед BUFFERING было PAUSE, это может быть клик на timeline
          // Проверяем с задержкой (время может обновиться позже)
          const timeToCheck = timeBeforePause !== null ? timeBeforePause : from;
          checkForSeek(player, timeToCheck, true);
          // Помечаем, что seek будет проверен (чтобы не дублировать при PLAYING)
          seekTracked = true;
        } else if (lastState !== null) {
          // Для других случаев проверяем без принудительного флага
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
          // In constrained environments we still show the iframe and debug controls.
          console.error(err);
        }
      }

      if (cancelled) return;

      if (!playerFactory && !window.YT?.Player) {
        if (!cancelled) {
          setReady(true);
        }
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

      // If the mock factory never calls onReady, unblock the UI.
      if (playerFactory || !playerInstance?.addEventListener) {
        if (!cancelled) {
          setReady(true);
        }
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
  }, [videoId, playerFactory, resolvedStates]);

  const manualLog = (type) => {
    const payload =
      type === 'seek'
        ? { type, from: lastTimeRef.current, to: lastTimeRef.current + 10 }
        : { type, position: lastTimeRef.current };
    if (type === 'seek') {
      lastTimeRef.current += 10;
    }
    onTrackRef.current?.({ ...payload, at: Date.now(), mocked: true });
  };

  const [urlInput, setUrlInput] = useState(`https://www.youtube.com/watch?v=${videoId}`);

  // Обновляем input при изменении videoId извне
  useEffect(() => {
    setUrlInput(`https://www.youtube.com/watch?v=${videoId}`);
  }, [videoId]);

  const handleUrlChange = (e) => {
    const url = e.target.value;
    setUrlInput(url);
    
    if (!url) return;
    
    const newVideoId = extractVideoId(url);
    if (newVideoId && newVideoId !== videoId && onVideoIdChange) {
      onVideoIdChange(newVideoId);
    }
  };

  return (
    <div className="stack">
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
      <div className="helper" aria-label="Manual tracking controls">
        <div className="helper-input-group">
          <label htmlFor="youtube-url" className="helper-label">
            YouTube URL
          </label>
          <input
            id="youtube-url"
            type="text"
            className="helper-input"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onBlur={handleUrlChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.target.blur();
              }
            }}
            data-testid="youtube-url-input"
          />
        </div>
        <div className="helper-buttons">
          <button className="button secondary" type="button" onClick={() => manualLog('play')}>
            Log play
          </button>
          <button className="button secondary" type="button" onClick={() => manualLog('pause')}>
            Log pause
          </button>
          <button className="button secondary" type="button" onClick={() => manualLog('seek')}>
            Log seek +10s
          </button>
        </div>
      </div>
    </div>
  );
}
