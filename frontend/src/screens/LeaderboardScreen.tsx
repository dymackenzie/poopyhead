/**
 * Leaderboard Screen
 * Shows win/loss stats for the current user and people they've played with.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../store';
import Avatar from '../components/Avatar';
import './LeaderboardScreen.css';

interface LeaderboardRow {
  userId: string;
  displayName: string;
  isAnonymous: boolean;
  avatar?: string | null;
  gamesPlayed: number;
  wins: number;
  poopyheadCount: number;
  currentStreak: number;
  bestStreak: number;
  isSelf: boolean;
}

type SortKey = 'poopyheadCount' | 'poopyheadPct';
type SortDir = 'asc' | 'desc';

function poopyheadPct(row: LeaderboardRow): number {
  return row.gamesPlayed > 0 ? row.poopyheadCount / row.gamesPlayed : -1;
}

function poopyheadPctDisplay(row: LeaderboardRow): string {
  return row.gamesPlayed > 0
    ? Math.round((row.poopyheadCount / row.gamesPlayed) * 100) + '%'
    : '—';
}

function sortRows(rows: LeaderboardRow[], key: SortKey, dir: SortDir): LeaderboardRow[] {
  const self = rows.filter((r) => r.isSelf);
  const others = rows.filter((r) => !r.isSelf);

  others.sort((a, b) => {
    let aVal: number;
    let bVal: number;

    switch (key) {
      case 'poopyheadCount':
        aVal = a.poopyheadCount;
        bVal = b.poopyheadCount;
        break;
      case 'poopyheadPct':
        aVal = poopyheadPct(a);
        bVal = poopyheadPct(b);
        break;
    }

    return dir === 'desc' ? bVal - aVal : aVal - bVal;
  });

  return [...self, ...others];
}

interface LeaderboardScreenProps {
  onBack: () => void;
}

export function LeaderboardScreen({ onBack }: LeaderboardScreenProps): React.ReactElement {
  const authToken = useGameStore((state) => state.authToken);

  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('poopyheadCount');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!openMenuId) return;

    const handleOutsideClick = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [openMenuId]);

  // Fetch leaderboard on mount
  useEffect(() => {
    const headers: Record<string, string> = {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    fetch('/api/leaderboard', { headers })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ leaderboard: LeaderboardRow[] }>;
      })
      .then((data) => {
        setRows(data.leaderboard ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError('Could not load leaderboard. Try again.');
        setLoading(false);
      });
  }, [authToken]);

  const handleSort = useCallback(
    (key: SortKey): void => {
      if (sortKey === key) {
        setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
      } else {
        setSortKey(key);
        setSortDir('desc');
      }
    },
    [sortKey]
  );

  const handleHide = useCallback(
    async (userId: string): Promise<void> => {
      setOpenMenuId(null);

      // Optimistic removal
      setRows((prev) => prev.filter((r) => r.userId !== userId));

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      try {
        await fetch('/api/leaderboard/hide', {
          method: 'POST',
          headers,
          body: JSON.stringify({ userId }),
        });
        setToast('Removed from your leaderboard');
        setTimeout(() => setToast(''), 3000);
      } catch {
        // Best-effort — row already removed from UI
      }
    },
    [authToken]
  );

  const sortedRows = sortRows(rows, sortKey, sortDir);

  // Is there meaningful content beyond just the self row?
  const nonSelfRows = rows.filter((r) => !r.isSelf);
  const isEmpty = !loading && !error && nonSelfRows.length === 0;

  function sortIndicator(key: SortKey): React.ReactElement | null {
    if (sortKey !== key) return null;
    return (
      <span className="leaderboard-sort-indicator" aria-hidden="true">
        {sortDir === 'desc' ? '▼' : '▲'}
      </span>
    );
  }

  return (
    <div className="leaderboard-screen">
      <button
        className="lobby-back-btn leaderboard-back"
        onClick={onBack}
        aria-label="Go back"
      >
        <span className="back-arrow">&#8592;</span> Back
      </button>

      <h2 className="leaderboard-title">Leaderboard</h2>

      {toast && <p className="leaderboard-toast">{toast}</p>}

      {error && <p className="lobby-error">{error}</p>}

      {loading && <p className="leaderboard-loading">Loading...</p>}

      {isEmpty && (
        <p className="leaderboard-empty">
          Play a game to start filling your leaderboard.
        </p>
      )}

      {!loading && !error && sortedRows.length > 0 && (
        <div className="leaderboard-table" role="table" aria-label="Leaderboard">
          {/* Header */}
          <div
            className="leaderboard-row leaderboard-row--header"
            role="row"
            aria-rowindex={1}
          >
            <div
              className="leaderboard-cell"
              role="columnheader"
              style={{ cursor: 'default' }}
            >
              Name
            </div>
            <div
              className="leaderboard-cell leaderboard-cell--numeric"
              role="columnheader"
              onClick={() => handleSort('poopyheadCount')}
              aria-sort={sortKey === 'poopyheadCount' ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none'}
              title="Times been Poopyhead"
            >
              &#128169;{sortIndicator('poopyheadCount')}
            </div>
            <div
              className="leaderboard-cell leaderboard-cell--numeric"
              role="columnheader"
              onClick={() => handleSort('poopyheadPct')}
              aria-sort={sortKey === 'poopyheadPct' ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none'}
              title="Poopyhead percentage"
            >
              &#128169;%{sortIndicator('poopyheadPct')}
            </div>
            <div
              className="leaderboard-cell leaderboard-cell--no-sort"
              role="columnheader"
              aria-label="Actions"
            />
          </div>

          {/* Data rows */}
          {sortedRows.map((row, idx) => (
            <div
              key={row.userId}
              className={`leaderboard-row${row.isSelf ? ' leaderboard-row--self' : ''}`}
              role="row"
              aria-rowindex={idx + 2}
            >
              {/* Name */}
              <div className="leaderboard-cell leaderboard-cell--name" role="cell">
                <div className="leaderboard-name-wrap">
                  <Avatar slug={row.avatar ?? undefined} size={28} alt="" />
                  <span
                    className={row.isAnonymous ? 'leaderboard-name--anonymous' : undefined}
                    title={row.isAnonymous ? 'Guest' : row.displayName}
                  >
                    {row.isAnonymous ? 'Guest' : row.displayName}
                  </span>
                  {row.isSelf && row.isAnonymous && (
                    <span className="leaderboard-anon-note">(you)</span>
                  )}
                </div>
              </div>

              {/* Poopyhead count */}
              <div className="leaderboard-cell leaderboard-cell--numeric" role="cell">
                {row.poopyheadCount}
              </div>

              {/* Poopyhead % */}
              <div className="leaderboard-cell leaderboard-cell--numeric" role="cell">
                {poopyheadPctDisplay(row)}
              </div>

              {/* Overflow menu — only for non-self rows */}
              <div className="leaderboard-cell leaderboard-menu-wrap" role="cell">
                {!row.isSelf && (
                  <div
                    ref={openMenuId === row.userId ? menuRef : null}
                    style={{ position: 'relative' }}
                  >
                    <button
                      className="leaderboard-menu-btn"
                      onClick={() =>
                        setOpenMenuId((prev) =>
                          prev === row.userId ? null : row.userId
                        )
                      }
                      aria-label={`Options for ${row.displayName}`}
                      aria-expanded={openMenuId === row.userId}
                      aria-haspopup="true"
                    >
                      &#8943;
                    </button>
                    {openMenuId === row.userId && (
                      <div
                        className="leaderboard-dropdown"
                        role="menu"
                        aria-label={`Actions for ${row.displayName}`}
                      >
                        <button
                          className="leaderboard-dropdown-item"
                          role="menuitem"
                          onClick={() => handleHide(row.userId)}
                        >
                          Hide from my leaderboard
                        </button>
                        <button
                          className="leaderboard-dropdown-cancel"
                          role="menuitem"
                          onClick={() => setOpenMenuId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default LeaderboardScreen;
