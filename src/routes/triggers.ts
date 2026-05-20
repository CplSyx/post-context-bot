import { Hono } from 'hono';
import type { OnAppInstallRequest, TriggerResponse } from '@devvit/web/shared';

export const triggers = new Hono();

// ─── on-post-submit ────────────────────────────────────-──────────────────────

import { handleNewPost } from '../core/postlogic';
triggers.post('/on-post-submit', handleNewPost);

// ─── check-post-context ────────────────────────────────────-──────────────────────

import { checkPostContext } from '../core/postlogic';
triggers.post('/check-post-context', checkPostContext);


// ─── on-app-install ───────────────────────────────────────────────────────────

triggers.post('/on-app-install', async (c) => {
  const input = await c.req.json<OnAppInstallRequest>();
  console.log('App installed to subreddit: r/' + input.subreddit?.name);

  return c.json<TriggerResponse>(
    {
      status: 'success',
    },
    200
  );
});
