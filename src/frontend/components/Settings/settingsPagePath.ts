/**
 * A settings path without a trailing slash. The routes ignore one, so a
 * bookmarked or typed `/settings/profiles/` is the Profiles page, and every
 * check of which page is open has to see it the same way.
 */
export const settingsPagePath = (pathname: string): string =>
  pathname.replace(/(.)\/+$/, '$1');
