export default function QuantityStepper({ value, label, onDecrease, onIncrease }) {
  return (
    <div className="store-quantity-stepper" role="group" aria-label={label}>
      <button type="button" onClick={onDecrease} aria-label={`Decrease ${label}`}>−</button>
      <span aria-live="polite">{value}</span>
      <button type="button" onClick={onIncrease} aria-label={`Increase ${label}`} disabled={value >= 99}>+</button>
    </div>
  );
}
