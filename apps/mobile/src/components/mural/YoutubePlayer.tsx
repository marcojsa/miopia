// Player do vídeo do mural no iOS/Android: o embed sem cookies do YouTube numa
// WebView 16:9, tocando dentro da página. Link para fora do player (logo do
// YouTube, vídeos sugeridos) abre no app do YouTube ou no navegador.
// No web, YoutubePlayer.web.tsx usa um <iframe>.
import { Linking, StyleSheet, View } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';

import { PLAYER_ORIGIN, youtubeEmbedUrl } from '@/lib/youtube';
import { colors, radii } from '@/theme/tokens';

export interface YoutubePlayerProps {
  videoId: string;
  title: string;
}

const EMBED_PREFIX = 'https://www.youtube-nocookie.com/embed/';

export function YoutubePlayer({ videoId, title }: YoutubePlayerProps) {
  const handleRequest = (request: WebViewNavigation & { isTopFrame?: boolean }): boolean => {
    if (request.isTopFrame === false) return true;
    if (request.url.startsWith(EMBED_PREFIX) || request.url.startsWith('about:')) return true;
    void Linking.openURL(request.url);
    return false;
  };

  return (
    <View style={styles.frame} accessibilityLabel={`Vídeo: ${title}`}>
      <WebView
        source={{ uri: youtubeEmbedUrl(videoId), headers: { Referer: `${PLAYER_ORIGIN}/` } }}
        style={styles.web}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo
        onShouldStartLoadWithRequest={handleRequest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radii.cardSm,
    overflow: 'hidden',
    backgroundColor: colors.purple950,
  },
  web: {
    flex: 1,
    backgroundColor: colors.purple950,
  },
});
