import {
  Show,
  createEffect,
  createMemo,
  createSignal,
  onMount,
  onCleanup,
} from "solid-js";
import { store } from "../lib/store";
import {
  getMessages,
  markAsRead,
  markAsUnread,
  toggleFlag,
  logout as apiLogout,
  type MessagePage,
} from "../api";
import type { FolderInfo, EmailMessage } from "@letterbox/shared";
import { Menu } from "lucide-solid";
import FilterBar from "./FilterBar";
import FolderPicker from "./FolderPicker";
import ArticleBody from "./ArticleBody";
import ArticleOriginal from "./ArticleOriginal";
import ReaderNav from "./ReaderNav";

function findFolder(folders: FolderInfo[], id: string): FolderInfo | undefined {
  for (const f of folders) {
    if (f.id === id) return f;
    if (f.childFolders) {
      const found = findFolder(f.childFolders, id);
      if (found) return found;
    }
  }
}

function computeFolderTotal(
  folders: FolderInfo[],
  selectedIds: string[],
  filter: string,
  hasCategory: boolean,
): number | null {
  // Can't derive count from folder metadata for flagged or category-filtered views
  if (filter === "flagged" || hasCategory) return null;

  let total = 0;
  for (const id of selectedIds) {
    const folder = findFolder(folders, id);
    if (!folder) continue;
    switch (filter) {
      case "unread":
        total += folder.unreadItemCount;
        break;
      case "read":
        total += folder.totalItemCount - folder.unreadItemCount;
        break;
      case "all":
        total += folder.totalItemCount;
        break;
    }
  }
  return total;
}

function useSystemDark(): () => boolean {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const [dark, setDark] = createSignal(mq.matches);
  const handler = (e: MediaQueryListEvent) => setDark(e.matches);
  mq.addEventListener("change", handler);
  onCleanup(() => mq.removeEventListener("change", handler));
  return dark;
}

