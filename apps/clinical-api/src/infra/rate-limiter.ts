import {createConnection} from 'node:net';

interface RateBucket {
  count: number;
  windowStart: number;
}

const memoryBuckets = new Map<string, RateBucket>();

function encodeRespCommand(args: string[]): string {
  let out = `*${args.length}\r\n`;
  for (const arg of args) {
    out += `$${Buffer.byteLength(arg, 'utf8')}\r\n${arg}\r\n`;
  }
  return out;
}

async function redisIncrWithTtl(redisUrl: string, key: string, windowMs: number): Promise<number | null> {
  try {
    const parsed = new URL(redisUrl);
    const port = Number(parsed.port || 6379);
    const host = parsed.hostname || '127.0.0.1';
    const password = parsed.password ? decodeURIComponent(parsed.password) : null;

    return await new Promise<number | null>((resolve) => {
      const socket = createConnection({host, port});
      let settled = false;
      let buffer = '';
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          socket.destroy();
          resolve(null);
        }
      }, 250);

      const finish = (val: number | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        socket.end();
        resolve(val);
      };

      socket.on('error', () => finish(null));
      socket.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
        const lines = buffer.split('\r\n');
        // Look for integer reply from INCR
        for (const line of lines) {
          if (line.startsWith(':')) {
            const count = Number(line.slice(1));
            if (Number.isFinite(count)) {
              finish(count);
              return;
            }
          }
          if (line.startsWith('-')) {
            finish(null);
            return;
          }
        }
      });

      let payload = '';
      if (password) {
        payload += encodeRespCommand(['AUTH', password]);
      }
      const ttlSeconds = Math.max(1, Math.ceil(windowMs / 1000));
      payload += encodeRespCommand(['INCR', key]);
      payload += encodeRespCommand(['EXPIRE', key, String(ttlSeconds), 'NX']);
      socket.write(payload);
    });
  } catch {
    return null;
  }
}

export async function checkDistributedRateLimit(
  ip: string,
  limit = 300,
  windowMs = 60_000,
): Promise<boolean> {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const bucketKey = `medicloud:rl:${ip}:${Math.floor(Date.now() / windowMs)}`;
    const count = await redisIncrWithTtl(redisUrl, bucketKey, windowMs);
    if (count !== null) {
      return count <= limit;
    }
  }

  const now = Date.now();
  const current = memoryBuckets.get(ip);
  if (!current || now - current.windowStart > windowMs) {
    memoryBuckets.set(ip, {count: 1, windowStart: now});
    return true;
  }
  current.count += 1;
  return current.count <= limit;
}

const requestCounters = new Map<string, number>();
let totalDurationMs = 0;
let totalRequestCount = 0;

export function recordHttpMetric(method: string, path: string, status: number, durationMs: number): void {
  const normalizedPath = path.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id');
  const key = `${method} ${normalizedPath} ${status}`;
  requestCounters.set(key, (requestCounters.get(key) ?? 0) + 1);
  totalRequestCount += 1;
  totalDurationMs += Math.max(0, durationMs);
}

export function renderPrometheusMetrics(): string {
  const lines: string[] = [
    '# HELP medicloud_http_requests_total Total HTTP requests handled by clinical-api',
    '# TYPE medicloud_http_requests_total counter',
  ];
  for (const [key, count] of requestCounters.entries()) {
    const [method, path, status] = key.split(' ');
    lines.push(`medicloud_http_requests_total{method="${method}",path="${path}",status="${status}"} ${count}`);
  }
  lines.push(
    '# HELP medicloud_http_request_duration_ms_sum Cumulative HTTP request duration in milliseconds',
    '# TYPE medicloud_http_request_duration_ms_sum counter',
    `medicloud_http_request_duration_ms_sum ${totalDurationMs.toFixed(2)}`,
    '# HELP medicloud_http_request_duration_ms_count Total measured HTTP requests',
    '# TYPE medicloud_http_request_duration_ms_count counter',
    `medicloud_http_request_duration_ms_count ${totalRequestCount}`,
    '# HELP medicloud_process_uptime_seconds Process uptime in seconds',
    '# TYPE medicloud_process_uptime_seconds gauge',
    `medicloud_process_uptime_seconds ${process.uptime().toFixed(2)}`,
  );
  return `${lines.join('\n')}\n`;
}
