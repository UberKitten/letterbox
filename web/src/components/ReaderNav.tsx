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
      <div class="nav-group nav-group-left">
        <button
          class="nav-btn"
          disabled={store.currentIndex() <= 0 || store.loading()}
          onClick={props.onPrev}
        >
          <ChevronLeft size={20} />
        </button>
        <button
          class="nav-btn"
          disabled={
            store.currentIndex() >= store.totalCount() - 1 || store.loading()
          }
          onClick={props.onNext}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <Show when={message()}>
        <div class="nav-group nav-group-center">
          <button
            class="nav-btn nav-btn-undo"
            disabled={!props.undoPending}
            onClick={props.onUndo}
          >
            <Undo2 size={18} /> <span class="nav-label">Undo</span>
          </button>

          <button
            class={`nav-btn ${message()?.isRead ? "nav-btn-read-done" : "nav-btn-read"}`}
            onClick={message()?.isRead ? props.onNext : props.onMarkRead}
            title={message()?.isRead ? "Next" : "Mark as read"}
          >
            <Check size={18} /> <span class="nav-label">{message()?.isRead ? "Read" : "Mark read"}</span>
          </button>
        </div>

        <div class="nav-group nav-group-right">
          <button
            class={`nav-btn nav-btn-flag ${isFlagged() ? "flagged" : ""}`}
            onClick={props.onToggleFlag}
            title={isFlagged() ? "Remove flag" : "Flag for later"}
          >
            <Flag size={18} fill={isFlagged() ? "currentColor" : "none"} /> <span class="nav-label">{isFlagged() ? "Unflag" : "Flag"}</span>
          </button>
        </div>
      </Show>
    </nav>
  );
}
