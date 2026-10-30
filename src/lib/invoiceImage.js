import { formatProductPrice } from "./productPricing.js";

const pageWidth = 1240;
const pageMargin = 88;
const contentWidth = pageWidth - pageMargin * 2;
const lineHeight = 32;

function wrapText(context, value, maxWidth) {
  const paragraphs = String(value ?? "").split(/\r?\n/);
  return paragraphs.flatMap((paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) return [""];
    const lines = [];
    let line = "";
    words.forEach((word) => {
      const next = line ? `${line} ${word}` : word;
      if (line && context.measureText(next).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    });
    lines.push(line);
    return lines;
  });
}

function loadInvoiceLogo(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The invoice logo could not be loaded for image sharing. Try another logo or use Print / Save PDF."));
    image.src = url;
  });
}

function drawWrappedText(context, lines, x, y, { color, font, line = lineHeight } = {}) {
  context.fillStyle = color ?? "#526579";
  context.font = font ?? "22px Arial, sans-serif";
  lines.forEach((text, index) => context.fillText(text, x, y + index * line));
  return y + lines.length * line;
}

function drawContainedImage(context, image, x, y, width, height) {
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawnWidth = image.naturalWidth * scale;
  const drawnHeight = image.naturalHeight * scale;
  context.drawImage(image, x + (width - drawnWidth) / 2, y + (height - drawnHeight) / 2, drawnWidth, drawnHeight);
}

