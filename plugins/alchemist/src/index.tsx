import { useEffect, useRef } from "react";
import "./alchemist.css";
import { type AlchemistHandle, mountAlchemist } from "./AlchemistGame";
import {
  MolvisPlugin,
  type PluginAPI,
  type PluginStorage,
} from "@molcrafts/molvis-plugin";
import {
  COMMANDS,
  DIALOG_ID,
  PLUGIN_ID,
  PLUGIN_NAME,
  PLUGIN_VERSION,
} from "./version";

/**
 * Canvas game inside a host-owned dialog.
 *
 * The scrim, Escape handling, focus trap, focus restore and body scroll lock
 * used to be reimplemented here (~90 lines). They belong to the host dialog
 * shell — `api.dialogs` owns them, and reimplementing them meant this plugin
 * and the LAMMPS wizard each had their own subtly different modal.
 */
function AlchemistDialog({
  storage,
  close,
}: {
  storage: PluginStorage;
  close: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    let game: AlchemistHandle | null = mountAlchemist(el, {
      mode: "plugin",
      storage,
      onClose: close,
    });

    // The host supplies the shadcn Dialog shell. Keep the game in a compact
    // card inside it and make the game's own header the drag handle. The
    // transform is intentionally local to the dialog, so closing/reopening
    // always restores the centered position.
    const card = cardRef.current;
    const handle = el.querySelector<HTMLElement>(".alchemist-header");
    let offsetX = 0;
    let offsetY = 0;
    let dragStartX = 0;
    let dragStartY = 0;
    let originX = 0;
    let originY = 0;

    const move = (event: PointerEvent) => {
      if (!card || !handle?.hasPointerCapture(event.pointerId)) return;
      const rect = card.getBoundingClientRect();
      const proposedX = originX + event.clientX - dragStartX;
      const proposedY = originY + event.clientY - dragStartY;
      const baseLeft = rect.left - offsetX;
      const baseTop = rect.top - offsetY;
      // Keep at least the header inside the viewport so the card can always
      // be grabbed again.
      offsetX = Math.min(
        window.innerWidth - 72 - baseLeft,
        Math.max(72 - rect.width - baseLeft, proposedX),
      );
      offsetY = Math.min(
        window.innerHeight - 36 - baseTop,
        Math.max(-baseTop, proposedY),
      );
      card.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
    };
    const finish = (event: PointerEvent) => {
      if (handle?.hasPointerCapture(event.pointerId)) {
        handle.releasePointerCapture(event.pointerId);
      }
      card?.classList.remove("is-dragging");
    };
    const start = (event: PointerEvent) => {
      if (!card || !handle || event.button !== 0) return;
      if ((event.target as HTMLElement).closest("button")) return;
      dragStartX = event.clientX;
      dragStartY = event.clientY;
      originX = offsetX;
      originY = offsetY;
      handle.setPointerCapture(event.pointerId);
      card.classList.add("is-dragging");
    };

    handle?.addEventListener("pointerdown", start);
    handle?.addEventListener("pointermove", move);
    handle?.addEventListener("pointerup", finish);
    handle?.addEventListener("pointercancel", finish);
    return () => {
      handle?.removeEventListener("pointerdown", start);
      handle?.removeEventListener("pointermove", move);
      handle?.removeEventListener("pointerup", finish);
      handle?.removeEventListener("pointercancel", finish);
      game?.destroy();
      game = null;
    };
  }, [storage, close]);

  return (
    <div ref={cardRef} className="alchemist-plugin-card">
      <div ref={hostRef} className="alchemist-dialog-root" />
    </div>
  );
}

class AlchemistPlugin extends MolvisPlugin {
  readonly id = PLUGIN_ID;
  readonly name = PLUGIN_NAME;
  readonly version = PLUGIN_VERSION;

  activate(api: PluginAPI) {
    api.log.info("Alchemist plugin activated");

    api.dialogs.register({
      id: DIALOG_ID,
      title: "Alchemist",
      size: "lg",
      render: ({ close }) => (
        <AlchemistDialog storage={api.storage} close={close} />
      ),
    });

    // The command exists so the palette can open the dialog; the host tears
    // both down on deactivate, which is why this plugin no longer keeps a
    // module-level modal handle to clean up.
    api.commands.register(COMMANDS.open, () => {}, {
      toolbar: {
        id: "alchemist-open",
        label: "Alchemist",
        order: 80,
        opensDialog: DIALOG_ID,
      },
    });
  }

  deactivate(api: PluginAPI) {
    api.log.info("Alchemist plugin deactivated");
  }
}

export default new AlchemistPlugin();
