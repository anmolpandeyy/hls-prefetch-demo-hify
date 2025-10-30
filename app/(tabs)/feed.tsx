// src/Feed.js
import VideoItem from '@/components/feed/VideoItem';
import { fetchHlsSegments } from '@/utils/fetchHlsSegments';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import React, { useCallback, useRef, useState } from 'react';
import { Dimensions, FlatList } from 'react-native';


const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const PLAYLISTS = [
  // 'https://www.w3schools.com/html/mov_bbb.mp4',
  // 'https://assets.hify.club/full-replays/2447/36/segment_000.ts',
  'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_4x3/gear1/prog_index.m3u8',
  'https://assets.hify.club/full-replays/2447/36/playlist.m3u8',
  // 'https://assets.hify.club/full-replays/2447/36/playlist.m3u8',
  // 'https://assets.hify.club/full-replays/2562/33/playlist.m3u8',
  // 'https://assets.hify.club/full-replays/2635/59/playlist.m3u8',
  // 'https://assets.hify.club/full-replays/2777/39/playlist.m3u8',
  // 'https://assets.hify.club/full-replays/2506/39/playlist.m3u8',
  // 'https://assets.hify.club/full-replays/2729/39/playlist.m3u8',
  // 'https://assets.hify.club/full-replays/2732/49/playlist.m3u8',
  // 'https://assets.hify.club/full-replays/2638/49/playlist.m3u8',
];

export default function Feed() {
  const tabBarHeight = useBottomTabBarHeight?.() ?? 0;
  const ITEM_HEIGHT = SCREEN_HEIGHT - tabBarHeight;
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatRef = useRef(null);


  async function prefetchFirstSegments(uri) {
    try {
      const result = await fetchHlsSegments(uri, {
        limit: 1, // only first 5 segments
        concurrency: 2,
        onProgress: (url, ok) => console.log('Prefetched', url, ok ? '✅' : '❌')
      });
      console.log(`Prefetched ${result.fetched}/${result.total} segments`);
    } catch (e) {
      console.warn('Prefetch error', e);
    }
  }

  const renderItem = useCallback(({ item, index }) => (
    <VideoItem
      id={index}
      uri={item}
      isActive={index === currentIndex}
      style={{ height: ITEM_HEIGHT }}
      onLongVisible={({ uri }) => {
        // Optional: prefetch logic (e.g., fetch remaining segments)
        // prefetchFirstSegments(uri);
      }}
    />
  ), [currentIndex, ITEM_HEIGHT]);

  const getItemLayout = useCallback((_, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  }), [ITEM_HEIGHT]);

  const onMomentumScrollEnd = useCallback((evt) => {
    const offsetY = evt.nativeEvent.contentOffset.y;
    const newIndex = Math.round(offsetY / ITEM_HEIGHT);
    setCurrentIndex(newIndex);
  }, [ITEM_HEIGHT]);

  return (
    <FlatList
      ref={flatRef}
      data={PLAYLISTS}
      renderItem={renderItem}
      keyExtractor={(item, i) => `${i}-${item}`}
      snapToInterval={ITEM_HEIGHT}
      snapToAlignment="start"
      decelerationRate="fast"
      disableIntervalMomentum
      getItemLayout={getItemLayout}
      initialNumToRender={2}
      maxToRenderPerBatch={2}
      windowSize={3}
      showsVerticalScrollIndicator={false}
      onMomentumScrollEnd={onMomentumScrollEnd}
    />
  );
}










// import VideoItem from '@/components/feed/VideoItem';
// import React from 'react';
// import { Dimensions, FlatList, StyleSheet } from 'react-native';

// const { width } = Dimensions.get('window');

// const Feed = () => {
//  const videos = [
//     'https://www.w3schools.com/html/mov_bbb.mp4',
//     'https://assets.hify.club/full-replays/2447/36/playlist.m3u8'
//   ];

//   // return (
//   //   <View style={styles.container}>
//   //     <Video
//   //       source={{ uri: 'https://www.w3schools.com/html/mov_bbb.mp4' }}
//   //       style={styles.video}
//   //       resizeMode="cover"
//   //       controls={true}
//   //       repeat
//   //       paused={false}
//   //     />
//   //   </View>
//   // );

//     return (
//     <FlatList
//       data={videos}
//       renderItem={({ item, index }) => (
//         <VideoItem id={`id+${index}`} uri={item} isActive={index === 0} />
//       )}
//       keyExtractor={(item, i) => i.toString()}
//     />
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: 'black',
//   },
//   video: {
//     width,
//     height: '100%',
//   },
// });

// export default Feed;