export default function Reader() {
  const systemDark = useSystemDark();
  const articleThemeClass = createMemo(() => {
    const theme = store.articleTheme();
    if (theme === "light") return "article-light";
    if (theme === "dark") return "article-dark";
    return systemDark() ? "article-dark" : "article-light";
  });

  const [userMenuOpen, setUserMenuOpen] = createSignal(false);
  const [articleKey, setArticleKey] = createSignal(0);
  const [undoMessage, setUndoMessage] = createSignal<EmailMessage | null>(null);
  let fetchGeneration = 0;

  // --- Message cache ---
  // Keyed by index, invalidated when filter/folders change
  let cache: Map<number, EmailMessage> = new Map();
  let cacheKey = ""; // serialized filter+folder state to detect invalidation

  function currentCacheKey() {
    return JSON.stringify({
      f: store.statusFilter(),
      c: store.categoryFilter(),
      ids: store.selectedFolderIds(),
    });
  }

  function invalidateCache() {
    cache = new Map();
    cacheKey = currentCacheKey();
  }

  function storePage(page: MessagePage) {
    for (let i = 0; i < page.messages.length; i++) {
      cache.set(page.startIndex + i, page.messages[i]);
    }
  }

  // Compute total from folder metadata when possible (more accurate than API count)
  const folderTotal = createMemo(() =>
    computeFolderTotal(
      store.folders(),
      store.selectedFolderIds(),
      store.statusFilter(),
      !!store.categoryFilter(),
    ),
  );

  // Show a message from cache instantly, or fetch if missing
  async function showMessage(index: number) {
    const key = currentCacheKey();
    if (key !== cacheKey) invalidateCache();

    const cached = cache.get(index);
    if (cached) {
      store.setCurrentMessage(cached);
      setArticleKey((k) => k + 1);
      store.setLoading(false);
      return;
    }

    // Cache miss — fetch from API
    const folderIds = store.selectedFolderIds();
    if (folderIds.length === 0) {
      store.setCurrentMessage(null);
      store.setTotalCount(0);
      return;
    }

    const gen = ++fetchGeneration;
    store.setLoading(true);
    store.setError(null);

    try {
      const res = await getMessages({
        folderIds,
        skip: index,
        filter: store.statusFilter(),
        category: store.categoryFilter(),
      });
      if (gen !== fetchGeneration) return;
      storePage(res);
      const ft = folderTotal();
      store.setTotalCount(ft != null ? ft : res.totalCount);
      store.setCurrentMessage(res.messages[0] || null);
      setArticleKey((k) => k + 1);
    } catch (e: any) {
      if (gen !== fetchGeneration) return;
      store.setError(e.message);
    } finally {
      if (gen === fetchGeneration) {
        store.setLoading(false);
      }
    }
  }

  // React to index / filter / folder changes
  createEffect(() => {
    const index = store.currentIndex();
    store.statusFilter();
    store.categoryFilter();
    store.selectedFolderIds();
    showMessage(index);
  });

  function goPrev() {
    if (store.currentIndex() > 0) {
      store.setCurrentIndex(store.currentIndex() - 1);
    }
  }

  function goNext() {
    if (store.currentIndex() < store.totalCount() - 1) {
      store.setCurrentIndex(store.currentIndex() + 1);
    }
  }

  async function handleMarkRead() {
    const msg = store.currentMessage();
    if (!msg || msg.isRead) return;

    // Save for undo before advancing
    setUndoMessage(msg);

    // Fire API call in background — don't await before advancing
    markAsRead(msg.id).catch((e: any) => store.setError(e.message));

    if (store.statusFilter() === "unread") {
      // The unread list shifts: item at currentIndex is removed, so
      // what was at currentIndex+1 is now at currentIndex.
      // Grab the next message from cache BEFORE invalidating.
      const nextMsg = cache.get(store.currentIndex() + 1) || null;

      // Rebuild cache with shifted indices
      const oldCache = cache;
      cache = new Map();
      cacheKey = currentCacheKey();
      const removedIndex = store.currentIndex();
      for (const [idx, m] of oldCache) {
        if (idx <= removedIndex) continue; // skip removed and earlier
        cache.set(idx - 1, m); // shift down by 1
      }

      store.setTotalCount(store.totalCount() - 1);
      if (store.currentIndex() >= store.totalCount()) {
        store.setCurrentIndex(Math.max(0, store.totalCount() - 1));
      }

      // Show next message instantly if cached, otherwise fetch
      if (nextMsg) {
        store.setCurrentMessage(nextMsg);
        setArticleKey((k) => k + 1);
      } else {
        showMessage(store.currentIndex());
      }
    } else {
      goNext();
    }
  }

  async function handleUndo() {
    const msg = undoMessage();
    if (!msg) return;
    setUndoMessage(null);

    // Fire API call in background
    markAsUnread(msg.id).catch((e: any) => store.setError(e.message));

    if (store.statusFilter() === "unread") {
      invalidateCache();
      store.setTotalCount(store.totalCount() + 1);
      // Insert the message back and show it instantly
      store.setCurrentMessage(msg);
      setArticleKey((k) => k + 1);
    }
  }

  async function handleToggleFlag() {
    const msg = store.currentMessage();
    if (!msg) return;
    const wasFlagged = msg.flag?.flagStatus === "flagged";
    try {
      await toggleFlag(msg.id, !wasFlagged);
      store.setCurrentMessage({
        ...msg,
        flag: { flagStatus: wasFlagged ? "notFlagged" : "flagged" },
      });
    } catch (e: any) {
      store.setError(e.message);
    }
  }

  async function handleLogout() {
    await apiLogout();
    store.setUser(null);
  }

  // Keyboard shortcuts
  function onKeyDown(e: KeyboardEvent) {
    // Don't capture when typing in inputs
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLSelectElement
    ) {
      return;
    }

    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        goPrev();
        break;
      case "ArrowRight":
        e.preventDefault();
        goNext();
        break;
      case "r":
        e.preventDefault();
        handleMarkRead();
        break;
      case "z":
        if (undoMessage()) {
          e.preventDefault();
          handleUndo();
        }
        break;
      case "f":
        e.preventDefault();
        handleToggleFlag();
        break;
    }
  }

  onMount(() => document.addEventListener("keydown", onKeyDown));
  onCleanup(() => document.removeEventListener("keydown", onKeyDown));

  const message = () => store.currentMessage();

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function folderName(folderId: string): string | undefined {
    return findFolder(store.folders(), folderId)?.displayName;
  }

  return (
    <>
      {/* Header */}
      <header class="header">
        <button
          class="header-btn"
          onClick={() => store.setFolderDrawerOpen(true)}
          title="Select folders"
        >
          <Menu size={20} />
        </button>

        <span class="header-title">Letterbox</span>

        <div class="header-actions">
          <div class="user-menu">
            <button
              class="user-btn"
              onClick={() => setUserMenuOpen(!userMenuOpen())}
            >
              {store.user()?.displayName}
            </button>
            <Show when={userMenuOpen()}>
              <div class="user-dropdown">
                <button onClick={handleLogout}>Sign out</button>
              </div>
            </Show>
          </div>
        </div>
      </header>

      {/* Filter Bar */}
      <FilterBar />

      {/* Folder Drawer */}
      <Show when={store.folderDrawerOpen()}>
        <FolderPicker />
      </Show>

      {/* Main Content */}
      <div class="reader-container">
        <Show
          when={!store.loading()}
          fallback={
            <div class="reader-content">
              <div class="loading-skeleton">
                <div class="skeleton-line" />
                <div class="skeleton-line" />
                <div class="skeleton-line" />
                <div class="skeleton-line" />
                <div class="skeleton-line" />
                <div class="skeleton-line" />
                <div class="skeleton-line" />
              </div>
            </div>
          }
        >
          <Show
            when={store.selectedFolderIds().length > 0}
            fallback={
              <div class="empty-state">
                <h2>No folders selected</h2>
                <p>
                  Open the folder picker to choose which folders to read from.
                </p>
              </div>
            }
          >
            <Show
              when={message()}
              fallback={
                <div class="empty-state">
                  <h2>You're all caught up!</h2>
                  <p>No {store.statusFilter() === "all" ? "" : store.statusFilter()} posts in your selected folders.</p>
                </div>
              }
            >
              {(msg) => (
                <div class={`reader-content article-enter ${store.wideMode() ? "wide" : ""}`} style={{ "--key": articleKey() }}>
                  <div class="article-header">
                    <h1 class="article-title">
                      <Show when={!msg().isRead}>
                        <span class="unread-dot" />
                      </Show>
                      {msg().subject}
                    </h1>
                    <div class="article-meta">
                      <span>
                        {msg().from?.emailAddress?.name ||
                          msg().from?.emailAddress?.address}
                      </span>
                      <span class="article-meta-dot">&middot;</span>
                      <span>{formatDate(msg().receivedDateTime)}</span>
                      <Show when={folderName(msg().parentFolderId)}>
                        {(name) => (
                          <>
                            <span class="article-meta-dot">&middot;</span>
                            <span>{name()}</span>
                          </>
                        )}
                      </Show>
                      <Show when={msg().categories?.length > 0}>
                        <span class="article-meta-dot">&middot;</span>
                        <span>{msg().categories.join(", ")}</span>
                      </Show>
                    </div>

                    <div class="article-mode-toggle">
                      <button
                        class={`mode-btn ${store.viewMode() === "reader" ? "active" : ""}`}
                        onClick={() => store.setViewMode("reader")}
                      >
                        Reader
                      </button>
                      <button
                        class={`mode-btn ${store.viewMode() === "original" ? "active" : ""}`}
                        onClick={() => store.setViewMode("original")}
                      >
                        Original
                      </button>
                    </div>
                  </div>

                  <hr class="article-divider" />

                  <Show
                    when={store.viewMode() === "reader"}
                    fallback={
                      <ArticleOriginal
                        html={msg().body?.content || ""}
                        dark={articleThemeClass() === "article-dark"}
                      />
                    }
                  >
                    <ArticleBody
                      html={msg().body?.content || ""}
                      themeClass={articleThemeClass()}
                    />
                  </Show>
                </div>
              )}
            </Show>
          </Show>
        </Show>
      </div>

      {/* Bottom Nav */}
      <ReaderNav
        onPrev={goPrev}
        onNext={goNext}
        onMarkRead={handleMarkRead}
        onToggleFlag={handleToggleFlag}
        undoPending={!!undoMessage()}
        onUndo={handleUndo}
      />
    </>
  );
}
