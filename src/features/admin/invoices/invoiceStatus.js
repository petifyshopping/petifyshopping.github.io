function localDate() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

export function invoiceStatus(record) {
  const status = ["draft", "sent", "paid"].includes(record.status) ? record.status : "draft";
  if (status === "sent" && record.dueDate && record.dueDate < localDate()) return "overdue";
  return status;
}
