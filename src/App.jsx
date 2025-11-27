import React, { useCallback, useState } from 'react';
import YouTubePlayer from './components/YouTubePlayer.jsx';
import EventLog from './components/EventLog.jsx';

const DEFAULT_VIDEO_ID = 'AJmaVPfyudQ';

export default function App({ videoId: initialVideoId = DEFAULT_VIDEO_ID, playerFactory, playerStates }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [events, setEvents] = useState([]);
  const [videoId, setVideoId] = useState(initialVideoId);

  const logEvent = useCallback((payload) => {
    const timestamp = payload.at ?? Date.now();
    setEvents((prev) => [
      ...prev,
      {
        ...payload,
        at: timestamp,
        id: `${payload.type}-${timestamp}-${prev.length}`,
      },
    ]);
  }, []);

  const statusCopy = isLoggedIn
    ? 'Viewer is authenticated. The livestream iframe is available.'
    : 'Viewer is a guest. We block the player until they log in.';

  const toggleLogin = () => setIsLoggedIn((prev) => !prev);

  return (
    <div className="layout">
      <div className="card header">
        <div>
          <h1 className="title">Secure Livestream Viewer</h1>
          <div style={{ color: 'var(--muted)', marginTop: 6 }}>{statusCopy}</div>
        </div>
        <div className="stack" style={{ alignItems: 'flex-end' }}>
          <div className={`pill ${isLoggedIn ? 'dot' : 'danger'}`} data-testid="auth-state">
            {isLoggedIn ? 'Logged in' : 'Guest'}
          </div>
          <button
            className="button"
            type="button"
            onClick={toggleLogin}
            data-testid="login-toggle"
          >
            {isLoggedIn ? 'Log out' : 'Log in'}
          </button>
        </div>
      </div>

      {!isLoggedIn ? (
        <div className="card placeholder-only">
          <div className="player-placeholder full" data-testid="login-banner">
            <div className="placeholder-content">
              <div className="placeholder-icon" aria-hidden="true">
                🔒
              </div>
              <div className="placeholder-badge">Login required</div>
              <div className="placeholder-copy">
                <strong>Please log in to watch the livestream.</strong>
                <div style={{ color: 'var(--muted)', marginTop: 6 }}>
                  We simulate auth with a simple toggle but enforce the gate just like production.
                </div>
              </div>
              <button
                className="button placeholder-button"
                type="button"
                onClick={toggleLogin}
                data-testid="login-toggle-placeholder"
              >
                Log in to continue
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid two">
          <div className="card stack">
            <div className="header" style={{ alignItems: 'center' }}>
              <h2 className="title" style={{ fontSize: 18, margin: 0 }}>
                Livestream player
              </h2>
            </div>

            <div className="player-area">
              <YouTubePlayer
                videoId={videoId}
                onTrack={logEvent}
                onVideoIdChange={setVideoId}
                playerFactory={playerFactory}
                playerStates={playerStates}
              />
            </div>
          </div>

          <div className="card log-panel">
            <div className="header log-header">
              <h2 className="title" style={{ fontSize: 18, margin: 0 }}>
                Interaction log
              </h2>
            </div>
            <div className="log-scroll">
              <EventLog events={events} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
