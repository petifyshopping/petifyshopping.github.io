export default function LoadingState({ message, variant = "inline" }) {
  return (
    <div className={`app-loading app-loading--${variant}`} role="status" aria-busy="true">
      <span className="app-loading-indicator" aria-hidden="true" />
      <span className="app-loading-message">{message}</span>
    </div>
  );
}
