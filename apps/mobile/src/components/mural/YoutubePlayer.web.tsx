// Player do vídeo do mural no web (testes automatizados): <iframe> do embed sem
// cookies do YouTube, 16:9. Mesma interface de YoutubePlayer.tsx.
import { createElement } from 'react';
import { StyleSheet, View } from 'react-native';

import { youtubeEmbedUrl } from '@/lib/youtube';
import { colors, radii } from '@/theme/tokens';

export interface YoutubePlayerProps {
  videoId: string;
  title: string;
}

export function YoutubePlayer({ videoId, title }: YoutubePlayerProps) {
  return (
    <View style={styles.frame}>
      {createElement('iframe', {
        src: youtubeEmbedUrl(videoId),
        title,
        allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
        allowFullScreen: true,
        style: { border: 0, width: '100%', height: '100%' },
      })}
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
});
