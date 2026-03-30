import { For, Show, createMemo } from "solid-js";
import { store } from "../lib/store";
import { savePreferences } from "../api";
import { X } from "lucide-solid";
import type { FolderInfo } from "@letterbox/shared";

// System folders to hide — not useful for a reading app
const HIDDEN_FOLDERS = new Set([
  "Deleted Items",
  "Drafts",
  "Junk Email",
  "Outbox",
  "Sent Items",
  "Conversation History",
  "Sync Issues",
]);

function sortFolders(folders: FolderInfo[]): FolderInfo[] {
  return [...folders]
    .filter((f) => !HIDDEN_FOLDERS.has(f.displayName))
    .sort((a, b) => {
      // Inbox first
      if (a.displayName === "Inbox") return -1;
      if (b.displayName === "Inbox") return 1;
      return a.displayName.localeCompare(b.displayName);
    })
    .map((f) => ({
      ...f,
      childFolders: f.childFolders ? sortFolders(f.childFolders) : undefined,
    }));
}

function getAllDescendantIds(folder: FolderInfo): string[] {
  const ids: string[] = [];
  for (const child of folder.childFolders ?? []) {
    ids.push(child.id);
    ids.push(...getAllDescendantIds(child));
  }
  return ids;
}

function FolderItem(props: { folder: FolderInfo; depth: number }) {
  const isSelected = () =>
    store.selectedFolderIds().includes(props.folder.id);

  async function toggle() {
    const current = store.selectedFolderIds();
    const descendantIds = getAllDescendantIds(props.folder);
    let next: string[];

    if (isSelected()) {
      // Deselect this folder and all descendants
      const toRemove = new Set([props.folder.id, ...descendantIds]);
      next = current.filter((id) => !toRemove.has(id));
    } else {
      // Select this folder and all descendants
      const toAdd = [props.folder.id, ...descendantIds];
      const currentSet = new Set(current);
      next = [...current, ...toAdd.filter((id) => !currentSet.has(id))];
    }

    store.setSelectedFolderIds(next);
    store.setCurrentIndex(0);
    await savePreferences({ selectedFolderIds: next });
  }

  return (
    <>
      <label class="folder-item">
        <input
          type="checkbox"
          checked={isSelected()}
          onChange={toggle}
        />
        <span>{props.folder.displayName}</span>
        <span class="folder-item-count">
          {props.folder.unreadItemCount}
        </span>
      </label>
      <Show when={props.folder.childFolders?.length}>
        <div class="folder-children">
          <For each={props.folder.childFolders}>
            {(child) => <FolderItem folder={child} depth={props.depth + 1} />}
          </For>
        </div>
      </Show>
    </>
  );
}

export default function FolderPicker() {
  const sortedFolders = createMemo(() => sortFolders(store.folders()));

  return (
    <>
      <div
        class="drawer-overlay"
        onClick={() => store.setFolderDrawerOpen(false)}
      />
      <div class="drawer">
        <div class="drawer-header">
          <h2>Folders</h2>
          <button
            class="header-btn"
            onClick={() => store.setFolderDrawerOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        <div class="drawer-body">
          <For each={sortedFolders()}>
            {(folder) => <FolderItem folder={folder} depth={0} />}
          </For>
        </div>
      </div>
    </>
  );
}
