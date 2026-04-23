import {
  isOnTrackVisibilityConfig,
  isSessionVisibilityConfig,
} from '@irdashies/types';
import { useSessionVisibility } from './useSessionVisibility';
import React from 'react';
import { useDrivingState } from '@irdashies/context';

/**
 * Applies visibility configuration as a component wrapped around a widget. Shows and hides the widget as per its configuration.
 * @param props
 * @param props.visibilityConfig Visibility config for the widget
 * @param props.children Children (the widget)
 * @constructor
 */
export const WidgetVisibilityContainer = ({
  visibilityConfig,
  children,
}: {
  visibilityConfig: Record<string, unknown> | undefined;
  children: React.ReactNode;
}) => {
  const sessionSettings = isSessionVisibilityConfig(visibilityConfig)
    ? visibilityConfig
    : undefined;

  const showOnlyWhenOnTrack = isOnTrackVisibilityConfig(visibilityConfig)
    ? visibilityConfig.showOnlyWhenOnTrack
    : false;

  const isVisibleInSession = useSessionVisibility(sessionSettings);

  const { isDriving } = useDrivingState();
  const isVisibleForDrivingState = showOnlyWhenOnTrack ? isDriving : true;

  if (!isVisibleInSession || !isVisibleForDrivingState) {
    return null;
  }

  return <>{children}</>;
};
