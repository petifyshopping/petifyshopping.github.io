export default function CurrencyInput(props) {
  return (
    <span className="admin-currency-input">
      <span aria-hidden="true">₹ </span>
      <input {...props} />
    </span>
  );
}