export async function createInvoiceImage(invoice, totals) {
  const logoUrl = invoice.businessDetails.visible.logo ? invoice.businessDetails.values.logoUrl : "";
  const logo = logoUrl ? await loadInvoiceLogo(logoUrl) : null;
  const measureCanvas = document.createElement("canvas");
  const measureContext = measureCanvas.getContext("2d");
  if (!measureContext) throw new Error("This browser could not prepare the invoice image.");

  measureContext.font = "22px Arial, sans-serif";
  const businessLines = [
    ...(invoice.businessDetails.visible.businessName ? wrapText(measureContext, invoice.businessDetails.values.businessName, 510) : []),
    ...["phone", "email", "address"].flatMap((key) => (
      invoice.businessDetails.visible[key] && invoice.businessDetails.values[key]
        ? wrapText(measureContext, invoice.businessDetails.values[key], 510)
        : []
    )),
  ];
  const mottoLines = invoice.businessDetails.visible.tagline && invoice.businessDetails.values.tagline
    ? wrapText(measureContext, invoice.businessDetails.values.tagline, 510)
    : [];
  const invoiceCustomer = invoice.customerDetails.source === "saved"
    ? invoice.customerDetails.savedCustomer ?? {}
    : invoice.customerDetails.source === "invoice"
      ? invoice.customerDetails.invoiceCustomer ?? {}
      : invoice.customerDetails.manualCustomer ?? invoice.customerDetails;
  const customerLines = invoice.customerDetails.enabled
    ? [
      ...["name", "phone", "address"].flatMap((key) => (
        invoiceCustomer[key] ? wrapText(measureContext, invoiceCustomer[key], contentWidth) : []
      )),
      ...(invoice.customerDetails.deliveryPartner
        ? wrapText(measureContext, `Delivery partner: ${invoice.customerDetails.deliveryPartner}`, contentWidth)
        : []),
    ]
    : [];
  const customerBlockHeight = customerLines.length ? 70 + customerLines.length * 32 : 0;
  const itemRows = invoice.items.map((item) => {
    const descriptionLines = wrapText(measureContext, item.description || "Item", 530);
    return { item, descriptionLines, height: Math.max(58, descriptionLines.length * 30 + 24) };
  });
  const notesLines = invoice.notes ? wrapText(measureContext, invoice.notes, contentWidth) : [];
  const headerHeight = Math.max(
    175,
    70 + businessLines.length * 32,
    logo ? 162 + mottoLines.length * 26 + businessLines.length * 32 : 70 + mottoLines.length * 26 + businessLines.length * 32,
  );
  const plannedHeight = pageMargin * 2 + headerHeight + customerBlockHeight + 68
    + itemRows.reduce((height, row) => height + row.height, 0)
    + 230 + (notesLines.length ? 110 + notesLines.length * 32 : 0);
  const canvas = document.createElement("canvas");
  canvas.width = pageWidth;
  canvas.height = Math.max(1754, plannedHeight);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not prepare the invoice image.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.textBaseline = "alphabetic";

  const business = invoice.businessDetails;
  let businessY = pageMargin + 24;
  if (logo) {
    if (business.logoBlueBackground === true) {
      context.fillStyle = "#173f67";
      context.fillRect(pageMargin, pageMargin, 284, 130);
    }
    drawContainedImage(context, logo, pageMargin + 14, pageMargin + 14, 256, 102);
    businessY = pageMargin + 162;
  }
  if (mottoLines.length) {
    businessY = drawWrappedText(context, mottoLines, pageMargin, businessY, {
      color: "#526579",
      font: "italic 20px Arial, sans-serif",
      line: 26,
    });
  }
  if (business.visible.businessName && business.values.businessName) {
    const lines = wrapText(context, business.values.businessName, 510);
    businessY = drawWrappedText(context, lines, pageMargin, businessY, { color: "#163b5c", font: "bold 28px Arial, sans-serif", line: 35 });
  }
  ["phone", "email", "address"].forEach((key) => {
    if (!business.visible[key] || !business.values[key]) return;
    businessY = drawWrappedText(context, wrapText(context, business.values[key], 510), pageMargin, businessY + 2);
  });

  const rightX = pageWidth - pageMargin;
  context.textAlign = "right";
  context.fillStyle = "#163b5c";
  context.font = "bold 48px Arial, sans-serif";
  context.fillText("INVOICE", rightX, pageMargin + 56);
  context.fillStyle = "#526579";
  context.font = "22px Arial, sans-serif";
  [
    `No. ${invoice.invoiceNumber || "—"}`,
    `Date ${invoice.issueDate || "—"}`,
    ...(invoice.dueDate ? [`Due ${invoice.dueDate}`] : []),
  ].forEach((text, index) => context.fillText(text, rightX, pageMargin + 100 + index * 34));
  context.textAlign = "left";
  const headerBottom = pageMargin + headerHeight;
  context.fillStyle = "#163b5c";
  context.fillRect(pageMargin, headerBottom, contentWidth, 3);

  let y = headerBottom + 48;
  if (customerLines.length) {
    context.fillStyle = "#526579";
    context.font = "bold 18px Arial, sans-serif";
    context.fillText("CUSTOMER DETAILS", pageMargin, y);
    y += 38;
    y = drawWrappedText(context, customerLines, pageMargin, y, {
      color: "#172b3e",
      font: "22px Arial, sans-serif",
    });
    y += 30;
  }

  const descriptionX = pageMargin + 12;
  const quantityX = pageWidth - pageMargin - 365;
  const unitX = pageWidth - pageMargin - 180;
  const amountX = pageWidth - pageMargin - 12;
  context.fillStyle = "#edf3f8";
  context.fillRect(pageMargin, y, contentWidth, 48);
  context.fillStyle = "#526579";
  context.font = "bold 17px Arial, sans-serif";
  context.textAlign = "left";
  context.fillText("ITEM", descriptionX, y + 31);
  context.textAlign = "right";
  context.fillText("QTY", quantityX, y + 31);
  context.fillText("UNIT PRICE", unitX, y + 31);
  context.fillText("AMOUNT", amountX, y + 31);
  context.textAlign = "left";
  y += 48;
  itemRows.forEach(({ item, descriptionLines, height }) => {
    context.strokeStyle = "#dbe3ea";
    context.beginPath();
    context.moveTo(pageMargin, y + height);
    context.lineTo(pageWidth - pageMargin, y + height);
    context.stroke();
    const textY = y + 34;
    drawWrappedText(context, descriptionLines, descriptionX, textY, { color: "#172b3e", font: "21px Arial, sans-serif", line: 30 });
    context.fillStyle = "#172b3e";
    context.font = "20px Arial, sans-serif";
    context.textAlign = "right";
    context.fillText(String(item.quantity), quantityX, textY);
    context.fillText(formatProductPrice(item.unitPrice), unitX, textY);
    context.fillText(formatProductPrice(Number(item.quantity) * Number(item.unitPrice)), amountX, textY);
    context.textAlign = "left";
    y += height;
  });

  y += 36;
  const totalX = pageWidth - pageMargin;
  const totalLabelX = totalX - 360;
  const totalRows = [
    ["Subtotal", formatProductPrice(totals.subtotal)],
    ...(totals.discountRate > 0
      ? [[`Discount (${totals.discountRate}%)`, `-${formatProductPrice(totals.discountAmount)}`]]
      : []),
    ...(totals.taxRate > 0 ? [[`Tax (${totals.taxRate}%)`, formatProductPrice(totals.taxAmount)]] : []),
    ...(totals.deliveryChargeEnabled
      ? [
        ["Delivery charge", formatProductPrice(totals.deliveryCharge)],
        ...(totals.freeDelivery ? [["Free delivery", `-${formatProductPrice(totals.deliveryCharge)}`]] : []),
      ]
      : []),
    ["Total", formatProductPrice(totals.total)],
  ];
  totalRows.forEach(([label, amount], index) => {
    const rowY = y + index * 42;
    if (index === totalRows.length - 1) {
      context.strokeStyle = "#163b5c";
      context.beginPath();
      context.moveTo(totalLabelX, rowY - 25);
      context.lineTo(totalX, rowY - 25);
      context.stroke();
    }
    context.fillStyle = index === totalRows.length - 1 ? "#163b5c" : "#526579";
    context.font = index === totalRows.length - 1 ? "bold 24px Arial, sans-serif" : "21px Arial, sans-serif";
    context.textAlign = "left";
    context.fillText(label, totalLabelX, rowY);
    context.textAlign = "right";
    context.fillText(amount, totalX, rowY);
  });
  context.textAlign = "left";
  y += totalRows.length * 42;
  if (notesLines.length) {
    y += 50;
    context.fillStyle = "#526579";
    context.font = "bold 18px Arial, sans-serif";
    context.fillText("NOTES", pageMargin, y);
    y = drawWrappedText(context, notesLines, pageMargin, y + 36);
  }

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = pageWidth;
  outputCanvas.height = Math.max(1754, y + pageMargin);
  const outputContext = outputCanvas.getContext("2d");
  if (!outputContext) throw new Error("This browser could not export the invoice image.");
  outputContext.fillStyle = "#ffffff";
  outputContext.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
  outputContext.drawImage(canvas, 0, 0);
  return new Promise((resolve, reject) => {
    outputCanvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The invoice image could not be exported."));
    }, "image/png");
  });
}
