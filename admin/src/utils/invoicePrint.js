import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

function restaurantLogoSrc(restaurant) {
  return restaurant?.logoUrl || restaurant?.logo_url || "";
}

function buildReceiptCardHtml({ invoice, restaurant }) {
  const restroName = restaurant?.name || "Restaurant";
  const logoSrc = restaurantLogoSrc(restaurant);
  const address = [restaurant?.address, restaurant?.city, restaurant?.state, restaurant?.pincode]
    .filter(Boolean)
    .join(", ");
  const date = invoice?.createdAt
    ? new Date(invoice.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "";
  const time = invoice?.createdAt
    ? new Date(invoice.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })
    : "";

  const rows = (invoice?.items || [])
    .map((line) => {
      const price = Number(line.unitPrice ?? line.price ?? 0);
      const total = Number(line.lineTotal ?? line.subtotal ?? 0);
      return `<div class="i-row"><span>${line.name || "Item"}</span><span>₹${price.toFixed(0)}</span><span>${line.qty || 1}</span><span>₹${total.toFixed(0)}</span></div>`;
    })
    .join("");

  return `
    <div style="font-family:Poppins,Arial,sans-serif;color:#0f172a;border:1px dashed #94a3b8;border-radius:8px;padding:14px;background:#fff;">
      ${logoSrc ? `<img src="${logoSrc}" alt="" crossorigin="anonymous" style="width:70px;height:70px;object-fit:cover;display:block;margin:0 auto 6px;" />` : ""}
      <div style="text-align:center;font-size:20px;font-weight:800;">${restroName}</div>
      ${address ? `<div style="text-align:center;font-size:12px;color:#334155;margin-top:3px;">${address}</div>` : ""}
      ${restaurant?.gst_number ? `<div style="text-align:center;font-size:12px;font-weight:700;margin-top:3px;">GSTIN: ${restaurant.gst_number}</div>` : ""}
      <div style="border-top:1px dashed #64748b;margin:10px 0;"></div>
      <div style="text-align:center;letter-spacing:1px;font-weight:700;font-size:18px;margin-bottom:8px;">RECEIPT</div>
      <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;margin-bottom:6px;"><span>Name</span><span>${invoice.customerName || "-"}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;margin-bottom:6px;"><span>Table</span><span>${invoice.tableLabel || "-"}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;margin-bottom:6px;"><span>Invoice No</span><span>${invoice.invoiceNo || ""}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;margin-bottom:6px;"><span>Date</span><span>${date}</span></div>
      <div style="border-top:1px dashed #64748b;margin:10px 0;"></div>
      <div class="i-head"><span>Item</span><span>Price</span><span>Qty</span><span>Total</span></div>
      ${rows}
      <div style="border-top:1px dashed #64748b;margin:10px 0;"></div>
      <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:700;margin-bottom:6px;"><span>Sub-Total:</span><span>₹${Number(invoice?.subTotal || 0).toFixed(0)}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:700;margin-bottom:6px;"><span>GST (18%):</span><span>₹${Number(invoice?.gstAmount || 0).toFixed(0)}</span></div>
      <div style="border-top:1px dashed #64748b;margin:10px 0;"></div>
      <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:800;margin-bottom:6px;"><span>Total:</span><span>₹${Number(invoice?.total || 0).toFixed(0)}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;"><span style="font-weight:700;">Mode:</span><span>${invoice?.paymentMode || "Online"}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;"><span style="font-weight:700;">Status:</span><span>${invoice?.paymentStatus || "Unpaid"}</span></div>
      <div style="border-top:1px dashed #64748b;margin:10px 0;"></div>
      <div style="text-align:center;color:#64748b;font-size:16px;margin-top:8px;">**SAVE PAPER SAVE NATURE !!</div>
      <div style="text-align:center;margin-top:6px;font-size:16px;">Time: ${time}</div>
      <style>
        .i-head,.i-row{display:grid;grid-template-columns:1.4fr .8fr .5fr .9fr;gap:8px;font-size:13px;margin-bottom:4px}
        .i-head{font-weight:700}
        .i-head span:nth-child(2),.i-head span:nth-child(3),.i-head span:nth-child(4),
        .i-row span:nth-child(2),.i-row span:nth-child(3),.i-row span:nth-child(4){text-align:right}
      </style>
    </div>
  `;
}

