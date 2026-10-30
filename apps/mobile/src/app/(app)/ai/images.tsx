import Ionicons from '@expo/vector-icons/Ionicons';
import { aiApi } from '@org/api-client';
import { useMutation } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Alert } from '../../../lib/alert';
import {
  AppText,
  Button,
  Card,
  IconButton,
  Screen,
} from '../../../components/ui';
import { downloadAndShare } from '../../../lib/files';
import { haptics } from '../../../lib/haptics';
import { secureStore } from '../../../lib/secure-store';
import { useWorkspace } from '../../../lib/workspace';
import { useTheme } from '../../../theme/theme';
import { radius, spacing } from '../../../theme/tokens';

interface ImageRecord {
  id: string;
  url: string;
  prompt: string;
  style: string;
  aspectRatio: string;
  createdAt: string;
}

const STYLE_PRESETS = [
  { id: 'photorealistic', label: 'Photorealistic', suffix: ', highly detailed 8k photography, realistic lighting' },
  { id: 'digital-art', label: 'Digital Art', suffix: ', vibrant digital concept art, trending on artstation' },
  { id: '3d-render', label: '3D Render', suffix: ', smooth octane render, volumetric lighting, 3d isometric' },
  { id: 'anime', label: 'Anime / Manga', suffix: ', detailed anime illustration, makoto shinkai aesthetic' },
  { id: 'minimalist', label: 'Minimalist', suffix: ', clean vector art, minimalist shapes, elegant composition' },
  { id: 'cyberpunk', label: 'Cyberpunk', suffix: ', neon-lit cyberpunk metropolis, futuristic aesthetic' },
];

const ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3'];

