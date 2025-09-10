import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

import { HelloWave } from '@/components/HelloWave';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

export default function HomeScreen() {
  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.reactLogo}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Sun Spotter</ThemedText>
        <HelloWave />
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Find the perfect sunny spot!</ThemedText>
        <ThemedText>
          Use the <ThemedText type="defaultSemiBold">Sun Spotter</ThemedText> tab to find out if your chosen location will be sunny or shaded at any time of day. The app analyzes nearby buildings and calculates sun position to give you accurate results.
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">How it works</ThemedText>
        <ThemedText>
          • Tap anywhere on the map to set your spot{'\n'}
          • Choose a date and time to check{'\n'}
          • See if you'll be in sun or shade{'\n'}
          • Buildings that cast shadows are highlighted
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Get started</ThemedText>
        <ThemedText>
          Switch to the <ThemedText type="defaultSemiBold">Sun Spotter</ThemedText> tab to begin finding your perfect sunny spot!
        </ThemedText>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
});
