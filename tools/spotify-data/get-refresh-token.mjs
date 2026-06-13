/* ==========================================================================
   get-refresh-token.mjs — one-time helper to authorize the Spotify app and
   print a long-lived REFRESH token, which you then store as the
   SPOTIFY_REFRESH_TOKEN GitHub Actions secret.

   You only ever run this on your own laptop, once (or again if you revoke
   access). It spins up a throwaway localhost server, opens Spotify's consent
   page in your browser, catches the redirect with the auth code, and exchanges
   that code for tokens — printing the refresh token at the end.

   Prereqs (in the Spotify Developer Dashboard -> your app -> Settings):
     - Add this exact Redirect URI:  http://127.0.0.1:8888/callback
     - Note your Client ID and Client Secret.

   Required env (put them in .env.local and load it, or inline them):
     SPOTIFY_CLIENT_ID
     SPOTIFY_CLIENT_SECRET
   Optional env:
     SPOTIFY_REDIRECT_URI   (default http://127.0.0.1:8888/callback)

   Usage:
     SPOTIFY_CLIENT_ID=xxx SPOTIFY_CLIENT_SECRET=yyy \
       node tools/spotify-data/get-refresh-token.mjs
   ========================================================================== */

import { createServer } from 'node:http';
import { exec } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI =
  process.env.SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:8888/callback';

// Only what the pipeline needs: the ability to read your top items.
const SCOPE = 'user-top-read';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    'Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in the environment first.',
  );
  process.exit(1);
}

const PORT = (() => {
  try {
    return Number(new URL(REDIRECT_URI).port) || 8888;
  } catch {
    return 8888;
  }
})();

const state = randomBytes(8).toString('hex');

const authUrl =
  'https://accounts.spotify.com/authorize?' +
  new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: SCOPE,
    redirect_uri: REDIRECT_URI,
    state,
  }).toString();

/** Best-effort "open this URL in the default browser" across platforms. */
function openBrowser(url) {
  const cmd =
    process.platform === 'darwin'
      ? `open "${url}"`
      : process.platform === 'win32'
        ? `start "" "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, () => {
    /* if it fails, the user can copy the URL we printed below */
  });
}

async function exchangeCodeForTokens(code) {
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Token exchange failed: HTTP ${res.status} ${body}`);
  }
  return res.json();
}

const server = createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (reqUrl.pathname !== '/callback') {
    res.writeHead(404).end('Not found');
    return;
  }

  const code = reqUrl.searchParams.get('code');
  const returnedState = reqUrl.searchParams.get('state');
  const error = reqUrl.searchParams.get('error');

  const finish = (message) => {
    res.writeHead(200, { 'Content-Type': 'text/html' }).end(
      `<html><body style="font-family:system-ui;padding:2rem">
         <h2>${message}</h2><p>You can close this tab and return to the terminal.</p>
       </body></html>`,
    );
  };

  if (error) {
    finish(`Authorization failed: ${error}`);
    console.error(`\nAuthorization denied: ${error}`);
    server.close();
    process.exit(1);
  }
  if (returnedState !== state) {
    finish('State mismatch — aborting for safety.');
    console.error('\nState mismatch — possible CSRF. Aborting.');
    server.close();
    process.exit(1);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    finish('Success! Your refresh token is in the terminal.');
    console.log('\n=========================================================');
    console.log('SUCCESS — copy this into your GitHub Actions secrets:\n');
    console.log(`SPOTIFY_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('\n(Add it under Settings -> Secrets and variables -> Actions.)');
    console.log('=========================================================\n');
  } catch (err) {
    finish('Token exchange failed — see terminal.');
    console.error(`\n${err.message}`);
    server.close();
    process.exit(1);
  }
  server.close();
  process.exit(0);
});

server.listen(PORT, () => {
  console.log(`\nListening on ${REDIRECT_URI}`);
  console.log('Opening Spotify authorization in your browser...');
  console.log(`If it doesn't open, paste this URL manually:\n\n${authUrl}\n`);
  openBrowser(authUrl);
});