export default function AIImageStudioScreen() {
  const { workspaceId } = useWorkspace();
  const { colors } = useTheme();

  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('photorealistic');
  const [selectedRatio, setSelectedRatio] = useState('1:1');
  const [history, setHistory] = useState<ImageRecord[]>([]);
  const [activePreview, setActivePreview] = useState<ImageRecord | null>(null);

  const storageKey = `ai_images_history:${workspaceId}`;

  // Load history from secure storage
  useEffect(() => {
    void secureStore.get(storageKey).then((saved) => {
      if (saved) {
        try {
          const list = JSON.parse(saved);
          if (Array.isArray(list)) setHistory(list);
        } catch {
          // ignore
        }
      }
    });
  }, [storageKey]);

  const saveHistory = (items: ImageRecord[]) => {
    setHistory(items);
    void secureStore.set(storageKey, JSON.stringify(items.slice(0, 30)));
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      const preset = STYLE_PRESETS.find((s) => s.id === selectedStyle);
      const enhancedPrompt = `${prompt.trim()}${preset ? preset.suffix : ''}`;
      const res = await aiApi.generateImage(workspaceId, enhancedPrompt);
      return res.imageUrl;
    },
    onSuccess: (imageUrl) => {
      haptics.success();
      const newRecord: ImageRecord = {
        id: `img_${Date.now()}`,
        url: imageUrl,
        prompt: prompt.trim(),
        style: selectedStyle,
        aspectRatio: selectedRatio,
        createdAt: new Date().toISOString(),
      };
      saveHistory([newRecord, ...history]);
      setActivePreview(newRecord);
    },
    onError: (err) => {
      haptics.warning();
      Alert.alert('Image Generation Failed', err.message);
    },
  });

  const handleDownload = async (record: ImageRecord) => {
    haptics.selection();
    try {
      const filename = `onetab-ai-${Date.now()}.png`;
      await downloadAndShare(record.url, filename, {}, 'image/png');
    } catch (err: any) {
      Alert.alert('Share Failed', err.message);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: 'AI Image Studio' }} />

      <ScrollView contentContainerStyle={styles.container}>
        {/* Prompt Card */}
        <Card style={styles.promptCard}>
          <AppText variant="label">Describe the image you want to create</AppText>
          <TextInput
            placeholder="e.g. Modern glass office in a lush forest during golden hour sunset…"
            placeholderTextColor={colors.subtle}
            value={prompt}
            onChangeText={setPrompt}
            multiline
            numberOfLines={3}
            style={[
              styles.promptInput,
              {
                color: colors.foreground,
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
          />

          {/* Style Presets */}
          <AppText variant="caption" style={{ color: colors.subtle, marginTop: 4 }}>
            Style Preset
          </AppText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presetRow}
          >
            {STYLE_PRESETS.map((s) => {
              const active = selectedStyle === s.id;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => {
                    haptics.selection();
                    setSelectedStyle(s.id);
                  }}
                  style={[
                    styles.presetPill,
                    {
                      backgroundColor: active ? colors.primaryText : colors.background,
                      borderColor: active ? colors.primaryText : colors.border,
                    },
                  ]}
                >
                  <AppText
                    variant="caption"
                    style={{
                      color: active ? colors.background : colors.foreground,
                      fontWeight: active ? '600' : '400',
                    }}
                  >
                    {s.label}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Aspect Ratio */}
          <View style={styles.ratioRow}>
            <AppText variant="caption" style={{ color: colors.subtle }}>
              Aspect Ratio:
            </AppText>
            {ASPECT_RATIOS.map((r) => (
              <Pressable
                key={r}
                onPress={() => {
                  haptics.selection();
                  setSelectedRatio(r);
                }}
                style={[
                  styles.ratioPill,
                  {
                    backgroundColor: selectedRatio === r ? colors.selected : colors.background,
                    borderColor: selectedRatio === r ? colors.ring : colors.border,
                  },
                ]}
              >
                <AppText
                  variant="caption"
                  style={{
                    color: selectedRatio === r ? colors.primaryText : colors.foreground,
                    fontWeight: selectedRatio === r ? '600' : '400',
                  }}
                >
                  {r}
                </AppText>
              </Pressable>
            ))}
          </View>

          <Button
            label={generateMutation.isPending ? 'Generating Image…' : 'Generate Image'}
            icon="sparkles"
            disabled={!prompt.trim() || generateMutation.isPending}
            onPress={() => generateMutation.mutate()}
          />
        </Card>

        {/* Latest Result Card */}
        {generateMutation.isPending ? (
          <Card style={styles.loadingCard}>
            <ActivityIndicator size="large" color={colors.primaryText} />
            <AppText variant="body" style={{ marginTop: spacing.sm, fontWeight: '600' }}>
              Synthesizing visuals…
            </AppText>
            <AppText variant="caption" style={{ color: colors.subtle }}>
              Applying {selectedStyle} aesthetic
            </AppText>
          </Card>
        ) : history.length > 0 ? (
          <Card style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <View style={{ flex: 1 }}>
                <AppText variant="heading">Latest Creation</AppText>
                <AppText variant="caption" numberOfLines={1} style={{ color: colors.subtle }}>
                  "{history[0].prompt}"
                </AppText>
              </View>
              <IconButton
                icon="share-outline"
                label="Share"
                onPress={() => handleDownload(history[0])}
              />
            </View>

            <Pressable onPress={() => setActivePreview(history[0])}>
              <Image
                source={{ uri: history[0].url }}
                style={styles.heroImage}
                resizeMode="cover"
              />
            </Pressable>

            <View style={styles.resultActions}>
              <Button
                label="Create Variation"
                variant="secondary"
                icon="refresh-outline"
                onPress={() => {
                  setPrompt(history[0].prompt);
                  generateMutation.mutate();
                }}
                style={{ flex: 1 }}
              />
              <Button
                label="Download / Save"
                icon="download-outline"
                onPress={() => handleDownload(history[0])}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        ) : null}

        {/* History Gallery */}
        {history.length > 1 ? (
          <View style={styles.historySection}>
            <AppText variant="label" style={styles.historyTitle}>
              Past Generations ({history.length})
            </AppText>
            <View style={styles.galleryGrid}>
              {history.slice(1).map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => setActivePreview(item)}
                  style={styles.galleryThumbWrapper}
                >
                  <Image source={{ uri: item.url }} style={styles.galleryThumb} />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Fullscreen Image Preview Modal */}
      <Modal
        visible={Boolean(activePreview)}
        transparent
        animationType="fade"
        onRequestClose={() => setActivePreview(null)}
      >
        <View style={styles.fullscreenBackdrop}>
          <View style={styles.fullscreenHeader}>
            <Pressable
              onPress={() => setActivePreview(null)}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
            >
              <Ionicons name="close" size={24} color="#ffffff" />
            </Pressable>
            {activePreview ? (
              <Pressable
                onPress={() => handleDownload(activePreview)}
                accessibilityRole="button"
                accessibilityLabel="Share"
                hitSlop={8}
              >
                <Ionicons name="share-outline" size={24} color="#ffffff" />
              </Pressable>
            ) : null}
          </View>

          {activePreview ? (
            <View style={styles.fullscreenBody}>
              <Image
                source={{ uri: activePreview.url }}
                style={styles.fullscreenImage}
                resizeMode="contain"
              />
              <View style={styles.fullscreenCaption}>
                <AppText variant="body" style={{ color: '#ffffff' }}>
                  {activePreview.prompt}
                </AppText>
                <AppText variant="caption" style={{ color: '#ffffff99', marginTop: 4 }}>
                  Style: {activePreview.style} · Ratio: {activePreview.aspectRatio}
                </AppText>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    gap: spacing.md,
  },
  promptCard: {
    gap: spacing.sm,
  },
  promptInput: {
    minHeight: 80,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.sm,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  presetRow: {
    gap: spacing.xs,
    paddingVertical: 2,
  },
  presetPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  ratioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 4,
  },
  ratioPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  loadingCard: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultCard: {
    gap: spacing.sm,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroImage: {
    width: '100%',
    height: 260,
    borderRadius: radius.lg,
  },
  resultActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  historySection: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  historyTitle: {
    marginBottom: spacing.xs,
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  galleryThumbWrapper: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  galleryThumb: {
    width: '100%',
    height: '100%',
  },
  fullscreenBackdrop: {
    flex: 1,
    backgroundColor: '#000000ee',
  },
  fullscreenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl + 10,
    zIndex: 10,
  },
  fullscreenBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: '100%',
    height: '75%',
  },
  fullscreenCaption: {
    padding: spacing.md,
    width: '100%',
  },
});