export function buildInvoicePrintHtml({ invoice, restaurant }) {
  return `<!doctype html>
<html>
<head>
  <title>Invoice #${invoice?.invoiceNo || ""}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    body{font-family:Arial,sans-serif;padding:0;color:#111;background:#fff;}
    .wrap{width:76mm;max-width:76mm;margin:0 auto;padding:2mm 0;}
  </style>
</head>
<body>
  <div class="wrap">${buildReceiptCardHtml({ invoice, restaurant })}</div>
</body>
</html>`;
}

export function printInvoiceDocument({ invoice, restaurant }) {
  if (!invoice) return;
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) return;
  printWindow.document.open();
  printWindow.document.write(buildInvoicePrintHtml({ invoice, restaurant }));
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function waitForImages(container) {
  const images = Array.from(container.querySelectorAll("img"));
  if (!images.length) return Promise.resolve();

  return Promise.all(
    images.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) {
            if (img.naturalWidth === 0) img.remove();
            resolve();
            return;
          }
          const done = () => {
            if (img.naturalWidth === 0) img.remove();
            resolve();
          };
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
          window.setTimeout(done, 8000);
        })
    )
  );
}

function savePdfFile(doc, filename) {
  try {
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.rel = "noopener";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (_err) {
    doc.save(filename);
  }
}

export async function downloadInvoicePdfDocument({ invoice, restaurant }) {
  if (!invoice) throw new Error("Invoice is required.");

  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.left = "-99999px";
  wrapper.style.top = "0";
  wrapper.style.width = "302px";
  wrapper.style.background = "#ffffff";
  wrapper.style.padding = "0";
  wrapper.style.zIndex = "-1";
  wrapper.innerHTML = buildReceiptCardHtml({ invoice, restaurant });
  document.body.appendChild(wrapper);

  try {
    await waitForImages(wrapper);

    const canvas = await html2canvas(wrapper, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      allowTaint: false,
      logging: false,
      width: wrapper.scrollWidth,
      height: wrapper.scrollHeight,
      windowWidth: wrapper.scrollWidth,
      windowHeight: wrapper.scrollHeight
    });

    let imgData;
    let captureCanvas = canvas;
    try {
      imgData = canvas.toDataURL("image/png");
    } catch (_taintErr) {
      const fallback = document.createElement("div");
      fallback.style.position = "fixed";
      fallback.style.left = "-99999px";
      fallback.style.top = "0";
      fallback.style.width = "302px";
      fallback.style.background = "#ffffff";
      fallback.innerHTML = buildReceiptCardHtml({
        invoice,
        restaurant: { ...restaurant, logoUrl: "", logo_url: "" }
      });
      document.body.appendChild(fallback);
      try {
        const safeCanvas = await html2canvas(fallback, {
          scale: 2,
          backgroundColor: "#ffffff",
          logging: false,
          width: fallback.scrollWidth,
          height: fallback.scrollHeight
        });
        captureCanvas = safeCanvas;
        imgData = safeCanvas.toDataURL("image/png");
      } finally {
        document.body.removeChild(fallback);
      }
    }

    const pdfWidth = 226.77;
    const pdfHeight = (captureCanvas.height * pdfWidth) / captureCanvas.width;
    const doc = new jsPDF({ unit: "pt", format: [pdfWidth, pdfHeight] });
    doc.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    const filename = `invoice-${invoice?.invoiceNo || invoice?.id || "download"}.pdf`;
    savePdfFile(doc, filename);
  } finally {
    if (wrapper.parentNode) document.body.removeChild(wrapper);
  }
}
