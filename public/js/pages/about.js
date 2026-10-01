import { init } from "../app/store.js";
import { mountChrome } from "../ui/chrome.js";

await init();
mountChrome("about");
