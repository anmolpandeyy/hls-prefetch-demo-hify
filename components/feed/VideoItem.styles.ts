// VideoItem.styles.ts
import { Dimensions, Platform, StyleSheet } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    backgroundColor: 'black',
  },
  loading: {
    position: 'absolute',
    top: SCREEN_HEIGHT / 2 - 24,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  errorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    padding: 20,
  },
  errorTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  errorMessage: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
    gap: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  overlay: {
    position: 'absolute',
    bottom: 120,
    left: 16,
    right: 16,
  },
  topLeft: {
    position: 'absolute',
    top: Platform.select({ ios: 40, android: 16 }),
    left: 16,
  },
  indexText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  bottomRight: {
    position: 'absolute',
    right: 12,
    // bottom is set dynamically in JSX based on platform
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    padding: 6,
    backgroundColor: '#0006',
    borderRadius: 24,
  },
  pauseOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  seekBarContainer: {
    position: 'absolute',
    // bottom is set dynamically in JSX based on platform
    left: 0,
    right: 0,
    height: 30, // Touch area height (visual bar is 1px at bottom)
    justifyContent: 'center',
    zIndex: 10,
  },
  seekBarBackground: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  seekBarProgress: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 1,
    backgroundColor: '#fff',
  },
});

// Export constants used in the component
export const SCREEN_WIDTH_EXPORT = SCREEN_WIDTH;
export const SCREEN_HEIGHT_EXPORT = SCREEN_HEIGHT;

