/** @type {?Element} The element that had focus before modal opened. */
let modalPreviousFocus = null;

let aboutBtnEl = null;
let aboutModalOverlayEl = null;
let aboutModalEl = null;
let aboutModalCloseEl = null;

/**
 * Gets all focusable elements within the modal in DOM order.
 * @return {!Array<!Element>} Focusable elements.
 */
function getModalFocusableElements() {
  return Array.from(
    aboutModalEl.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
    ),
  );
}

/**
 * Handles Tab keypresses within the modal, wrapping focus to the opposite
 * end when reaching either boundary (focus trap).
 * @param {!KeyboardEvent} e Keyboard event.
 * @return {void}
 */
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

/**
 * Handles Escape keypresses, closing the modal if it's currently open.
 * @param {!KeyboardEvent} e Keyboard event.
 * @return {void}
 */
function handleModalEscapeKey(e) {
  if (e.key === "Escape" && !aboutModalOverlayEl.hidden) {
    closeAboutModal();
  }
}

/**
 * Handles backdrop clicks, closing the modal if the click targets the
 * overlay itself (not a child element).
 * @param {!MouseEvent} e Mouse event.
 * @return {void}
 */
function handleModalBackdropClick(e) {
  if (e.target === aboutModalOverlayEl) {
    closeAboutModal();
  }
}

/**
 * Opens the about modal: shows the overlay, restores focus to the close
 * button, and activates keyboard traps (Tab and Escape).
 * @return {void}
 */
function openAboutModal() {
  modalPreviousFocus = document.activeElement;
  aboutModalOverlayEl.hidden = false;
  aboutModalCloseEl.focus();

  document.addEventListener("keydown", handleModalTabKey);
  document.addEventListener("keydown", handleModalEscapeKey);
}

/**
 * Closes the about modal: hides the overlay, deactivates keyboard traps,
 * and restores focus to the element that opened it.
 * @return {void}
 */
function closeAboutModal() {
  aboutModalOverlayEl.hidden = true;

  document.removeEventListener("keydown", handleModalTabKey);
  document.removeEventListener("keydown", handleModalEscapeKey);

  if (modalPreviousFocus) {
    modalPreviousFocus.focus();
  }
}

/**
 * Looks up and caches all DOM elements the modal needs.
 * @return {void}
 */
function initModalDomRefs() {
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
  }
}

/**
 * Wires up all modal event listeners. Assumes {@link initModalDomRefs}
 * has already run.
 * @return {void}
 */
function attachModalEventListeners() {
  if (!aboutBtnEl || !aboutModalCloseEl) return;

  aboutBtnEl.addEventListener("click", openAboutModal);
  aboutModalCloseEl.addEventListener("click", closeAboutModal);
  aboutModalOverlayEl.addEventListener("click", handleModalBackdropClick);
}

/**
 * Initializes the modal on DOMContentLoaded. Safe to call multiple times
 * (subsequent calls are no-ops if refs are already initialized).
 * @return {void}
 */
document.addEventListener("DOMContentLoaded", () => {
  initModalDomRefs();
  attachModalEventListeners();
});
