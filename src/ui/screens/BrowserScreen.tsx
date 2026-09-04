import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview';

import { ANTHROPIC_API_KEY, hasClaudeFallback } from '../../config';
import { hostOf, toBrowserUrl } from '../../logic/browserUrl';
import { parseJsonLdRecipe, toImportDraft, type ExtractedRecipe } from '../../logic/recipeExtract';
import { extractRecipeWithClaude, type LlmFailureReason } from '../../logic/recipeExtractLlm';
import type { RootStackScreenProps } from '../../navigation/types';
import { useAppStore } from '../../state/store';
import { colors, radius, spacing } from '../theme';

const HOME_URL = 'https://duckduckgo.com/';

/**
 * Defined once per page load. Reading the page from inside the WebView — rather
 * than fetching the URL again — is the only way to see markup that JavaScript
 * rendered, and it keeps whatever cookies/session the user is browsing with.
 */
const INJECTED_BOOTSTRAP = `
(function () {
  window.__restockExtract = function () {
    try {
      var blocks = [];
      var nodes = document.querySelectorAll('script[type="application/ld+json"]');
      for (var i = 0; i < nodes.length; i++) {
        blocks.push('<script type="application/ld+json">' + (nodes[i].textContent || '') + '<\\/script>');
      }
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'extract',
        url: location.href,
        title: document.title || '',
        html: blocks.join('\\n'),
        text: ((document.body && document.body.innerText) || '').slice(0, 40000)
      }));
    } catch (err) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'extractError',
        message: String(err)
      }));
    }
  };
})();
true;
`;

const RUN_EXTRACT = 'window.__restockExtract && window.__restockExtract(); true;';

/** The page can hang; the import button must not hang with it. */
const EXTRACT_TIMEOUT_MS = 10000;

interface ExtractPayload {
  type: string;
  url?: string;
  title?: string;
  html?: string;
  text?: string;
  message?: string;
}

