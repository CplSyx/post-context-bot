# Post Context Bot

Post Context Bot asks everyone who submits a post to your subreddit to explain it. When a post is made, the bot leaves a comment asking the poster to **reply with a "Post Context statement"** within a set time. If they don't, or the statement isn't good enough, the bot removes the post (or reports it to your modqueue, if you prefer).

It has two purposes:

- **Cutting down on spam and low-effort posts.** Spam bots and drive-by posters rarely come back to write an explanation.
- **Giving readers context.** Valid statements are reposted as a locked moderator comment, so everyone can see why the post is relevant.

This app is based on [reddit-submission-statement-bot](https://github.com/CplSyx/reddit-submission-statement-bot), which has been running as u/mmm-submission-bot since 2024.

## How it works

1. **A post is submitted.** The bot comments on it asking the poster to reply with a Post Context statement within the configured number of minutes, and of at least the configured length.
2. **The bot waits.** After the time limit, it checks the post again.
3. **It looks for the poster's reply.** Only replies from the original poster to the bot's request comment count. If the poster replied more than once, the bot prefers a reply containing the words "post" and "context"; otherwise it uses the longest reply.
4. **If the statement is valid** (long enough and containing any required words), the bot reposts it as a locked, moderator-distinguished comment on the post, optionally inside spoiler tags.
5. **If the statement is missing or invalid**, the bot either removes the post and leaves a comment explaining why, or reports it to the modqueue and leaves a comment, depending on your settings.
6. **Cleanup.** By default the bot deletes its request comment and the replies to it once the check is complete.

Posts that have already been removed by a moderator when the check runs are skipped, as are moderator-distinguished posts.

## Getting started

1. **Install the app** on your subreddit from the Reddit Apps Directory. The app needs moderator permissions to comment, distinguish, lock, remove and report; these are granted when you install it.
2. **Open the settings**: go to **Mod Tools → Installed Apps**, find Post Context Bot and choose **Settings**.
3. **Review the defaults.** The bot works out of the box (15 minutes, 100 characters, remove non-compliant posts), but you'll probably want to adjust the wording of the bot's comments to suit your community.
4. **Tell your users.** We suggest adding a subreddit rule explaining that posts need a Post Context statement, so posters know what to expect.

## Settings

All settings are under **Mod Tools → Installed Apps → Post Context Bot → Settings**. Settings are read again for every post, so changes take effect immediately.

| Setting | Default | What it does |
| --- | --- | --- |
| Minutes to wait for a Post Context statement | `15` | How long the poster has to reply before the bot checks. Minimum 1. |
| Minimum character length for a valid Post Context statement | `100` | Replies shorter than this are treated as invalid. |
| Required words | *(blank)* | Optional comma-separated list of words that must **all** appear in the statement (not case-sensitive), e.g. `source,context`. Leave blank for none. |
| Remove non-compliant posts? | `true` | `true` removes posts without a valid statement. `false` leaves them up and reports them to the modqueue instead. |
| Pin the request comment? | `true` | Pins the bot's request comment to the top of the post. |
| Pin the confirmation comment? | `false` | Pins the comment that reposts a valid statement. |
| Wrap quoted statement in spoiler tags? | `true` | Hides the reposted statement behind spoiler tags so it doesn't dominate the comments. |
| Delete the request comment after the check? | `true` | Removes the request comment and the replies to it once the check is done, keeping the comments tidy. |
| Body of the request comment | *(see app)* | The text of the comment asking for a statement. |
| Text posted when a post is removed | *(see app)* | The comment left on removed posts. The bot adds the specific reason (no statement, too short, or missing required words) underneath. |
| Text posted when a post is reported | *(see app)* | The comment left on reported posts when removal is turned off. |
| Footer appended to every bot comment | *"I am a bot…"* | Added to the end of every comment the bot makes. |

In the three message settings you can use `{minutes}` and `{characters}` as placeholders. They are replaced with your current time limit and minimum length wherever they appear.

## Testing it

To see the whole flow quickly, temporarily set **Minutes to wait** to `1` and **Minimum character length** to `10`, then make a test post. Reply to the bot's comment (or don't) and check the result after a minute. Remember to put the settings back afterwards.

## Support

Please report bugs or request features on [GitHub](https://github.com/CplSyx/post-context-bot/issues), or message u/CplSyx on Reddit.

## Changelog

### Latest

- Fixed `{minutes}` and `{characters}` placeholders only being replaced the first time they appeared in a message.
- Fixed a typo in the minimum character length setting label.
- Default messages now consistently say "Post Context statement".

### Initial release

- Requests a Post Context statement on every new post, with a configurable time limit.
- Validates statements by minimum length and optional required words.
- Reposts valid statements as a locked moderator comment, with optional spoiler tags and pinning.
- Removes non-compliant posts with an explanation, or reports them to the modqueue instead.
- Optionally pins the request comment and cleans it up after the check.
- Customisable wording for all bot comments, with `{minutes}` and `{characters}` placeholders.

## For developers

The source code is at https://github.com/CplSyx/post-context-bot.

```
src/
├── index.ts          # Main server setup with Hono routes
├── core/
│   ├── postlogic.ts  # Core logic for handling new posts and scheduled checks
│   └── settings.ts   # Reads app settings, with fallback defaults
└── routes/
    └── triggers.ts   # App lifecycle triggers
```

- `npm run dev`: starts development mode with live reload on your test subreddit
- `npm run deploy`: type-checks, lints and uploads a new version of the app to Reddit
- `npm run launch`: deploys and then publishes the app for review
