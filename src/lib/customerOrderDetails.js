import { getCustomerAddressEntries } from "./customerAddress.js";

export function getCustomerOrderContactDetails(profile, address, enabledFields) {
  const details = [];
  for (const entry of getCustomerAddressEntries(address)) {
    details.push(`${entry.label}: ${entry.value}`);
  }
  let phoneWasIncluded = false;
  if (enabledFields?.phone && profile?.share_phone_in_orders && profile.phone) {
    details.push(`Phone: ${profile.phone}`);
    phoneWasIncluded = true;
  }
  const whatsappNumber = profile?.whatsapp_same_as_phone
    ? profile?.phone
    : profile?.whatsapp_phone;
  if (
    enabledFields?.whatsapp
    && profile?.share_whatsapp_in_orders
    && whatsappNumber
    && !(phoneWasIncluded && profile?.whatsapp_same_as_phone)
  ) {
    details.push(`WhatsApp: ${whatsappNumber}`);
  }
  if (enabledFields?.email && profile?.share_email_in_orders && profile.email) {
    details.push(`Email: ${profile.email}`);
  }
  return details;
}
