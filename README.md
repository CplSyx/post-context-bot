# Post Context Bot

This bot has two purposes - to combat spam posts and to provide context to other users as to why a post is relevant to the subreddit.

It does this by automatically prompting posters for a statement that explains the post, and removes posts that don't comply.

This is based on https://github.com/CplSyx/reddit-submission-statement-bot, which has been running as u/mmm-submission-bot/ since 2024.

## Getting Started

1. **Install this app  to your subreddit**
2. **Configure the settings**: defaults are provided out of the box
3. **Enjoy the additional context!**

## Project Structure

```
src/
├── index.ts          # Main server setup with Hono routes
├── core/
│   └── postlogic.ts  # Core logic for handling new posts and scheduled checks
└── routes/
    └── triggers.ts   # App lifecycle triggers
```

## Issues
The source code for this bot is available here: https://github.com/CplSyx/post-context-bot.

Please raise any issues on Github if there are source code errors or improvements, or feature requests!


### Development Notes
- `npm run dev`: Starts development mode with live reload on your test subreddit

- `npm run deploy`: Uploads a new version of your app to Reddit
- `npm run launch`: Publishes your app for review and public use

Change the settings (e.g. 1 minute and 10 characters) to validate functionality!