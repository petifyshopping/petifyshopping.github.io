const ADDRESS_FIELDS = [
  ["address", "Address"],
  ["pincode", "Pincode"],
  ["place", "Place"],
  ["district", "District"],
  ["state", "State"],
];

export function parseCustomerAddress(value) {
  const rawAddress = String(value ?? "").trim();
  const parsed = Object.fromEntries(ADDRESS_FIELDS.map(([key]) => [key, ""]));
  let currentField = "";
  let hasStructuredFields = false;

  for (const line of rawAddress.split(/\r?\n/)) {
    const match = line.match(/^(Address|Pincode|Place|District|State):\s*(.*)$/i);
    if (match) {
      currentField = ADDRESS_FIELDS.find(([, label]) => label.toLowerCase() === match[1].toLowerCase())?.[0] ?? "";
      parsed[currentField] = match[2].trim();
      hasStructuredFields = true;
    } else if (currentField && line.trim()) {
      parsed[currentField] = [parsed[currentField], line.trim()].filter(Boolean).join("\n");
    }
  }

  if (!hasStructuredFields) parsed.address = rawAddress;
  return parsed;
}

export function serializeCustomerAddress(address) {
  return ADDRESS_FIELDS
    .map(([key, label]) => {
      const value = String(address[key] ?? "").trim();
      return value ? `${label}: ${value}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

export function getCustomerAddressEntries(value) {
  const parsed = parseCustomerAddress(value);
  return ADDRESS_FIELDS
    .filter(([key]) => parsed[key])
    .map(([key, label]) => ({ label, value: parsed[key] }));
}
