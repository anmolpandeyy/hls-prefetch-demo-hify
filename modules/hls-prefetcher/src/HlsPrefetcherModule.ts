import { NativeModule, requireNativeModule } from 'expo';

import { HlsPrefetcherModuleEvents } from './HlsPrefetcher.types';

declare class HlsPrefetcherModule extends NativeModule<HlsPrefetcherModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<HlsPrefetcherModule>('HlsPrefetcher');
