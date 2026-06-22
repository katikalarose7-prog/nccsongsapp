import React from 'react';
import { NavigationContainer, getStateFromPath as defaultGetStateFromPath } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { UserAuthProvider } from './src/context/UserAuthContext';

import HomeScreen           from './src/screens/HomeScreen';
import SongDetailScreen     from './src/screens/SongDetailScreen';
import LoginScreen          from './src/screens/LoginScreen';
import AccountScreen        from './src/screens/AccountScreen';
import PlaylistDetailScreen from './src/screens/PlaylistDetailScreen';
import LegalScreen          from './src/screens/LegalScreen';

const Stack = createNativeStackNavigator();

// Deep link config — makes a real link like https://nccsongs.church/?song=<id>
// (the exact same link used in emails and the Share button) open the
// SongDetail screen directly when tapped on a device with the app
// installed via Universal Links (iOS) / App Links (Android). If the app
// is NOT installed, the OS falls through to opening the link in a normal
// browser instead, which lands on the website's matching ?song= handling —
// so the same link works correctly either way, automatically.
//
// The web app uses a query param (?song=id) rather than a path segment
// (/song/id), so we parse it manually via getStateFromPath rather than
// React Navigation's default path-segment config.
const linking = {
  prefixes: ['ncc-songs://', 'https://nccsongs.church'],
  config: {
    screens: {
      Home: '',
      SongDetail: 'song-detail', // fallback path-based route, kept for manual nav.navigate calls
    },
  },
  getStateFromPath: (path, options) => {
    try {
      const url = new URL(path, 'https://nccsongs.church');
      const songId = url.searchParams.get('song');
      if (songId) {
        return {
          routes: [
            { name: 'Home' },
            { name: 'SongDetail', params: { id: songId } },
          ],
        };
      }
    } catch {
      // fall through to default parsing below
    }
    return defaultGetStateFromPath(path, options);
  },
};

export default function App() {
  return (
    <UserAuthProvider>
      <NavigationContainer linking={linking}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home"            component={HomeScreen} />
          <Stack.Screen name="SongDetail"      component={SongDetailScreen} />
          <Stack.Screen name="Login"           component={LoginScreen} />
          <Stack.Screen name="Account"         component={AccountScreen} />
          <Stack.Screen name="PlaylistDetail"  component={PlaylistDetailScreen} />
          <Stack.Screen name="Legal"           component={LegalScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </UserAuthProvider>
  );
}