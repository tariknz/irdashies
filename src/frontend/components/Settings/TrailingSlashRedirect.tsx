import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { settingsPagePath } from './settingsPagePath';

/**
 * Sends a settings path with a trailing slash to the same path without it,
 * in place. Mounted at the settings route, so everything below it, the
 * layout, the menu and any later reader of the location, sees one form of
 * each page's path.
 */
export const TrailingSlashRedirect = ({
  children,
}: {
  children: ReactNode;
}) => {
  const location = useLocation();
  const pathname = settingsPagePath(location.pathname);
  if (pathname !== location.pathname)
    return (
      <Navigate
        to={{ pathname, search: location.search, hash: location.hash }}
        state={location.state}
        replace
      />
    );
  return children;
};
