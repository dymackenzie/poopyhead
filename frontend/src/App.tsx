/**
 * Main App Component
 *
 * Handles auth bootstrap, avatar initialisation, and screen routing.
 * Socket event handling lives in socketEventHandlers.ts.
 */

import React, { useEffect } from 'react';
import { useGameStore } from './store';
import { getSocket } from './socketClient';
import { supabase, authReady } from './supabase';
import { randomAvatar } from './avatars';
import { attachSocketEventHandlers } from './socketEventHandlers';
import LobbyScreen from './screens/LobbyScreen';
import GameScreen from './screens/GameScreen';
import EndgameScreen from './screens/EndgameScreen';
import './App.css';

export function App(): React.ReactElement {
  const gameStatus = useGameStore((state) => state.gameStatus);
  const setAuth = useGameStore((state) => state.setAuth);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setAuth({ id: session.user.id, isAnonymous: session.user.is_anonymous ?? false }, session.access_token);
        supabase.from('profiles').select('avatar, display_name').eq('id', session.user.id).single()
          .then(({ data }) => {
            if (data?.avatar) useGameStore.setState({ currentPlayerAvatar: data.avatar });
            if (data?.display_name) useGameStore.setState({ currentPlayerDisplayName: data.display_name });
          });
        if (!useGameStore.getState().currentPlayerAvatar) {
          useGameStore.setState({ currentPlayerAvatar: randomAvatar() });
        }
      } else {
        setAuth(null, null);
        useGameStore.setState({ currentPlayerAvatar: randomAvatar() });
      }
      if (event === 'TOKEN_REFRESHED' && session) {
        const s = getSocket();
        if (s) {
          (s as any).auth = { token: session.access_token };
          s.disconnect();
          s.connect();
        }
      }
    });

    const boot = async () => {
      await authReady;
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setAuth({ id: session.user.id, isAnonymous: session.user.is_anonymous ?? false }, session.access_token);
      }
      // Set initial avatar: random for guests, DB for signed-in
      useGameStore.setState({ currentPlayerAvatar: randomAvatar() });
      if (session?.user) {
        supabase.from('profiles').select('avatar, display_name').eq('id', session.user.id).single()
          .then(({ data }) => {
            if (data?.avatar) useGameStore.setState({ currentPlayerAvatar: data.avatar });
            if (data?.display_name) useGameStore.setState({ currentPlayerDisplayName: data.display_name });
          });
      }
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch((err) => {
          console.warn('[App] Service worker registration failed:', err);
        });
      }
      attachSocketEventHandlers(session?.access_token ?? null);
    };
    boot();
    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="app">
      {gameStatus === 'lobby' && <LobbyScreen />}
      {gameStatus === 'playing' && <GameScreen />}
      {(gameStatus === 'ended' || gameStatus === 'rematch') && <EndgameScreen />}
    </div>
  );
}

export default App;
