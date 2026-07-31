import "./alchemist.css";
import { mountAlchemist, type AlchemistHandle } from "./AlchemistGame";
import type { MolvisPluginModule, PluginAPI } from "./types/plugin-api";

interface ModalController {
  show(): void;
  hide(): void;
  destroy(): void;
}

let modal: ModalController | null = null;

function createModal(api: PluginAPI): ModalController {
  const host = document.createElement("div");
  host.className = "alchemist-modal-host";
  host.hidden = true;
  host.setAttribute("role", "dialog");
  host.setAttribute("aria-modal", "true");
  host.setAttribute("aria-label", "Alchemist game");

  const mountPoint = document.createElement("div");
  host.append(mountPoint);
  document.body.append(host);

  let previousFocus: HTMLElement | null = null;
  let previousOverflow = "";
  let visible = false;
  let game: AlchemistHandle;

  const hide = (): void => {
    if (!visible) return;
    visible = false;
    game.pause();
    host.hidden = true;
    document.body.style.overflow = previousOverflow;
    previousFocus?.focus({ preventScroll: true });
    previousFocus = null;
  };

  game = mountAlchemist(mountPoint, {
    mode: "plugin",
    storage: api.storage,
    onClose: hide,
  });

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!visible) return;
    if (event.key === "Escape") {
      event.preventDefault();
      hide();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      host.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter(
      (element) =>
        !element.hidden && element.getClientRects().length > 0,
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  host.addEventListener("keydown", onKeyDown);

  return {
    show() {
      if (visible) return;
      visible = true;
      previousFocus =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      host.hidden = false;
      game.resume();
      requestAnimationFrame(() => {
        host
          .querySelector<HTMLElement>("[data-overlay-action]")
          ?.focus({ preventScroll: true });
      });
    },
    hide,
    destroy() {
      host.removeEventListener("keydown", onKeyDown);
      if (visible) document.body.style.overflow = previousOverflow;
      game.destroy();
      host.remove();
      visible = false;
    },
  };
}

const plugin: MolvisPluginModule = {
  id: "com.molcrafts.alchemist",
  name: "Alchemist",
  version: "0.1.0",

  activate(api) {
    api.log.info("Alchemist plugin activated");
    api.commands.register(
      "alchemist.open",
      () => {
        modal ??= createModal(api);
        modal.show();
      },
      {
        toolbar: {
          id: "alchemist-open",
          label: "Alchemist",
          order: 80,
        },
      },
    );
  },

  deactivate(api) {
    modal?.destroy();
    modal = null;
    api.log.info("Alchemist plugin deactivated");
  },
};

export default plugin;
