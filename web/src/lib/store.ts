import { createSignal, createRoot } from "solid-js";
import type {
  EmailMessage,
  FolderInfo,
  CategoryInfo,
  StatusFilter,
} from "@letterbox/shared";

function createStore() {
  const [user, setUser] = createSignal<{
    displayName: string;
    mail: string;
  } | null>(null);
  const [folders, setFolders] = createSignal<FolderInfo[]>([]);
  const [selectedFolderIds, setSelectedFolderIds] = createSignal<string[]>([]);
  const [categories, setCategories] = createSignal<CategoryInfo[]>([]);

  const [currentMessage, setCurrentMessage] =
    createSignal<EmailMessage | null>(null);
  const [currentIndex, setCurrentIndex] = createSignal(0);
  const [totalCount, setTotalCount] = createSignal(0);

  // Restore filter from localStorage if available
  const savedFilter = (localStorage.getItem("letterbox:statusFilter") || "unread") as StatusFilter;
  const savedCategory = localStorage.getItem("letterbox:categoryFilter") || null;

  const [statusFilter, _setStatusFilter] = createSignal<StatusFilter>(savedFilter);
  const [categoryFilter, _setCategoryFilter] = createSignal<string | null>(savedCategory);

  function setStatusFilter(f: StatusFilter) {
    _setStatusFilter(f);
    localStorage.setItem("letterbox:statusFilter", f);
  }

  function setCategoryFilter(c: string | null) {
    _setCategoryFilter(c);
    if (c) {
      localStorage.setItem("letterbox:categoryFilter", c);
    } else {
      localStorage.removeItem("letterbox:categoryFilter");
    }
  }
  const [viewMode, setViewMode] = createSignal<"reader" | "original">(
    "reader",
  );
  const savedWideMode = localStorage.getItem("letterbox:wideMode") === "true";
  const [wideMode, _setWideMode] = createSignal(savedWideMode);
  function setWideMode(v: boolean) {
    _setWideMode(v);
    localStorage.setItem("letterbox:wideMode", String(v));
  }

  // OpenAI settings (stored in localStorage only — never sent to server)
  const [openaiKey, _setOpenaiKey] = createSignal(localStorage.getItem("letterbox:openaiKey") || "");
  const [openaiModel, _setOpenaiModel] = createSignal(localStorage.getItem("letterbox:openaiModel") || "gpt-4.1-mini");
  function setOpenaiKey(v: string) {
    _setOpenaiKey(v);
    if (v) localStorage.setItem("letterbox:openaiKey", v);
    else localStorage.removeItem("letterbox:openaiKey");
  }
  function setOpenaiModel(v: string) {
    _setOpenaiModel(v);
    localStorage.setItem("letterbox:openaiModel", v);
  }

  // Article theme: "auto" follows system, "light"/"dark" is explicit override
  type ArticleTheme = "auto" | "light" | "dark";
  const savedArticleTheme = (localStorage.getItem("letterbox:articleTheme") || "auto") as ArticleTheme;
  const [articleTheme, _setArticleTheme] = createSignal<ArticleTheme>(savedArticleTheme);
  function setArticleTheme(v: ArticleTheme) {
    _setArticleTheme(v);
    localStorage.setItem("letterbox:articleTheme", v);
  }
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const [folderDrawerOpen, setFolderDrawerOpen] = createSignal(false);

  return {
    user,
    setUser,
    folders,
    setFolders,
    selectedFolderIds,
    setSelectedFolderIds,
    categories,
    setCategories,
    currentMessage,
    setCurrentMessage,
    currentIndex,
    setCurrentIndex,
    totalCount,
    setTotalCount,
    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    viewMode,
    setViewMode,
    wideMode,
    setWideMode,
    articleTheme,
    setArticleTheme,
    openaiKey,
    setOpenaiKey,
    openaiModel,
    setOpenaiModel,
    loading,
    setLoading,
    error,
    setError,
    folderDrawerOpen,
    setFolderDrawerOpen,
  };
}

export const store = createRoot(createStore);
