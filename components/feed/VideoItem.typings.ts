// VideoItem.typings.ts
import React from 'react';

export interface VideoItemProps {
  id?: number | string;
  uri: string;
  isActive?: boolean;
  overlay?: React.ReactNode;
  onReady?: (meta?: any) => void;
  onBuffer?: (isBuffering?: boolean) => void;
  onError?: (err?: any) => void;
  onLongVisible?: (data?: { id?: number | string; uri?: string }) => void;
  longVisibleMs?: number;
  style?: any;
}

