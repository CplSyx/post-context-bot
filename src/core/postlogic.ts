import { Context } from 'hono';
import { reddit, scheduler, redis } from '@devvit/web/server';
import type { TaskRequest, TaskResponse } from '@devvit/web/server';
import type { TriggerResponse } from '@devvit/web/shared';
import { getSettings } from './settings';

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * These functions ensure we are returning a correctly formatted ID
 * @param id 
 * If id is already prefixed with t3 for a post link or t1 for a comment, return it - otherwise append the correct type to the id and return that.
 */
function t3(id: string): `t3_${string}` {
  return (id.startsWith('t3_') ? id : `t3_${id}`) as `t3_${string}`;
}
function t1(id: string): `t1_${string}` {
  return (id.startsWith('t1_') ? id : `t1_${id}`) as `t1_${string}`;
}

function buildPCConfirmation(body: string, author: string, spoilers: boolean, footer: string): string {
  const header = `The following post context was provided by u/${author}:\n\n---\n\n`;
  const quoted  = spoilers ? '>!' + body.replace(/\n\n/g, '!<\n\n>!') + '!<' : body;
  return header + quoted + `\n\n---\n\nDoes this explain the post? If not, report it and a moderator will review.\n\n${footer}`;
}

// ─── handle a new post ─────────────────────────────────────────────────────────

export async function handleNewPost(c: Context): Promise<Response> {
  
  //Retreive the relevant information relating to the post and set it to variables
  const input = await c.req.json<{
    post?: {
      id?: string;
      authorId?: string;
      distinguished?: number;
    };
    author?: { id?: string; name?: string };
  }>();

  const postId   = input.post?.id;
  const authorId = input.author?.id;
  const authorName = input.author?.name ?? 'unknown user';

  //If there's no post ID or author ID then something has gone awry so exit.
  if (!postId || !authorId) {
    console.log(`[PostContext] ${new Date().toISOString()} Error obtaining new post information`);
    return c.json<TriggerResponse>({}, 200);
  }

  // Skip distinguished mod posts (distinguished != 0 means mod/admin post)
  if (input.post?.distinguished && input.post.distinguished !== 0) {
    console.log(`[PostContext] ${new Date().toISOString()} Mod post ${postId} — skipping.`);
    return c.json<TriggerResponse>({}, 200);
  }

  try {
    //Grab the settings - we do this each time in case they've been changed
    const cfg = await getSettings();

    //Generate the request comment and replace the placeholders with relevant values from the settings
    let requestText:string = cfg.ssRequestText.replace('{minutes}', String(cfg.minutes));
    requestText = requestText.replace('{characters}', String(cfg.characters));

    //Submit the comment to the post, and grab the return as a variable so we can use it later
    const requestComment = await reddit.submitComment({
      id: t3(postId),
      text: `### Post Context Request\n\n${requestText}\n\n${cfg.botFooter}`,
      runAs: 'APP',
    });

    //Pin it if needed (distinguish sets the mod label, we want that always - the boolean value in brackets determines if it's pinned or not)
    await requestComment.distinguish(cfg.pinRequest);

    console.log(`[PostContext] ${new Date().toISOString()} Context Statement requested for ${postId}; checking in ${cfg.minutes} min.`);
    
    //Add a task to the scheduler to check the post in the future for a context statement
    await scheduler.runJob({
      name: 'checkPostContext',
      data: { postId, botCommentId: requestComment.id, authorId, authorName },
      runAt: new Date(Date.now() + cfg.minutes * 60 * 1000),
    });
  } catch (e) {
    console.error(`[PostContext] on-post-submit error for ${postId}:`, e);
  }

  return c.json<TriggerResponse>({}, 200);
};

// ─── handle the scheduled check ─────────────────────────────────────────────────────────

