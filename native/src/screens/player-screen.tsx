import { Ionicons } from "@expo/vector-icons";
import { useEvent } from "expo";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { VideoView, useVideoPlayer, type VideoSource } from "expo-video";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  nativeApi,
  type NativeAudioTrack,
  type NativePlaybackResponse,
  type NativeSubtitleTrack,
  type NativeTitleResponse,
} from "@/api";
import { ActionButton } from "@/components/action-button";
import { FocusablePressable } from "@/components/focusable-pressable";
import { ErrorState, LoadingState } from "@/components/screen-state";
import { DEVICE_PROFILE_ID } from "@/config/profile";
import { getAniGhostDataStore } from "@/data";
import { colors, layout, radii, spacing, typography } from "@/theme";
import { activeCaption, parseWebVtt, type CaptionCue } from "@/utils/webvtt";

interface PlayerData {
  title: NativeTitleResponse;
  playback: NativePlaybackResponse;
  episodeNumber: number;
  episodeIds: string;
  audio: NativeAudioTrack;
  startAt: number;
}

export function PlayerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    slug?: string;
    episode?: string;
    ids?: string;
    audio?: string;
  }>();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<PlayerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [server, setServer] = useState<string | undefined>();
  const [requestedAudio, setRequestedAudio] = useState<NativeAudioTrack>(
    params.audio === "dub" ? "dub" : "sub",
  );
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async (signal: AbortSignal) => {
    if (!params.slug) throw new Error("This playback link is incomplete.");
    const titleResponse = await nativeApi.getTitle(params.slug, { signal });
    const episodeNumber = Math.max(1, Number(params.episode) || 1);
    const episode = titleResponse.episodes.find((item) => item.number === episodeNumber);
    const episodeIds = params.ids || episode?.ids;
    if (!episodeIds) throw new Error(`Episode ${episodeNumber} is not available.`);

    const store = await getAniGhostDataStore();
    const stored = await store.playback.get({
      profileId: DEVICE_PROFILE_ID,
      contentId: titleResponse.title.slug,
    });
    const playback = await nativeApi.getPlayback(episodeIds, {
      audio: requestedAudio,
      server,
      signal,
    });
    return {
      title: titleResponse,
      playback,
      episodeNumber,
      episodeIds,
      audio: playback.stream.audio,
      startAt: stored?.episode === episodeNumber ? stored.positionSeconds : 0,
    };
  }, [params.episode, params.ids, params.slug, requestedAudio, server]);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    void load(controller.signal)
      .then(setData)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "This episode did not load.");
        }
      });
    return () => controller.abort();
  }, [load, reloadKey]);

  if (!data && !error) return <LoadingState label="Finding the best stream" />;
  if (!data && error) {
    return <ErrorState message={error} onRetry={() => setReloadKey((value) => value + 1)} />;
  }
  if (!data) return null;

  const episode = data.title.episodes.find((item) => item.number === data.episodeNumber);
  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.root}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, spacing.sm) }]}> 
        <FocusablePressable
          accessibilityLabel="Close player"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.back}
        >
          <Ionicons color={colors.text} name="arrow-back" size={Platform.isTV ? 32 : 23} />
        </FocusablePressable>
        <View style={styles.headerCopy}>
          <Text numberOfLines={1} style={styles.headerTitle}>{data.title.title.title}</Text>
          <Text style={styles.headerMeta}>
            Episode {data.episodeNumber}{episode?.title ? ` · ${episode.title}` : ""}
          </Text>
        </View>
      </View>

      <NativeVideo
        data={data}
        onProgress={(positionSeconds, durationSeconds) => {
          void getAniGhostDataStore().then((store) =>
            store.playback.save({
              profileId: DEVICE_PROFILE_ID,
              contentId: data.title.title.slug,
              slug: data.title.title.slug,
              title: data.title.title.title,
              imageUri: episode?.thumbnailUrl ?? data.title.title.posterUrl,
              episode: data.episodeNumber,
              positionSeconds,
              durationSeconds,
              audio: data.audio,
            }),
          );
        }}
      />

      <View style={styles.controls}>
        <View style={styles.controlGroup}>
          <Text style={styles.controlTitle}>Audio</Text>
          <View style={styles.pills}>
            {(["sub", "dub"] as const).map((audio) => {
              const available = data.playback.available[audio].length > 0;
              return (
                <FocusablePressable
                  accessibilityLabel={audio === "sub" ? "Original audio with subtitles" : "English dub"}
                  accessibilityRole="button"
                  accessibilityState={{ selected: data.audio === audio, disabled: !available }}
                  disabled={!available}
                  key={audio}
                  onPress={() => {
                    setData(null);
                    setRequestedAudio(audio);
                    setServer(undefined);
                  }}
                  style={[styles.pill, data.audio === audio ? styles.pillActive : null]}
                >
                  <Text style={[styles.pillText, data.audio === audio ? styles.pillTextActive : null]}>
                    {audio === "sub" ? "Original + subtitles" : "English dub"}
                  </Text>
                </FocusablePressable>
              );
            })}
          </View>
        </View>

        <View style={styles.controlGroup}>
          <Text style={styles.controlTitle}>Server</Text>
          <View style={styles.pills}>
            {data.playback.available[data.audio].map((item) => (
              <FocusablePressable
                accessibilityRole="button"
                accessibilityState={{ selected: data.playback.stream.serverName === item }}
                key={item}
                onPress={() => {
                  setData(null);
                  setServer(item);
                }}
                style={[styles.pill, data.playback.stream.serverName === item ? styles.pillActive : null]}
              >
                <Text style={[styles.pillText, data.playback.stream.serverName === item ? styles.pillTextActive : null]}>
                  {item}
                </Text>
              </FocusablePressable>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function NativeVideo({
  data,
  onProgress,
}: {
  data: PlayerData;
  onProgress: (positionSeconds: number, durationSeconds: number) => void;
}) {
  const source = useMemo<VideoSource>(
    () => ({
      uri: data.playback.stream.url,
      contentType: "hls",
      metadata: {
        title: data.title.title.title,
        artist: `Episode ${data.episodeNumber}`,
        artwork: data.title.title.posterUrl ?? undefined,
      },
    }),
    [data],
  );
  const player = useVideoPlayer(source, (instance) => {
    instance.timeUpdateEventInterval = 0.5;
    instance.currentTime = data.startAt;
    instance.play();
  });
  const { status, error } = useEvent(player, "statusChange", { status: player.status });
  const time = useEvent(player, "timeUpdate", {
    currentTime: player.currentTime,
    bufferedPosition: player.bufferedPosition,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
  });
  const latest = useRef({ position: data.startAt, duration: 0 });
  const lastSaved = useRef(data.startAt);
  const [captionTrack, setCaptionTrack] = useState<number>(
    Math.max(0, data.playback.stream.subtitles.findIndex((track) => track.default)),
  );
  const [captionsEnabled, setCaptionsEnabled] = useState(data.playback.stream.subtitles.length > 0);
  const [cues, setCues] = useState<CaptionCue[]>([]);

  const currentTime = time.currentTime;
  latest.current = { position: currentTime, duration: player.duration };

  useEffect(() => {
    const track = data.playback.stream.subtitles[captionTrack];
    if (!captionsEnabled || !track) {
      setCues([]);
      return;
    }
    const controller = new AbortController();
    void fetch(track.url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Caption HTTP ${response.status}`);
        return response.text();
      })
      .then((text) => setCues(parseWebVtt(text)))
      .catch(() => {
        if (!controller.signal.aborted) setCues([]);
      });
    return () => controller.abort();
  }, [captionTrack, captionsEnabled, data.playback.stream.subtitles]);

  useEffect(() => {
    if (Math.abs(currentTime - lastSaved.current) >= 8 && player.duration > 0) {
      lastSaved.current = currentTime;
      onProgress(currentTime, player.duration);
    }
  }, [currentTime, onProgress, player.duration]);

  useEffect(
    () => () => {
      const value = latest.current;
      if (value.duration > 0) onProgress(value.position, value.duration);
    },
    [onProgress],
  );

  const caption = captionsEnabled ? activeCaption(cues, currentTime) : null;
  const intro = data.playback.stream.intro;
  const canSkipIntro = Boolean(intro && currentTime >= intro.start && currentTime < intro.end);
  const track = data.playback.stream.subtitles[captionTrack];

  return (
    <View style={styles.videoStage}>
      <VideoView
        allowsPictureInPicture={!Platform.isTV}
        contentFit="contain"
        fullscreenOptions={{ enable: true }}
        nativeControls
        player={player}
        style={styles.video}
      />
      {status === "loading" ? (
        <View accessibilityLabel="Buffering video" style={styles.videoLoading}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : null}
      {status === "error" ? (
        <View accessibilityLiveRegion="assertive" style={styles.videoError}>
          <Text style={styles.videoErrorTitle}>This server stopped playing</Text>
          <Text style={styles.videoErrorCopy}>{error?.message ?? "Choose another server below."}</Text>
        </View>
      ) : null}
      {caption ? (
        <View pointerEvents="none" style={styles.captionWrap}>
          <Text style={styles.caption}>{caption}</Text>
        </View>
      ) : null}
      <View style={styles.videoActions}>
        {canSkipIntro && intro ? (
          <ActionButton
            icon="play-skip-forward"
            label="Skip intro"
            onPress={() => {
              player.currentTime = intro.end;
            }}
            variant="quiet"
          />
        ) : null}
        {data.playback.stream.subtitles.length ? (
          <ActionButton
            icon={captionsEnabled ? "logo-closed-captioning" : "text-outline"}
            label={captionsEnabled ? track?.label ?? "Captions on" : "Captions off"}
            onPress={() => {
              if (!captionsEnabled) {
                setCaptionsEnabled(true);
              } else if (captionTrack + 1 < data.playback.stream.subtitles.length) {
                setCaptionTrack((value) => value + 1);
              } else {
                setCaptionsEnabled(false);
                setCaptionTrack(0);
              }
            }}
            variant="quiet"
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { minHeight: "100%", paddingBottom: Platform.isTV ? layout.tv.safeInsetVertical : spacing.xxl },
  header: { minHeight: Platform.isTV ? 104 : 76, paddingHorizontal: Platform.isTV ? layout.tv.safeInsetHorizontal : layout.phone.gutter, paddingBottom: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.md },
  back: { width: Platform.isTV ? 64 : 48, height: Platform.isTV ? 64 : 48, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, backgroundColor: colors.surface },
  headerCopy: { flex: 1 },
  headerTitle: { color: colors.text, fontSize: Platform.isTV ? typography.tv.title : typography.phone.lead, fontWeight: typography.weight.bold },
  headerMeta: { marginTop: 3, color: colors.textMuted, fontSize: Platform.isTV ? typography.tv.micro : typography.phone.caption },
  videoStage: { width: "100%", maxWidth: 1920, alignSelf: "center", aspectRatio: layout.backdropAspectRatio, overflow: "hidden", backgroundColor: colors.black },
  video: { ...StyleSheet.absoluteFillObject },
  videoLoading: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.34)" },
  videoError: { ...StyleSheet.absoluteFillObject, padding: spacing.xl, alignItems: "center", justifyContent: "center", backgroundColor: colors.scrimStrong },
  videoErrorTitle: { color: colors.text, fontSize: Platform.isTV ? typography.tv.title : typography.phone.title, fontWeight: typography.weight.bold, textAlign: "center" },
  videoErrorCopy: { marginTop: spacing.sm, color: colors.textMuted, fontSize: Platform.isTV ? typography.tv.body : typography.phone.body, textAlign: "center" },
  captionWrap: { position: "absolute", left: spacing.lg, right: spacing.lg, bottom: Platform.isTV ? 96 : 72, alignItems: "center" },
  caption: { maxWidth: Platform.isTV ? 1240 : 720, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, color: colors.text, fontSize: Platform.isTV ? 34 : 19, lineHeight: Platform.isTV ? 44 : 26, fontWeight: typography.weight.semibold, textAlign: "center", backgroundColor: "rgba(0,0,0,0.82)" },
  videoActions: { position: "absolute", right: spacing.md, bottom: spacing.md, flexDirection: "row", gap: spacing.sm },
  controls: { paddingHorizontal: Platform.isTV ? layout.tv.safeInsetHorizontal : layout.phone.gutter, paddingTop: spacing.lg, gap: spacing.lg },
  controlGroup: { gap: spacing.sm },
  controlTitle: { color: colors.text, fontSize: Platform.isTV ? typography.tv.caption : typography.phone.body, fontWeight: typography.weight.bold },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  pill: { minHeight: Platform.isTV ? 58 : layout.phone.minimumTapTarget, paddingHorizontal: Platform.isTV ? spacing.lg : spacing.md, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, backgroundColor: colors.surface },
  pillActive: { backgroundColor: colors.accent },
  pillText: { color: colors.textMuted, fontSize: Platform.isTV ? typography.tv.micro : typography.phone.caption, fontWeight: typography.weight.semibold },
  pillTextActive: { color: colors.text },
});
