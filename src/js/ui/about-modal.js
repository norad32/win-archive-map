export function initAboutModal() {
  const aboutBtnEl = document.getElementById("aboutBtn");
  const aboutModalOverlayEl = document.getElementById("aboutModalOverlay");
  const aboutModalEl = document.getElementById("aboutModal");
  const aboutModalCloseEl = document.getElementById("aboutModalClose");

  if (
    !aboutBtnEl ||
    !aboutModalOverlayEl ||
    !aboutModalEl ||
    !aboutModalCloseEl
  ) {
    console.warn("Modal DOM elements not found; modal will be unavailable");
    return null;
  }

  let previousFocus = null;

  function handleTabKey(e) {
    if (e.key !== "Tab") return;

    const focusable = getModalFocusableElements(aboutModalEl);
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

  function handleEscapeKey(e) {
    if (e.key === "Escape" && !aboutModalOverlayEl.hidden) {
      close();
    }
  }

  function handleBackdropClick(e) {
    if (e.target === aboutModalOverlayEl) {
      close();
    }
  }

  function open() {
    previousFocus = document.activeElement;
    aboutModalOverlayEl.hidden = false;
    aboutModalCloseEl.focus();

    document.addEventListener("keydown", handleTabKey);
    document.addEventListener("keydown", handleEscapeKey);
  }

  function close() {
    aboutModalOverlayEl.hidden = true;

    document.removeEventListener("keydown", handleTabKey);
    document.removeEventListener("keydown", handleEscapeKey);

    previousFocus?.focus();
  }

  function destroy() {
    close();
    aboutBtnEl.removeEventListener("click", open);
    aboutModalCloseEl.removeEventListener("click", close);
    aboutModalOverlayEl.removeEventListener("click", handleBackdropClick);
  }

  aboutBtnEl.addEventListener("click", open);
  aboutModalCloseEl.addEventListener("click", close);
  aboutModalOverlayEl.addEventListener("click", handleBackdropClick);

  return { open, close, destroy };
}

function getModalFocusableElements(modalEl) {
  return Array.from(
    modalEl.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
    ),
  );
}