export function BrowserScreen({ navigation, route }: RootStackScreenProps<'Browser'>) {
  const startUrl = route.params?.url || HOME_URL;
  const createRecipe = useAppStore((s) => s.createRecipe);
  const findRecipeBySourceUrl = useAppStore((s) => s.findRecipeBySourceUrl);

  const webRef = useRef<WebView>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [address, setAddress] = useState(route.params?.url ?? '');
  const [currentUrl, setCurrentUrl] = useState(startUrl);
  const [loading, setLoading] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [importing, setImporting] = useState(false);

  /** The page answered; the model may still be working. */
  const clearTimer = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  };

  const stopImporting = () => {
    clearTimer();
    setImporting(false);
  };

  const go = () => {
    const url = toBrowserUrl(address);
    if (!url) return;
    setCurrentUrl(url);
    setAddress(url);
  };

  const onNavigationStateChange = (nav: WebViewNavigation) => {
    setCanGoBack(nav.canGoBack);
    setCanGoForward(nav.canGoForward);
    if (nav.url) setAddress(nav.url);
  };

  const startImport = () => {
    if (importing) return;
    setImporting(true);
    timeoutRef.current = setTimeout(() => {
      setImporting(false);
      Alert.alert(
        'Import timed out',
        'The page did not respond. Wait for it to finish loading and try again.'
      );
    }, EXTRACT_TIMEOUT_MS);
    webRef.current?.injectJavaScript(RUN_EXTRACT);
  };

  const saveRecipe = (extracted: ExtractedRecipe) => {
    const draft = toImportDraft(extracted);
    if (draft.ingredients.length === 0) {
      Alert.alert('Nothing to import', 'That recipe had no readable ingredients.');
      return;
    }

    const stepNote = extracted.steps.length
      ? `\n\nIts ${extracted.steps.length} instruction steps stay on the site — Restock saves ingredients.`
      : '';

    Alert.alert(
      extracted.title,
      `${draft.ingredients.length} ingredient${draft.ingredients.length === 1 ? '' : 's'}` +
        `${draft.servings ? ` · serves ${draft.servings}` : ''}${stepNote}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save recipe',
          onPress: () => {
            // Same call the Add Recipe form makes — imports get no special path.
            const recipeId = createRecipe(draft);
            navigation.replace('RecipeDetail', { recipeId });
          },
        },
      ]
    );
  };

  const handleExtraction = async (payload: ExtractPayload) => {
    const pageUrl = payload.url ?? currentUrl;

    // Structured data first: it is exact, free, and most recipe sites publish
    // it for Google. The model only sees pages that do not.
    let extracted = parseJsonLdRecipe(payload.html ?? '', pageUrl);

    if (!extracted && hasClaudeFallback) {
      const result = await extractRecipeWithClaude(payload.text ?? '', pageUrl, {
        apiKey: ANTHROPIC_API_KEY,
      });
      if (result.ok) extracted = result.recipe;
      else {
        stopImporting();
        Alert.alert('Could not read this recipe', llmFailureMessage(result.reason));
        return;
      }
    }

    stopImporting();

    if (!extracted) {
      Alert.alert(
        'No recipe found',
        'This page does not publish recipe data that Restock can read. Open the recipe’s own page rather than a list or a search result.'
      );
      return;
    }

    const existing = findRecipeBySourceUrl(pageUrl);
    if (existing) {
      Alert.alert(
        'Already imported',
        `"${existing.title}" came from this page.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open it',
            onPress: () => navigation.replace('RecipeDetail', { recipeId: existing.id }),
          },
          { text: 'Import again', onPress: () => saveRecipe(extracted) },
        ]
      );
      return;
    }

    saveRecipe(extracted);
  };

  const onMessage = (event: WebViewMessageEvent) => {
    let payload: ExtractPayload;
    try {
      payload = JSON.parse(event.nativeEvent.data) as ExtractPayload;
    } catch {
      return;
    }
    if (payload.type !== 'extract' && payload.type !== 'extractError') return;

    // The page has answered, so the watchdog is done — but the spinner stays up
    // until extraction (which may call the model) finishes.
    clearTimer();

    if (payload.type === 'extractError') {
      stopImporting();
      Alert.alert('Could not read the page', payload.message ?? 'The page refused to be read.');
      return;
    }

    void handleExtraction(payload);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <View style={styles.addressRow}>
        <NavButton label="‹" accessibilityLabel="Back" disabled={!canGoBack} onPress={() => webRef.current?.goBack()} />
        <NavButton
          label="›"
          accessibilityLabel="Forward"
          disabled={!canGoForward}
          onPress={() => webRef.current?.goForward()}
        />
        <NavButton label="⟳" accessibilityLabel="Reload" onPress={() => webRef.current?.reload()} />
        <TextInput
          style={styles.address}
          value={address}
          onChangeText={setAddress}
          onSubmitEditing={go}
          placeholder="Search or enter a site"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={Platform.OS === 'ios' ? 'web-search' : 'default'}
          returnKeyType="go"
          selectTextOnFocus
        />
      </View>

      {loading && <View style={styles.loadingBar} />}

      <WebView
        ref={webRef}
        source={{ uri: currentUrl }}
        originWhitelist={['*']}
        style={styles.web}
        injectedJavaScript={INJECTED_BOOTSTRAP}
        onMessage={onMessage}
        onNavigationStateChange={onNavigationStateChange}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        allowsBackForwardNavigationGestures
      />

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: importing }}
          disabled={importing}
          onPress={startImport}
          style={({ pressed }) => [
            styles.importButton,
            importing && styles.importButtonBusy,
            pressed && !importing && styles.pressed,
          ]}>
          {importing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.importText}>Import this recipe</Text>
          )}
        </Pressable>
        <Text style={styles.footerHint} numberOfLines={1}>
          {hostOf(address) || 'Find a recipe, then import its ingredients'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

function llmFailureMessage(reason: LlmFailureReason): string {
  switch (reason) {
    case 'request_failed':
      return 'The reading service could not be reached. Check your connection and try again.';
    case 'refused':
      return 'The request was declined. Try a different page.';
    default:
      return 'This page has no recipe data, and reading it as text did not produce a recipe either.';
  }
}

function NavButton({
  label,
  accessibilityLabel,
  onPress,
  disabled,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.navButton,
        disabled && styles.navButtonDisabled,
        pressed && !disabled && styles.pressed,
      ]}>
      <Text style={styles.navButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  navButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  navButtonDisabled: { opacity: 0.35 },
  navButtonText: { fontSize: 17, fontWeight: '700', color: colors.text },
  address: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.text,
  },
  loadingBar: { height: 2, backgroundColor: colors.accent },
  web: { flex: 1, backgroundColor: colors.card },
  footer: {
    padding: spacing.md,
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  importButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  importButtonBusy: { opacity: 0.8 },
  importText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  footerHint: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  pressed: { opacity: 0.75 },
});
