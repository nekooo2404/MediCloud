import {PrismaClient} from '@prisma/client';
import {relayOne, type PublishedEvent} from './relay.js';

const prisma = new PrismaClient();
const POLL_INTERVAL_MS = Number(process.env.EVENT_RELAY_POLL_MS ?? 3000);
let stopping = false;

async function publishEvent(event: PublishedEvent): Promise<void> {
  const webhookUrl = process.env.EVENT_RELAY_WEBHOOK_URL;
  if (webhookUrl) {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-correlation-id': event.correlationId,
        ...(process.env.EVENT_RELAY_WEBHOOK_TOKEN
          ? {authorization: `Bearer ${process.env.EVENT_RELAY_WEBHOOK_TOKEN}`}
          : {}),
      },
      body: JSON.stringify(event),
    });
    if (!res.ok) {
      throw new Error(`Event webhook returned HTTP ${res.status}`);
    }
  }
}

async function runLoop(): Promise<void> {
  console.log(`[event-relay] Worker started (poll=${POLL_INTERVAL_MS}ms)`);
  while (!stopping) {
    try {
      const result = await relayOne({
        prisma,
        publisher: {publish: publishEvent},
      });
      if (!result) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    } catch (err) {
      console.error('[event-relay] Cycle error:', err instanceof Error ? err.message : 'unknown_error');
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
}

function shutdown(): void {
  stopping = true;
  prisma.$disconnect().finally(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

void runLoop();
