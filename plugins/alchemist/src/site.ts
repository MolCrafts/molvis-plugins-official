import "./alchemist.css";
import { mountAlchemist } from "./AlchemistGame";
import { NamespacedLocalStorage } from "./storage";

const root = document.querySelector<HTMLElement>("#root");
if (!root) throw new Error("Alchemist root element was not found");

document.body.classList.add("alchemist-standalone");
const game = mountAlchemist(root, {
  mode: "standalone",
  storage: new NamespacedLocalStorage(),
});

window.addEventListener(
  "pagehide",
  () => {
    game.destroy();
  },
  { once: true },
);
