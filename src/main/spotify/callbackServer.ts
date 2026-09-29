import { createServer, type Server } from 'node:http';
import { ProviderError } from '@shared/types/domain';

const PAGE = (title: string, body: string, ok: boolean): string => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Lyric Lens</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root{color-scheme:light dark}
  body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px -apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;
       background:#f5f5f7;color:#1d1d1f}
  @media (prefers-color-scheme:dark){body{background:#1c1c1e;color:#f5f5f7}}
  main{text-align:center;padding:48px 40px;max-width:360px}
  .dot{width:56px;height:56px;border-radius:50%;margin:0 auto 24px;display:grid;place-items:center;font-size:28px;
       background:${ok ? '#30d158' : '#ff453a'};color:#fff}
  h1{font-size:22px;margin:0 0 8px;font-weight:650} p{margin:0;opacity:.65;line-height:1.5}
</style></head>
<body><main><div class="dot">${ok ? '✓' : '!'}</div><h1>${title}</h1><p>${body}</p></main></body></html>`;

export interface CallbackWait {
  /** Resolves with the authorisation code. */
  code: Promise<string>;
  /** Stops listening (safe to call more than once). */
  close(): void;
}

/**
 * Starts a one-shot loopback HTTP server on the redirect URI's host/port and resolves with the
 * OAuth `code` once Spotify redirects the browser back. Resolves `ready` when listening.
 */
export async function listenForAuthCode(
  redirectUri: string,
  expectedState: string,
  timeoutMs = 5 * 60_000,
): Promise<CallbackWait> {
  const url = new URL(redirectUri);
  const port = Number(url.port) || 80;
  let server: Server | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const close = (): void => {
    if (timer) clearTimeout(timer);
    timer = null;
    server?.close();
    server?.closeAllConnections();
    server = null;
  };

  const code = new Promise<string>((resolve, reject) => {
    const fail = (message: string, kind: ProviderError['code'] = 'auth'): void => {
      close();
      reject(new ProviderError('Spotify', kind, message));
    };

    const srv = createServer((req, res) => {
      const requestUrl = new URL(req.url ?? '/', `${url.protocol}//${url.host}`);
      if (requestUrl.pathname !== url.pathname) {
        res.writeHead(404).end();
        return;
      }
      const error = requestUrl.searchParams.get('error');
      const received = requestUrl.searchParams.get('code');
      const state = requestUrl.searchParams.get('state');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');

      if (error) {
        res.end(PAGE('Spotify access was declined', 'You can close this tab and try connecting again from Lyric Lens.', false));
        fail(error === 'access_denied' ? 'Spotify access was declined.' : `Spotify returned an error (${error}).`);
      } else if (!received || state !== expectedState) {
        res.statusCode = 400;
        res.end(PAGE('Something went wrong', 'The sign-in response could not be verified. Please try again.', false));
        fail('The Spotify sign-in response could not be verified.');
      } else {
        res.end(PAGE("You're connected", 'Return to Lyric Lens. You can close this tab.', true));
        close();
        resolve(received);
      }
    });
    server = srv;
    timer = setTimeout(() => fail('Spotify sign-in timed out.', 'network'), timeoutMs);
    srv.once('error', (err: NodeJS.ErrnoException) => {
      fail(
        err.code === 'EADDRINUSE'
          ? `Port ${port} is already in use. Quit whatever is using it, or change SPOTIFY_REDIRECT_URI.`
          : `Could not start the local sign-in server (${err.code ?? 'error'}).`,
        'unknown',
      );
    });
    srv.listen(port, url.hostname);
  });

  // Surface listen errors before the browser is opened.
  await new Promise<void>((resolve, reject) => {
    const srv = server as Server | null;
    if (!srv) return resolve();
    if (srv.listening) return resolve();
    srv.once('listening', resolve);
    code.catch(reject);
  });

  code.catch(() => undefined);
  return { code, close };
}
