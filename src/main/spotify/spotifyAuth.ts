import { ProviderError } from '@shared/types/domain';
import { createLogger } from '../logger';
import { httpJson } from '../net/http';
import type { SecretStore } from '../storage/secrets';
import { listenForAuthCode, type CallbackWait } from './callbackServer';
import { createCodeChallenge, createCodeVerifier, createState } from './pkce';

const log = createLogger('spotify:auth');

const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
export const SPOTIFY_SCOPES = ['user-read-currently-playing', 'user-read-playback-state'];
const SESSION_SECRET = 'spotify.session';
const REFRESH_MARGIN_MS = 60_000;

interface TokenResponse {
  access_token: string;
  token_type: string;
  scope?: string;
  expires_in: number;
  refresh_token?: string;
}

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  clientId: string;
}

export interface SpotifyAuthDeps {
  getClientId: () => string;
  redirectUri: string;
  secrets: SecretStore;
  openExternal: (url: string) => Promise<void>;
  fetchImpl?: typeof fetch;
}

/** True when a token failure means the user must sign in again (as opposed to a transient hiccup). */
export function isPermanentAuthFailure(error: unknown): boolean {
  return (
    error instanceof ProviderError &&
    (error.code === 'auth' || (error.code === 'bad-response' && (error.status === 400 || error.status === 401)))
  );
}

/**
 * Spotify Authorization Code flow with PKCE. No client secret is needed (or stored), which is
 * what Spotify recommends for desktop apps.
 */
export class SpotifyAuth {
  private session: StoredSession | null = null;
  private refreshing: Promise<string> | null = null;
  private pending: CallbackWait | null = null;

  constructor(private readonly deps: SpotifyAuthDeps) {
    this.session = this.loadSession();
  }

  hasSession(): boolean {
    return this.session !== null && this.session.clientId === this.deps.getClientId();
  }

  /** Runs the browser sign-in. Resolves once tokens are stored. */
  async connect(): Promise<void> {
    const clientId = this.deps.getClientId();
    if (!clientId) {
      throw new ProviderError('Spotify', 'not-configured', 'Add your Spotify Client ID in Settings first.');
    }
    this.cancelPending();

    const verifier = createCodeVerifier();
    const state = createState();
    const wait = await listenForAuthCode(this.deps.redirectUri, state);
    this.pending = wait;

    try {
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        scope: SPOTIFY_SCOPES.join(' '),
        redirect_uri: this.deps.redirectUri,
        state,
        code_challenge_method: 'S256',
        code_challenge: createCodeChallenge(verifier),
      });
      log.info('Opening browser for Spotify sign-in');
      await this.deps.openExternal(`${AUTHORIZE_URL}?${params}`);
      const code = await wait.code;
      log.info('Authorisation code received; exchanging for tokens');
      const token = await this.requestToken(
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.deps.redirectUri,
          client_id: clientId,
          code_verifier: verifier,
        }),
      );
      this.storeToken(token, clientId, undefined);
    } finally {
      wait.close();
      if (this.pending === wait) this.pending = null;
    }
  }

  cancelPending(): void {
    this.pending?.close();
    this.pending = null;
  }

  /** A valid access token, refreshing it first when it is about to expire. */
  async getAccessToken(): Promise<string> {
    const session = this.session;
    if (!session || !this.hasSession()) throw new ProviderError('Spotify', 'auth', 'Not connected to Spotify.');
    if (session.expiresAt - Date.now() > REFRESH_MARGIN_MS) return session.accessToken;
    return this.refresh();
  }

  /** Refresh regardless of expiry (e.g. after a 401). Concurrent callers share one request. */
  refresh(): Promise<string> {
    this.refreshing ??= this.doRefresh().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  clear(): void {
    this.cancelPending();
    this.session = null;
    this.deps.secrets.delete(SESSION_SECRET);
  }

  private async doRefresh(): Promise<string> {
    const session = this.session;
    if (!session) throw new ProviderError('Spotify', 'auth', 'Not connected to Spotify.');
    log.debug('Refreshing access token');
    try {
      const token = await this.requestToken(
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: session.refreshToken,
          client_id: session.clientId,
        }),
      );
      this.storeToken(token, session.clientId, session.refreshToken);
      return token.access_token;
    } catch (error) {
      if (isPermanentAuthFailure(error)) {
        log.warn('Refresh token rejected; the user must reconnect');
        this.clear();
        throw new ProviderError('Spotify', 'auth', 'Your Spotify session expired.');
      }
      throw error;
    }
  }

  private requestToken(body: URLSearchParams): Promise<TokenResponse> {
    return httpJson<TokenResponse>(TOKEN_URL, {
      provider: 'Spotify',
      method: 'POST',
      body,
      fetchImpl: this.deps.fetchImpl,
    });
  }

  private storeToken(token: TokenResponse, clientId: string, previousRefreshToken: string | undefined): void {
    const refreshToken = token.refresh_token ?? previousRefreshToken;
    if (!refreshToken) throw new ProviderError('Spotify', 'bad-response', 'Spotify did not return a refresh token.');
    this.session = {
      accessToken: token.access_token,
      refreshToken,
      expiresAt: Date.now() + token.expires_in * 1000,
      clientId,
    };
    this.deps.secrets.set(SESSION_SECRET, JSON.stringify(this.session));
  }

  private loadSession(): StoredSession | null {
    const raw = this.deps.secrets.get(SESSION_SECRET);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<StoredSession>;
      if (parsed.accessToken && parsed.refreshToken && parsed.expiresAt && parsed.clientId) return parsed as StoredSession;
    } catch {
      /* fall through */
    }
    return null;
  }
}
