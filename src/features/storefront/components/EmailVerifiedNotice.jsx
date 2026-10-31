import { useEffect, useRef } from "react";
import "./emailVerifiedNotice.css";

export default function EmailVerifiedNotice({ onClose }) {
  const continueButtonRef = useRef(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    continueButtonRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab") return;
      const buttons = Array.from(
        document.querySelectorAll(".email-verified-notice button:not(:disabled)"),
      );
      if (!buttons.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [onClose]);

  return (
    <div className="email-verified-overlay">
      <button
        className="email-verified-backdrop"
        type="button"
        onClick={onClose}
        aria-label="Close welcome message"
      />
      <section
        className="email-verified-notice"
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-verified-title"
        aria-describedby="email-verified-description"
      >
        <button
          className="email-verified-close"
          type="button"
          onClick={onClose}
          aria-label="Close welcome message"
        >
          ×
        </button>
        <span className="email-verified-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="m5 12.5 4.5 4.5L19 7" />
          </svg>
        </span>
        <p className="email-verified-eyebrow">WELCOME TO PETIFY</p>
        <h2 id="email-verified-title">Your email is verified!</h2>
        <p id="email-verified-description">
          Your email address has been successfully confirmed. You’re all set to explore the store.
        </p>
        <button
          className="email-verified-continue"
          type="button"
          onClick={onClose}
          ref={continueButtonRef}
        >
          Continue shopping
        </button>
      </section>
    </div>
  );
}
