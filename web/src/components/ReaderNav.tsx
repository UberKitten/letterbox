import { Show } from "solid-js";
import { store } from "../lib/store";
import { ChevronLeft, ChevronRight, Flag, Undo2, Check } from "lucide-solid";

interface Props {
  onPrev: () => void;
  onNext: () => void;
  onMarkRead: () => void;
  onToggleFlag: () => void;
  undoPending: boolean;
  onUndo: () => void;
}

export default function ReaderNav(props: Props) {
  const message = () => store.currentMessage();
  const isFlagged = () => message()?.flag?.flagStatus === "flagged";

  return (
    <nav class="reader-nav">
      <div class="nav-group">
        <button
          class="nav-btn"
          disabled={store.currentIndex() <= 0 || store.loading()}
          onClick={props.onPrev}
        >
          <ChevronLeft size={18} />
        </button>
        <button
          class="nav-btn"
          disabled={
            store.currentIndex() >= store.totalCount() - 1 || store.loading()
          }
          onClick={props.onNext}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div class="nav-group">
        <span class="nav-position">
          <Show
            when={store.totalCount() > 0}
            fallback="No posts"
          >
            {store.currentIndex() + 1} of {store.totalCount()}
          </Show>
        </span>
      </div>

      <div class="nav-group">
        <Show when={message()}>
          <button
            class={`nav-btn nav-btn-flag ${isFlagged() ? "flagged" : ""}`}
            onClick={props.onToggleFlag}
            title={isFlagged() ? "Remove flag" : "Flag for later"}
          >
            <Flag size={16} fill={isFlagged() ? "currentColor" : "none"} /> <span class="nav-label">{isFlagged() ? "Unflag" : "Flag"}</span>
          </button>

          <button
            class="nav-btn nav-btn-undo"
            disabled={!props.undoPending}
            onClick={props.onUndo}
          >
            <Undo2 size={16} /> <span class="nav-label">Undo</span>
          </button>

          <button
            class={`nav-btn ${message()?.isRead ? "nav-btn-read-done" : "nav-btn-read"}`}
            onClick={message()?.isRead ? props.onNext : props.onMarkRead}
            title={message()?.isRead ? "Next" : "Mark as read"}
          >
            <Check size={16} /> <span class="nav-label">{message()?.isRead ? "Read" : "Mark read"}</span>
          </button>
        </Show>
      </div>
    </nav>
  );
}
