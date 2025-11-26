import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import App from './App.jsx';

const PLAYER_STATES = { PLAYING: 1, PAUSED: 2, BUFFERING: 3 };

describe('Livestream access control', () => {
  it('blocks unauthenticated users from seeing the player', () => {
    render(<App />);

    expect(screen.getByTestId('auth-state')).toHaveTextContent(/guest/i);
    expect(screen.getByTestId('login-banner')).toBeInTheDocument();
    expect(screen.queryByTestId('player-container')).not.toBeInTheDocument();
  });

  it('records play, pause, and seek interactions', async () => {
    let stateChangeHandler;
    let mockPlayer;
    let currentTime = 0;

    const playerFactory = (_el, _videoId, events) => {
      stateChangeHandler = events.onStateChange;
      events.onReady?.();
      mockPlayer = {
        destroy: vi.fn(),
        getCurrentTime: vi.fn(() => currentTime),
      };
      return mockPlayer;
    };

    render(<App playerFactory={playerFactory} playerStates={PLAYER_STATES} />);

    fireEvent.click(screen.getByTestId('login-toggle'));
    await waitFor(() => expect(stateChangeHandler).toBeTruthy());

    act(() => stateChangeHandler({ data: PLAYER_STATES.PLAYING, target: mockPlayer }));

    currentTime = 42;
    act(() => stateChangeHandler({ data: PLAYER_STATES.BUFFERING, target: mockPlayer }));
    act(() => stateChangeHandler({ data: PLAYER_STATES.PAUSED, target: mockPlayer }));

    const log = await screen.findByTestId('event-log');
    expect(within(log).getByText('PLAY')).toBeInTheDocument();
    expect(within(log).getByText('PAUSE')).toBeInTheDocument();
    expect(within(log).getByText(/0s → 42s/i)).toBeInTheDocument();
  });
});
