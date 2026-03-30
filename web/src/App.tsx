import { onMount, Show, createSignal } from "solid-js";
import { store } from "./lib/store";
import { getMe, getFolders, getCategories, getPreferences } from "./api";
import LoginScreen from "./components/LoginScreen";
import Reader from "./components/Reader";

export default function App() {
  const [ready, setReady] = createSignal(false);

  onMount(async () => {
    try {
      const user = await getMe();
      store.setUser(user);

      const [foldersRes, catsRes, prefsRes] = await Promise.all([
        getFolders(),
        getCategories().catch(() => ({ categories: [] })),
        getPreferences(),
      ]);

      store.setFolders(foldersRes.folders);
      store.setCategories(catsRes.categories);

      if (prefsRes.selectedFolderIds.length > 0) {
        store.setSelectedFolderIds(prefsRes.selectedFolderIds);
      }
    } catch {
      // Not logged in or error — show login screen
    }
    setReady(true);
  });

  return (
    <Show when={ready()} fallback={<div />}>
      <Show when={store.user()} fallback={<LoginScreen />}>
        <Reader />
      </Show>
    </Show>
  );
}
