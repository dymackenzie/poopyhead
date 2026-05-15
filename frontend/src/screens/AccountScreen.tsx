/**
 * Account Screen
 * Display name editing, push notification toggle, account linking (anonymous → phone/email)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../store';
import { supabase } from '../supabase';
import { isPushSubscribed, subscribeToPush, unsubscribeFromPush } from '../push';
import Button from '../components/Button';
import Input from '../components/Input';
import Avatar from '../components/Avatar';
import { AVATAR_SLUGS } from '../avatars';
import './AccountScreen.css';

interface AccountScreenProps {
  onBack: () => void;
}

type LinkTab = 'phone' | 'email';
type PhoneStep = 'input' | 'otp';

export function AccountScreen({ onBack }: AccountScreenProps): React.ReactElement {
  const SHOW_PHONE_LINKING = false;
  const authUser = useGameStore((state) => state.authUser);
  const authToken = useGameStore((state) => state.authToken);
  const setPushEnabled = useGameStore((state) => state.setPushEnabled);
  const currentPlayerAvatar = useGameStore((s) => s.currentPlayerAvatar);

  // --- Avatar ---
  const [selectedAvatar, setSelectedAvatar] = useState<string | undefined>(currentPlayerAvatar);
  const [avatarError, setAvatarError] = useState('');

  // --- Display name ---
  const [displayName, setDisplayName] = useState('');
  const [savedName, setSavedName] = useState('');
  const [nameLoading, setNameLoading] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState('');

  // --- Push ---
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushError, setPushError] = useState('');
  const pushSupported = 'PushManager' in window;

  // --- Account linking ---
  const [linkTab, setLinkTab] = useState<LinkTab>('email');

  // Phone OTP flow
  const [phone, setPhone] = useState('');
  const [phoneStep, setPhoneStep] = useState<PhoneStep>('input');
  const [otp, setOtp] = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [phoneSuccess, setPhoneSuccess] = useState('');

  // Email flow
  const [email, setEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');

  // Sign out
  const [signOutLoading, setSignOutLoading] = useState(false);

  // --- Load display name and avatar on mount ---
  useEffect(() => {
    if (!authUser) return;
    supabase
      .from('profiles')
      .select('display_name, avatar')
      .eq('id', authUser.id)
      .single()
      .then(({ data }) => {
        const name = data?.display_name ?? useGameStore.getState().currentPlayerDisplayName ?? '';
        setDisplayName(name);
        setSavedName(name);
        if (name) useGameStore.setState({ currentPlayerDisplayName: name });
        if (data?.avatar) {
          setSelectedAvatar(data.avatar);
          useGameStore.setState({ currentPlayerAvatar: data.avatar });
        } else {
          setSelectedAvatar(currentPlayerAvatar);
        }
      });
  }, [authUser]);

  // --- Check push subscription status on mount ---
  useEffect(() => {
    if (!pushSupported) return;
    isPushSubscribed().then(setPushSubscribed);
  }, [pushSupported]);

  // --- Save display name ---
  const handleSaveName = useCallback(async () => {
    if (!authUser) return;
    const trimmed = displayName.trim();
    if (!trimmed) { setNameError('Name cannot be empty.'); return; }
    setNameLoading(true);
    setNameError('');
    setNameSaved(false);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: authUser.id, display_name: trimmed, is_anonymous: authUser.isAnonymous });
      if (error) {
        console.error('[AccountScreen] display_name save failed:', error);
        throw error;
      }
      setSavedName(trimmed);
      useGameStore.setState({ currentPlayerDisplayName: trimmed });
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
    } catch (err: unknown) {
      const detail = (err as any)?.message ?? '';
      setNameError(detail ? `Could not save name: ${detail}` : 'Could not save name. Try again.');
    } finally {
      setNameLoading(false);
    }
  }, [authUser, displayName]);

  // --- Toggle push ---
  const handlePushToggle = useCallback(async () => {
    if (!pushSupported || pushLoading) return;
    setPushLoading(true);
    setPushError('');
    try {
      if (pushSubscribed) {
        await unsubscribeFromPush();
        setPushSubscribed(false);
        setPushEnabled(false);
      } else {
        if (!authToken) { setPushError('Not authenticated.'); return; }
        const ok = await subscribeToPush(authToken);
        if (!ok) {
          setPushError('Notification permission denied or setup failed.');
        } else {
          setPushSubscribed(true);
          setPushEnabled(true);
        }
      }
    } catch {
      setPushError('Could not update push settings.');
    } finally {
      setPushLoading(false);
    }
  }, [authToken, pushSubscribed, pushSupported, pushLoading, setPushEnabled]);

  // --- Phone link: send OTP ---
  const handlePhoneSubmit = useCallback(async () => {
    const trimmed = phone.trim();
    if (!trimmed) { setPhoneError('Enter a phone number.'); return; }
    setPhoneLoading(true);
    setPhoneError('');
    try {
      const { error } = await supabase.auth.updateUser({ phone: trimmed });
      if (error) throw error;
      setPhoneStep('otp');
    } catch (err: unknown) {
      setPhoneError(err instanceof Error ? err.message : 'Failed to send code.');
    } finally {
      setPhoneLoading(false);
    }
  }, [phone]);

  // --- Phone link: verify OTP ---
  const handleOtpSubmit = useCallback(async () => {
    const trimmed = otp.trim();
    if (trimmed.length !== 6) { setPhoneError('Enter the 6-digit code.'); return; }
    setPhoneLoading(true);
    setPhoneError('');
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: phone.trim(),
        token: trimmed,
        type: 'phone_change',
      });
      if (error) throw error;
      // Mark profile as no longer anonymous (upsert in case profile row is missing)
      if (authUser) {
        await supabase.from('profiles').upsert({ id: authUser.id, is_anonymous: false });
      }
      setPhoneSuccess('Phone linked successfully.');
    } catch (err: unknown) {
      setPhoneError(err instanceof Error ? err.message : 'Invalid code. Try again.');
    } finally {
      setPhoneLoading(false);
    }
  }, [otp, phone, authUser]);

  // --- Email link: send magic link ---
  const handleEmailSubmit = useCallback(async () => {
    const trimmed = email.trim();
    if (!trimmed) { setEmailError('Enter an email address.'); return; }
    setEmailLoading(true);
    setEmailError('');
    setEmailSuccess('');
    try {
      const { error } = await supabase.auth.updateUser({ email: trimmed });
      if (error) throw error;
      setEmailSuccess('Check your inbox — we sent a magic link.');
    } catch (err: unknown) {
      setEmailError(err instanceof Error ? err.message : 'Failed to send link.');
    } finally {
      setEmailLoading(false);
    }
  }, [email]);

  // --- Sign out ---
  const handleSignOut = useCallback(async () => {
    setSignOutLoading(true);
    try {
      await supabase.auth.signOut();
      await supabase.auth.signInAnonymously();
      // onAuthStateChange in App.tsx will handle store update
    } catch {
      // best-effort
    } finally {
      setSignOutLoading(false);
    }
  }, []);

  // --- Pick avatar ---
  const handlePickAvatar = useCallback(async (slug: string): Promise<void> => {
    setSelectedAvatar(slug);
    setAvatarError('');
    useGameStore.setState({ currentPlayerAvatar: slug });
    if (!authUser) return;
    try {
      const currentName = useGameStore.getState().currentPlayerDisplayName;
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: authUser.id,
          avatar: slug,
          is_anonymous: authUser.isAnonymous,
          ...(currentName ? { display_name: currentName } : {}),
        });
      if (error) {
        console.error('[AccountScreen] avatar save failed:', error);
        setAvatarError(`Could not save avatar: ${error.message}`);
      }
    } catch (err: unknown) {
      const detail = (err as any)?.message ?? '';
      setAvatarError(detail ? `Could not save avatar: ${detail}` : 'Could not save avatar. Try again.');
    }
  }, [authUser]);

  const nameChanged = displayName !== savedName;

  return (
    <div className="account-screen">
      <button className="lobby-back-btn account-back" onClick={onBack} aria-label="Go back">
        <span className="back-arrow">&#8592;</span> Back
      </button>

      <h2 className="account-title">Account</h2>

      {/* ── Avatar picker ──────────────────────── */}
      <section className="account-section">
        <h3 className="account-section-label">Avatar</h3>
        <div className="account-avatar-grid">
          {AVATAR_SLUGS.map((slug) => (
            <Avatar
              key={slug}
              slug={slug}
              size={60}
              selected={slug === selectedAvatar}
              onClick={() => handlePickAvatar(slug)}
              alt={slug}
            />
          ))}
        </div>
        {avatarError && <p className="lobby-error">{avatarError}</p>}
      </section>

      {/* ── Display name ───────────────────────── */}
      <section className="account-section">
        <h3 className="account-section-label">Display Name</h3>
        <div className="account-name-row">
          <Input
            id="account-display-name"
            value={displayName}
            onChange={setDisplayName}
            placeholder="Your name"
          />
          {nameChanged && (
            <Button
              variant="primary"
              onClick={handleSaveName}
              disabled={nameLoading}
              fullWidth={false}
            >
              {nameLoading ? 'Saving...' : 'Save'}
            </Button>
          )}
        </div>
        {nameSaved && <p className="account-success">Saved</p>}
        {nameError && <p className="lobby-error">{nameError}</p>}
      </section>

      {/* ── Push notifications ─────────────────── */}
      <section className="account-section">
        <h3 className="account-section-label">Notifications</h3>
        {!pushSupported ? (
          <p className="account-muted">Push not supported on this device.</p>
        ) : (
          <>
            <label className={`lobby-checkbox ${pushLoading ? 'account-checkbox--loading' : ''}`}>
              <input
                type="checkbox"
                checked={pushSubscribed}
                onChange={handlePushToggle}
                disabled={pushLoading}
              />
              <span className="lobby-checkbox-track" />
              <span className="lobby-checkbox-label">
                {pushSubscribed ? 'Notify me when it\'s my turn' : 'Enable turn notifications'}
              </span>
            </label>
            {pushError && <p className="lobby-error">{pushError}</p>}
          </>
        )}
      </section>

      {/* ── Account linking (anonymous only) ──── */}
      {authUser?.isAnonymous === true && (
        <section className="account-section">
          <h3 className="account-section-label">Save Your Progress</h3>
          <p className="account-muted">Link an account so you can resume games on any device.</p>

          {/* Tab switcher */}
          {SHOW_PHONE_LINKING && (
            <div className="account-tabs">
              <button
                className={`account-tab ${linkTab === 'phone' ? 'account-tab--active' : ''}`}
                onClick={() => { setLinkTab('phone'); setPhoneError(''); setEmailError(''); }}
              >
                Phone
              </button>
              <button
                className={`account-tab ${linkTab === 'email' ? 'account-tab--active' : ''}`}
                onClick={() => { setLinkTab('email'); setPhoneError(''); setEmailError(''); }}
              >
                Email
              </button>
            </div>
          )}

          {SHOW_PHONE_LINKING && linkTab === 'phone' && (
            <div className="account-link-panel">
              {phoneSuccess ? (
                <p className="account-success">&#10003; {phoneSuccess}</p>
              ) : phoneStep === 'input' ? (
                <>
                  <Input
                    id="account-phone"
                    label="Phone Number"
                    value={phone}
                    onChange={setPhone}
                    placeholder="+15551234567"
                  />
                  {phoneError && <p className="lobby-error">{phoneError}</p>}
                  <Button
                    variant="primary"
                    onClick={handlePhoneSubmit}
                    disabled={phoneLoading}
                  >
                    {phoneLoading ? 'Sending...' : 'Send Code'}
                  </Button>
                </>
              ) : (
                <>
                  <p className="account-muted">Enter the 6-digit code sent to {phone}.</p>
                  <Input
                    id="account-otp"
                    label="Verification Code"
                    value={otp}
                    onChange={setOtp}
                    placeholder="123456"
                    maxLength={6}
                    codeStyle
                  />
                  {phoneError && <p className="lobby-error">{phoneError}</p>}
                  <div className="account-otp-actions">
                    <Button
                      variant="primary"
                      onClick={handleOtpSubmit}
                      disabled={phoneLoading}
                    >
                      {phoneLoading ? 'Verifying...' : 'Verify'}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => { setPhoneStep('input'); setOtp(''); setPhoneError(''); }}
                      disabled={phoneLoading}
                    >
                      Change Number
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {linkTab === 'email' && (
            <div className="account-link-panel">
              {emailSuccess ? (
                <p className="account-success">{emailSuccess}</p>
              ) : (
                <>
                  <Input
                    id="account-email"
                    label="Email Address"
                    value={email}
                    onChange={setEmail}
                    placeholder="you@example.com"
                    type="text"
                  />
                  {emailError && <p className="lobby-error">{emailError}</p>}
                  <Button
                    variant="primary"
                    onClick={handleEmailSubmit}
                    disabled={emailLoading}
                  >
                    {emailLoading ? 'Sending...' : 'Send Magic Link'}
                  </Button>
                </>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── Linked account status ──────────────── */}
      {authUser?.isAnonymous === false && (
        <section className="account-section">
          <div className="account-linked-badge">
            <span className="account-linked-check">&#10003;</span>
            <span className="account-linked-text">Account linked</span>
          </div>
          <Button
            variant="danger"
            onClick={handleSignOut}
            disabled={signOutLoading}
          >
            {signOutLoading ? 'Signing out...' : 'Sign Out'}
          </Button>
        </section>
      )}
    </div>
  );
}

export default AccountScreen;
