import Ionicons from '@expo/vector-icons/Ionicons';
import { searchApi } from '@org/api-client';
import type { SearchCategory, SearchResultItem } from '@org/types';
import { useQuery } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  AppText,
  Badge,
  Card,
  Divider,
  EmptyState,
  IconButton,
  ListRow,
  rowDividerInset,
  Screen,
  TextField,
} from '../../components/ui';
import { routeForDeepLink } from '../../lib/deep-links';
import { relativeTime } from '../../lib/format';
import { haptics } from '../../lib/haptics';
import { secureStore } from '../../lib/secure-store';
import { useWorkspace } from '../../lib/workspace';
import { useTheme } from '../../theme/theme';
import { radius, spacing } from '../../theme/tokens';

const CATEGORIES: Array<{ key: SearchCategory | 'all'; label: string; icon: string }> = [
  { key: 'all', label: 'All', icon: 'search-outline' },
  { key: 'channels', label: 'Channels', icon: 'grid-outline' },
  { key: 'tasks', label: 'Tasks', icon: 'checkbox-outline' },
  { key: 'docs', label: 'Docs', icon: 'document-text-outline' },
  { key: 'agents', label: 'Agents', icon: 'sparkles-outline' },
  { key: 'coworkers', label: 'Coworkers', icon: 'sparkles-outline' },
  { key: 'people', label: 'People', icon: 'people-outline' },
  { key: 'files', label: 'Files', icon: 'folder-outline' },
];

function categoryIcon(category: string): any {
  switch (category) {
    case 'channels':
      return 'grid-outline';
    case 'tasks':
      return 'checkbox-outline';
    case 'docs':
      return 'document-text-outline';
    case 'agents':
    case 'coworkers':
      return 'sparkles-outline';
    case 'people':
      return 'person-outline';
    case 'files':
      return 'document-outline';
    default:
      return 'search-outline';
  }
}

