let modalPreviousFocus = null;

let aboutBtnEl = null;
let aboutModalOverlayEl = null;
let aboutModalEl = null;
let aboutModalCloseEl = null;

function getModalFocusableElements() {
  return Array.from(
    aboutModalEl.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
    ),
  );
}

function handleModalTabKey(e) {
  if (e.key !== "Tab") return;

  const focusable = getModalFocusableElements();
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const current = document.activeElement;

  if (e.shiftKey && current === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && current === last) {
    e.preventDefault();
    first.focus();
  }
}

function handleModalEscapeKey(e) {
  if (e.key === "Escape" && !aboutModalOverlayEl.hidden) {
    closeAboutModal();
  }
}

function handleModalBackdropClick(e) {
  if (e.target === aboutModalOverlayEl) {
    closeAboutModal();
  }
}

function openAboutModal() {
  modalPreviousFocus = document.activeElement;
  aboutModalOverlayEl.hidden = false;
  aboutModalCloseEl.focus();

  document.addEventListener("keydown", handleModalTabKey);
  document.addEventListener("keydown", handleModalEscapeKey);
}

function closeAboutModal() {
  aboutModalOverlayEl.hidden = true;

  document.removeEventListener("keydown", handleModalTabKey);
  document.removeEventListener("keydown", handleModalEscapeKey);

  if (modalPreviousFocus) {
    modalPreviousFocus.focus();
  }
}

export function initAboutModal() {
  aboutBtnEl = document.getElementById("aboutBtn");
  aboutModalOverlayEl = document.getElementById("aboutModalOverlay");
  aboutModalEl = document.getElementById("aboutModal");
  aboutModalCloseEl = document.getElementById("aboutModalClose");

  if (
    !aboutBtnEl ||
    !aboutModalOverlayEl ||
    !aboutModalEl ||
    !aboutModalCloseEl
  ) {
    console.warn("Modal DOM elements not found; modal will be unavailable");
    return;
  }

  aboutBtnEl.addEventListener("click", openAboutModal);
  aboutModalCloseEl.addEventListener("click", closeAboutModal);
  aboutModalOverlayEl.addEventListener("click", handleModalBackdropClick);
}
