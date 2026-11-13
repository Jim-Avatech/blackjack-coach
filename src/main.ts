import "./styles/game.css";
import { boot } from "./ui/app";

const root = document.getElementById("app");
if (!root) throw new Error("#app missing");
boot(root);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const sw = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(sw).catch(() => {
      /* offline SW is a bonus, not required */
    });
  });
}
