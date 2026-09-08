const crypto = require('node:crypto');
const dns = require('node:dns');
const https = require('node:https');
const net = require('node:net');

function publicIPv4(address) {
  if (net.isIP(address) !== 4) return false;
  const [first, second] = address.split('.').map(Number);
  return !(first === 0 || first === 10 || first === 127 || first >= 224 ||
    (first === 169 && second === 254) || (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && (second === 168 || second === 0)) ||
    (first === 100 && second >= 64 && second <= 127) || (first === 198 && [18, 19].includes(second)));
}

function canvasOrigin(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Enter your school’s HTTPS Canvas URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
    url.search || url.hash || url.pathname !== '/' || !url.hostname.includes('.') ||
    (net.isIP(url.hostname) && !publicIPv4(url.hostname))) {
    throw new Error('Use the public HTTPS Canvas address, without a course path or port.');
  }
  return url.origin;
}

function requestJSON(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: { Accept: 'application/json', ...headers },
      family: 4,
      lookup(hostname, options, callback) {
        dns.lookup(hostname, { family: 4, all: true }, (error, addresses) => {
          if (error) return callback(new Error('Could not resolve the provider address.'));
          if (!addresses.length || addresses.some(({ address }) => !publicIPv4(address))) {
            return callback(new Error('Provider must resolve to a public internet address.'));
          }
          if (options.all) callback(null, addresses);
          else callback(null, addresses[0].address, 4);
        });
      },
    }, (response) => {
      const status = response.statusCode;
      if (status !== 200) {
        response.resume();
        const message = status === 401 || status === 403
          ? 'Access denied. Check the credential, expiry, calendar permissions, and API access.'
          : status === 429 ? 'Provider rate limit reached. Try syncing again later.'
            : `Provider returned HTTP ${status}. Check your connection settings.`;
        reject(new Error(message));
        return;
      }
      const chunks = [];
      let size = 0;
      response.on('data', (chunk) => {
        size += chunk.length;
        if (size > 4 * 1024 * 1024) request.destroy(new Error('Provider response is too large.'));
        else chunks.push(chunk);
      });
      response.on('error', () => reject(new Error('Provider response was interrupted.')));
      response.on('end', () => {
        try { resolve({ data: JSON.parse(Buffer.concat(chunks).toString('utf8')), link: response.headers.link }); }
        catch { reject(new Error('Provider returned invalid JSON.')); }
      });
    });
    const timer = setTimeout(() => request.destroy(new Error('Provider request timed out.')), 20000);
    request.on('close', () => clearTimeout(timer));
    request.on('error', () => reject(new Error('Could not reach the provider securely. Check its address and your connection.')));
  });
}

const externalId = (provider, account, id) => `import-${provider}-${crypto.createHash('sha256').update(JSON.stringify([account, id])).digest('hex').slice(0, 40)}`;
const isoDate = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const safeURL = (value, base) => {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
};

async function fetchDeadlines(provider, settings, secrets, request = requestJSON, now = new Date()) {
  const from = new Date(now.getTime() - 30 * 86400000).toISOString();
  const until = new Date(now.getTime() + 365 * 86400000).toISOString();
  const deadlines = new Map();
  const headers = {};
  let url;
  if (provider === 'google') {
    url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(settings.calendarId)}/events`);
    url.search = new URLSearchParams({ timeMin: from, timeMax: until, singleEvents: 'true', maxResults: '2500' }).toString();
    if (settings.authMode === 'apiKey') headers['X-Goog-Api-Key'] = secrets.credential;
    else headers.Authorization = `Bearer ${secrets.credential}`;
  } else {
    url = new URL('/api/v1/planner/items', settings.baseUrl);
    url.search = new URLSearchParams({ start_date: from, end_date: until, per_page: '100' }).toString();
    headers.Authorization = `Bearer ${secrets.credential}`;
  }
  const origin = url.origin;
  const pathname = url.pathname;
  const visited = new Set();
  while (url) {
    if (visited.has(url.href) || visited.size >= 100) throw new Error('Provider pagination did not finish. Existing deadlines were kept.');
    visited.add(url.href);
    const { data, link } = await request(url, headers);
    const items = provider === 'google' ? data?.items : data;
    if (!Array.isArray(items)) throw new Error('Provider returned an unexpected event list.');
    for (const item of items) {
      let deadline;
      if (provider === 'google') {
        if (!item.id || item.status === 'cancelled') continue;
        let end = isoDate(item.end?.dateTime);
        if (item.end?.date && /^\d{4}-\d{2}-\d{2}$/.test(item.end.date) && isoDate(item.end.date)) {
          end = new Date(Date.parse(item.end.date) - 86400000).toISOString().slice(0, 10);
        }
        if (!end) continue;
        deadline = {
          id: externalId(provider, settings.calendarId, item.id), source: provider,
          title: String(item.summary || 'Untitled event').slice(0, 160),
          context: String(data.summary || settings.calendarId).slice(0, 120),
          start: isoDate(item.start?.dateTime), end, url: safeURL(item.htmlLink),
        };
      } else {
        if (!['assignment', 'quiz', 'discussion_topic', 'calendar_event'].includes(item.plannable_type)) continue;
        const end = isoDate(item.plannable_date || item.plannable?.due_at || item.plannable?.end_at);
        if (!end || item.plannable_id == null || item.plannable?.workflow_state === 'deleted') continue;
        deadline = {
          id: externalId(provider, settings.baseUrl, `${item.course_id || ''}:${item.plannable_type}:${item.plannable_id}`), source: provider,
          title: String(item.plannable?.title || item.plannable?.name || 'Untitled assignment').slice(0, 160),
          context: String(item.context_name || (item.course_id ? `Course ${item.course_id}` : 'Canvas LMS')).slice(0, 120),
          start: null, end, url: safeURL(item.html_url, settings.baseUrl),
        };
      }
      deadlines.set(deadline.id, deadline);
    }
    if (provider === 'google') {
      if (data.nextPageToken) url.searchParams.set('pageToken', data.nextPageToken);
      else url = null;
    } else {
      const next = link?.split(',').find((part) => /rel="next"/.test(part))?.match(/<([^>]+)>/)?.[1];
      url = next ? new URL(next, url) : null;
      if (url && (url.origin !== origin || url.pathname !== pathname || url.username || url.password)) {
        throw new Error('Canvas returned an unsafe pagination URL.');
      }
    }
  }
  return [...deadlines.values()];
}

module.exports = { canvasOrigin, fetchDeadlines, publicIPv4 };
