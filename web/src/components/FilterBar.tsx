import { For, Show } from "solid-js";
import { store } from "../lib/store";
import { Sun, Moon } from "lucide-solid";
import type { StatusFilter } from "@letterbox/shared";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
  { value: "flagged", label: "Flagged" },
  { value: "all", label: "All" },
];

export default function FilterBar() {
  return (
    <div class="filter-bar">
      <For each={STATUS_FILTERS}>
        {(f) => (
          <button
            class={`filter-chip ${store.statusFilter() === f.value ? "active" : ""}`}
            onClick={() => {
              store.setStatusFilter(f.value);
              store.setCurrentIndex(0);
            }}
          >
            {f.label}
          </button>
        )}
      </For>

      <Show when={store.categories().length > 0}>
        <div class="filter-separator" />
        <select
          class="filter-select"
          value={store.categoryFilter() || ""}
          onChange={(e) => {
            store.setCategoryFilter(e.target.value || null);
            store.setCurrentIndex(0);
          }}
        >
          <option value="">All categories</option>
          <For each={store.categories()}>
            {(cat) => (
              <option value={cat.displayName}>{cat.displayName}</option>
            )}
          </For>
        </select>
      </Show>

      <div class="filter-spacer" />

      <button
        class={`filter-chip filter-chip-icon ${store.articleTheme() === "light" ? "active" : ""}`}
        onClick={() => store.setArticleTheme(store.articleTheme() === "light" ? "auto" : "light")}
        title="Light article background"
      >
        <Sun size={14} />
      </button>
      <button
        class={`filter-chip filter-chip-icon ${store.articleTheme() === "dark" ? "active" : ""}`}
        onClick={() => store.setArticleTheme(store.articleTheme() === "dark" ? "auto" : "dark")}
        title="Dark article background"
      >
        <Moon size={14} />
      </button>

      <div class="filter-separator" />

      <button
        class={`filter-chip ${!store.wideMode() ? "active" : ""}`}
        onClick={() => store.setWideMode(false)}
      >
        Narrow
      </button>
      <button
        class={`filter-chip ${store.wideMode() ? "active" : ""}`}
        onClick={() => store.setWideMode(true)}
      >
        Wide
      </button>
    </div>
  );
}