export default function GlobalSearchScreen() {
  const router = useRouter();
  const { workspaceId } = useWorkspace();
  const { colors } = useTheme();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SearchCategory | 'all'>('all');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const recentStorageKey = `recent_searches:${workspaceId}`;

  // Load recent searches from secure storage
  useEffect(() => {
    void secureStore.get(recentStorageKey).then((saved) => {
      if (saved) {
        try {
          const list = JSON.parse(saved);
          if (Array.isArray(list)) setRecentSearches(list);
        } catch {
          // ignore
        }
      }
    });
  }, [recentStorageKey]);

  // Debounce search query input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 280);
    return () => clearTimeout(timer);
  }, [query]);

  const saveRecent = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    const next = [trimmed, ...recentSearches.filter((s) => s !== trimmed)].slice(0, 8);
    setRecentSearches(next);
    void secureStore.set(recentStorageKey, JSON.stringify(next));
  };

  const clearRecents = () => {
    setRecentSearches([]);
    void secureStore.remove(recentStorageKey);
  };

  const categoryParam = selectedCategory === 'all' ? undefined : selectedCategory;

  const searchQuery = useQuery({
    queryKey: ['mobile', 'global-search', workspaceId, debouncedQuery, selectedCategory],
    queryFn: () =>
      searchApi.query(workspaceId, debouncedQuery, categoryParam, 40).catch(() => [] as SearchResultItem[]),
    enabled: Boolean(workspaceId && debouncedQuery.length >= 2),
    staleTime: 30_000,
  });

  const onSelectResult = (item: SearchResultItem) => {
    haptics.selection();
    saveRecent(debouncedQuery);

    if (item.href) {
      const route = routeForDeepLink(item.href);
      if (route.pathname !== '/notifications') {
        router.push({ pathname: route.pathname, params: route.params } as Href);
        return;
      }
    }

    // Direct fallback based on category
    switch (item.category) {
      case 'channels':
        router.push({ pathname: '/channel/[slug]', params: { slug: item.id } });
        break;
      case 'tasks':
        router.push({ pathname: '/tasks/[taskId]', params: { taskId: item.id } });
        break;
      case 'docs':
        router.push({ pathname: '/documents/[docId]', params: { docId: item.id } });
        break;
      case 'agents':
        router.push({ pathname: '/agent/[agentId]', params: { agentId: item.id } });
        break;
      case 'coworkers':
        router.push({ pathname: '/coworker/[coworkerId]', params: { coworkerId: item.id } });
        break;
      case 'people':
        router.push({ pathname: '/dm/new', params: { user: item.id } });
        break;
      default:
        break;
    }
  };

  const results = searchQuery.data ?? [];

  return (
    <Screen edges={['top', 'bottom']}>
      {/* Search Input Bar */}
      <View style={styles.headerBar}>
        <View style={styles.inputWrapper}>
          <Ionicons
            name="search-outline"
            size={20}
            color={colors.subtle}
            style={styles.searchIcon}
          />
          <View style={styles.textInputContainer}>
            <TextField
              placeholder="Search channels, tasks, docs, agents…"
              value={query}
              onChangeText={setQuery}
              autoFocus
              autoCapitalize="none"
              returnKeyType="search"
              onSubmitEditing={() => saveRecent(query)}
            />
          </View>
          {query ? (
            <IconButton
              icon="close-circle"
              label="Clear search"
              onPress={() => setQuery('')}
            />
          ) : null}
        </View>
      </View>

      {/* Filter Category Pills */}
      <View style={styles.categoryScrollContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          {CATEGORIES.map((cat) => {
            const active = selectedCategory === cat.key;
            return (
              <Pressable
                key={cat.key}
                onPress={() => {
                  haptics.selection();
                  setSelectedCategory(cat.key);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[
                  styles.categoryPill,
                  {
                    backgroundColor: active ? colors.primaryText : colors.card,
                    borderColor: active ? colors.primaryText : colors.border,
                  },
                ]}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={14}
                  color={active ? colors.background : colors.foreground}
                />
                <AppText
                  variant="caption"
                  style={{
                    color: active ? colors.background : colors.foreground,
                    fontWeight: active ? '600' : '500',
                  }}
                >
                  {cat.label}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Content Area */}
      {debouncedQuery.length < 2 ? (
        // Empty state / Recent searches
        <View style={styles.emptyContainer}>
          {recentSearches.length > 0 ? (
            <Card style={styles.recentCard}>
              <View style={styles.recentHeader}>
                <AppText variant="label">Recent searches</AppText>
                <Pressable onPress={clearRecents} hitSlop={8}>
                  <AppText variant="caption" style={{ color: colors.destructive }}>
                    Clear
                  </AppText>
                </Pressable>
              </View>
              {recentSearches.map((term, index) => (
                <View key={term}>
                  {index > 0 ? <Divider inset={rowDividerInset} /> : null}
                  <Pressable
                    onPress={() => {
                      haptics.selection();
                      setQuery(term);
                    }}
                    style={styles.recentRow}
                  >
                    <Ionicons
                      name="time-outline"
                      size={18}
                      color={colors.subtle}
                      style={{ marginRight: spacing.sm }}
                    />
                    <AppText variant="body" style={{ flex: 1 }}>
                      {term}
                    </AppText>
                    <Ionicons
                      name="arrow-forward-outline"
                      size={16}
                      color={colors.subtle}
                    />
                  </Pressable>
                </View>
              ))}
            </Card>
          ) : (
            <EmptyState
              icon="search-outline"
              title="Search everything"
              description="Type at least 2 characters to search across conversations, tasks, documents, agents, and team members."
            />
          )}
        </View>
      ) : searchQuery.isPending ? (
        <View style={styles.centered}>
          <AppText variant="muted">Searching…</AppText>
        </View>
      ) : results.length === 0 ? (
        <EmptyState
          icon="file-tray-outline"
          title="No results found"
          description={`No items matched "${debouncedQuery}" in ${selectedCategory === 'all' ? 'any category' : selectedCategory}.`}
        />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => `${item.category}:${item.id}`}
          ItemSeparatorComponent={() => <Divider inset={rowDividerInset} />}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <ListRow
              icon={categoryIcon(item.category)}
              title={item.title}
              subtitle={item.snippet || item.category}
              right={
                <View style={styles.resultRight}>
                  <Badge label={item.category} tone="neutral" />
                  {item.timestamp ? (
                    <AppText variant="caption" style={{ color: colors.subtle }}>
                      {relativeTime(item.timestamp)}
                    </AppText>
                  ) : null}
                </View>
              }
              onPress={() => onSelectResult(item)}
            />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  searchIcon: {
    marginRight: 2,
  },
  textInputContainer: {
    flex: 1,
  },
  categoryScrollContainer: {
    marginBottom: spacing.sm,
  },
  categoryRow: {
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  emptyContainer: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  recentCard: {
    paddingVertical: spacing.xs,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  resultRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
});
