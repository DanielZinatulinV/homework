import React, { useEffect, useState } from 'react';
import { extractVideoId } from '../utils/youtubeUtils';

export default function PlayerControls({ videoId, onVideoIdChange, onTrackRef, lastTimeRef }) {
    const [urlInput, setUrlInput] = useState(`https://www.youtube.com/watch?v=${videoId}`);

    useEffect(() => {
        setUrlInput(`https://www.youtube.com/watch?v=${videoId}`);
    }, [videoId]);

    const handleUrlChange = (e) => {
        const url = e.target.value;
        
        if (!url) {
            setUrlInput(url);
            return;
        }

        const newVideoId = extractVideoId(url);
        if (newVideoId && newVideoId !== videoId && onVideoIdChange) {
            onVideoIdChange(newVideoId);
        } else {
            setUrlInput(url);
        }
    };

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

    return (
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
                <label className="helper-label">Log testing</label>
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
    );
}

