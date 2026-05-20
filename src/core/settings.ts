import { settings } from '@devvit/web/server';


/**
 * This function obtains the application settings from the settings page
 * Remember !== false means "default to true" and vice versa  
 * async because we're requesting from Reddit and this might take time.
 * 
 * Notes on the below:
 * 
 * pinResponse where default is false:
 *      s['pinResponse'] === true
 *      user sets true  → true  === true → true  ✓
 *      user sets false → false === true → false ✓
 *      not set yet     → undefined === true → false ✓ (default)
 * 
 *  And pinRequest where default is true:
 *      s['pinRequest'] !== false
 *      user sets true  → true  !== false → true  ✓
 *      user sets false → false !== false → false ✓
 *      not set yet     → undefined !== false → true ✓ (default)
 * 
 * If it helps to read it in plain English:
 *      !== false means "true, unless the user explicitly set it to false"
 *      === true means "false, unless the user explicitly set it to true"
 */
export async function getSettings() {
    const s = await settings.getAll();
    return {
        minutes:              Math.max(1, Number(s['minutesToWait']       ?? 15)),
        characters:           Number(s['minCharLength']                   ?? 100),
        removePosts:          s['removePosts']                            !== false,
        requiredWords:        String(s['requiredWords'] ?? '').split(',').map((w: string) => w.trim().toLowerCase()).filter(Boolean),
        pinRequest:           s['pinRequest']                             !== false,
        pinResponse:          s['pinResponse']                            === true,
        useSpoilerTags:       Boolean(s['useSpoilerTags']                 !== false),
        removeRequestComment: s['removeRequestComment']                   !== false,
        ssRequestText:        String(s['ssRequestText'] ??                'We require that posters submit an explanation (a.k.a. a Post Context statement) for why their post is relevant to this subreddit. \n\nPlease **reply to this comment** within the next {minutes} minutes with a suitable Post Context statement that is at least {characters} characters in length.'),
        removalReasonText:    String(s['removalReasonText'] ??            'We require that posters submit an explanation (a.k.a. a Post Context statement) for why their post is relevant to this subreddit. Your post has been removed as it is missing this requirement.\n\nIf you wish to share your post with the community, you will need to resubmit your post and respond to the automated prompt with a Post Context statement of at least {characters} characters.'),
        reportReason:         String(s['reportReason']   ??               'We require that posters submit an explanation (a.k.a. a Post Context statement) for why their post is relevant to this subreddit.\n\nYour post has been reported for moderator attention as you have not provided this.'),
        botFooter:            String(s['botFooter']      ??               '*I am a bot, and this action was performed automatically. Please contact the moderators of this subreddit if you have any questions or concerns.*'),
    };
}
