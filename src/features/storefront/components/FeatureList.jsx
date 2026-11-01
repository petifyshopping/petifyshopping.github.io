export default function FeatureList({ features }) {
  return (
    <ul className="features-grid">
      {features.map((feature) => (
        <li className="feature-item" key={feature.title}>
          <h4>{feature.title}</h4>
          <p>{feature.description}</p>
        </li>
      ))}
    </ul>
  );
}