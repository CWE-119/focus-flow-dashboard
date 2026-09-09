async function refreshGoogleToken(secrets, request = fetch) {
  const response = await request('https://oauth2.googleapis.com/token', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: secrets.refreshToken, client_id: secrets.clientId, ...(secrets.clientSecret ? { client_secret: secrets.clientSecret } : {}) }).toString(),
  });
  if (!response.ok) throw new Error('Google token refresh failed. Check the OAuth client and refresh token, or authorize again.');
  const result = await response.json();
  if (typeof result.access_token !== 'string' || !result.access_token) throw new Error('Google did not return an access token.');
  return { ...secrets, credential: result.access_token, ...(result.refresh_token ? { refreshToken: result.refresh_token } : {}) };
}

module.exports = { refreshGoogleToken };
