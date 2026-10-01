import { init, getState, subscribe, queueMessage, queuedMessages, flushQueue } from "../app/store.js";
import { mountChrome } from "../ui/chrome.js";

await init();
mountChrome("contact");

const form = document.getElementById("contact-form");
const feedback = document.getElementById("form-feedback");
const queueStatus = document.getElementById("queue-status");

const RULES = {
  name: (v) => (v.trim().length >= 2 ? "" : "Please enter your name (at least 2 characters)."),
  email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? "" : "Please enter a valid email address."),
  topic: (v) => (v ? "" : "Please choose a topic."),
  message: (v) => (v.trim().length >= 10 ? "" : "Message should be at least 10 characters."),
};

function showFeedback(kind, text) {
  feedback.className = `form-feedback is-visible is-${kind}`;
  feedback.textContent = text;
}

function validateField(name) {
  const input = form.elements[name];
  const errEl = form.querySelector(`[data-err="${name}"]`);
  const message = RULES[name](input.value);
  input.closest(".field").classList.toggle("is-invalid", Boolean(message));
  errEl.textContent = message;
  return !message;
}

for (const name of Object.keys(RULES)) {
  form.elements[name].addEventListener("blur", () => validateField(name));
  form.elements[name].addEventListener("input", () => {
    if (form.elements[name].closest(".field").classList.contains("is-invalid")) validateField(name);
  });
}

function paintQueue() {
  const n = queuedMessages().length;
  const s = getState();
  const offline = s.simOffline || !s.online;
  queueStatus.textContent = n
    ? `${n} message${n === 1 ? "" : "s"} waiting on this device (${offline ? "offline" : "online"}).`
    : "No queued messages.";
}

async function tryFlush() {
  const s = getState();
  if (!(s.simOffline || !s.online) && queuedMessages().length) {
    const n = flushQueue();
    showFeedback("ok", `You're back online — ${n} queued message${n === 1 ? "" : "s"} sent. Thank you.`);
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const valid = Object.keys(RULES).map(validateField).every(Boolean);
  if (!valid) {
    showFeedback("error", "Please fix the highlighted fields and try again.");
    return;
  }

  const entry = {
    name: form.elements.name.value.trim(),
    email: form.elements.email.value.trim(),
    topic: form.elements.topic.value,
    message: form.elements.message.value.trim(),
  };

  const s = getState();
  const offline = s.simOffline || !s.online;
  if (offline) {
    const n = queueMessage(entry);
    showFeedback("warn", `You're offline at the venue — message #${n} is queued on this device and will send when the link returns.`);
  } else {
    queueMessage(entry);
    const n = flushQueue();
    showFeedback("ok", `Thank you, ${entry.name.split(" ")[0]}. Your message${n ? ` (and ${n - 1} queued before it)` : ""} has been sent.`);
  }
  form.reset();
  paintQueue();
});

window.addEventListener("online", () => {
  tryFlush();
  paintQueue();
});
subscribe(() => {
  paintQueue();
  tryFlush();
});
paintQueue();