export async function checkPostContext(c: Context): Promise<Response> {
  
  //Retreive the relevant information relating to the post and set it to variables
  const task = await c.req.json<TaskRequest<{
    postId: string;
    botCommentId: string;
    authorId: string;
  }>>();
  const { postId, botCommentId, authorId} = task.data ?? {};

  //Double check we're here for the right reason (task is set in devvit.json)
  if (task.name !== 'checkPostContext') {
    return c.json<TaskResponse>({}, 200);
  }

  //Guard to confirm we've got data set, otherwise we'll have issues later as these will be 'undefined'
  if (!postId || !botCommentId || !authorId) {
    console.log(`[PostContext] ${new Date().toISOString()} Unable to obtain post information to perform check.`);
    return c.json<TaskResponse>({}, 200);
  }

  console.log(`[PostContext] ${new Date().toISOString()} Checking for Context Statement on ${postId}...`);

  // Dedupe guard - we're checking redis here for the "handledKey" - we shouldn't ever need this as there's only a trigger on new posts... but it's useful to have just in case
  const handledKey = `cp_handled:${postId}`;
  try {
    const alreadyDone = await redis.get(handledKey);
    if (alreadyDone) {
      console.log(`[PostContext] ${new Date().toISOString()} ${postId} already handled — skipping.`);
      return c.json<TaskResponse>({}, 200);
    }
  } catch (e) {
    console.error('[PostContext] Redis get error:', e);
  }

  //Grab the settings - we do this each time in case they've been changed
  const cfg = await getSettings();

  // Fetch the post
  let post: Awaited<ReturnType<typeof reddit.getPostById>>;
  try {
    post = await reddit.getPostById(t3(postId));
  } catch {
    console.log(`[PostContext] ${new Date().toISOString()} Post ${postId} not found — likely deleted.`);
    return c.json<TaskResponse>({}, 200);
  }

  if (post.removed) {
    console.log(`[PostContext] ${new Date().toISOString()} Post ${postId} already removed by mod — skipping.`);
    return c.json<TaskResponse>({}, 200);
  }

  // Find SS: fetch all post comments and look for OP replies to the bot comment
  let ssCandidate: { body: string; authorName: string } | null = null;
  try {

    //Get the bot comment
    const botCommentFullId = t1(botCommentId);
    const botComment = await reddit.getCommentById(t1(botCommentId));
    await botComment.undistinguish();

    //We use the replies to the bot comment. If we use post.comments.all() that only gets TOP LEVEL comments... no good to us.
    const replies = await botComment.replies.all();

    //Set a filter to confirm not removed and that both the author and bot IDs are present. This confirms we've got the right comment.
    const opReplies = replies.filter(
      (r) => !r.removed && r.authorId === authorId && r.parentId === botCommentFullId
    );

    if (opReplies.length > 0) {

      // Start by assuming the longest of any replies is the post context
      let best = opReplies.reduce((a, b) => b.body.length > a.body.length ? b : a);

      // But also check if the words "post" and "context" are in any replies as that is probably the right one even if not the longest.  
      for (const r of opReplies) {
        const lower = r.body.toLowerCase();
        if (lower.includes('post') && lower.includes('context')) {
          best = r;
          break;
        }
      }
      ssCandidate = { body: best.body, authorName: best.authorName ?? '' };
    }
  } catch (e) {
    console.error('[PostContext] Error fetching comments:', e);
  }

  const isValid =
    ssCandidate !== null &&
    ssCandidate.body.length >= cfg.characters &&
    cfg.requiredWords.every((w: string) => ssCandidate!.body.toLowerCase().includes(w));

  // Delete the request comment if configured
  if (cfg.removeRequestComment) {
    try {
      
      //need to await the getCommentById and .replies.all() separately, otherwise commentstoremove is a Promise rather than an array and we can't iterate it
      const botComment = await reddit.getCommentById(t1(botCommentId));
      const replies = await botComment.replies.all();

      //Delete each of the replies to the bot
      for (const comment of replies) {
        await comment.remove();
      }

      //And delete the bot comment
      await botComment.remove();


    } catch (e) {
      console.log(`[PostContext] Could not delete request comment chain: ${e}`);
    }
  }

  if (isValid && ssCandidate) {

    const body = buildPCConfirmation(ssCandidate.body, ssCandidate.authorName, cfg.useSpoilerTags, cfg.botFooter);
    const confirmComment = await reddit.submitComment({
      id: t3(postId),
      text: body,
      runAs: 'APP',
    });
    await confirmComment.distinguish(cfg.pinResponse);
    
    await confirmComment.lock();
    console.log(`[PostContext] ${new Date().toISOString()} Post Context validated for ${postId}.`);

  } else {

    //We are here if the context statement is invalid or missing

    const reason =
      ssCandidate === null                      ? 'No post context provided'       :
      ssCandidate.body.length < cfg.characters  ? 'Post context is too short'      :
                                              'Post context missing required words';

    if (cfg.removePosts) {

      await reddit.remove(t3(postId), false);

      const rc = await reddit.submitComment({
        id: t3(postId),
        text: `${cfg.removalReasonText}\n\n*(Reason: ${reason})*\n\n${cfg.botFooter}`,
        runAs: 'APP',
      });
      await rc.distinguish(true);
      console.log(`[PostContext] ${new Date().toISOString()} Removed ${postId}: ${reason}`);

    } else {

      const postObj = await reddit.getPostById(t3(postId));
      await reddit.report(postObj, { reason: reason });
      const rc = await reddit.submitComment({
        id: t3(postId),
        text: `${cfg.reportReason}\n\n${cfg.botFooter}`,
        runAs: 'APP',
      });
      await rc.distinguish(true);
      console.log(`[PostContext] ${new Date().toISOString()} Reported ${postId}: ${reason}`);

    }
  }

  // Mark handled — 7-day TTL
  try {
    await redis.set(handledKey, '1');
    await redis.expire(handledKey, 7 * 24 * 60 * 60);
  } catch (e) {
    console.error('[PostContext] Redis set error:', e);
  }

  return c.json<TaskResponse>({}, 200);
};