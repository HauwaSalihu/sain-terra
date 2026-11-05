import QRCode from "qrcode";
import { api, money } from "./api";
import { amountInWords, receiptPosition } from "./ledger";
import type { Buyer, ESignature, Offer, Payment, Property, Unit } from "./types";

export const COMPANY = {
  name: "Sain Terra",
  address: process.env.NEXT_PUBLIC_COMPANY_ADDRESS || "Abuja, Federal Capital Territory, Nigeria",
  phone: process.env.NEXT_PUBLIC_COMPANY_PHONE || "",
  email: process.env.NEXT_PUBLIC_COMPANY_EMAIL || "",
};

export type ReceiptFormat = "official" | "compact";

const esc = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

const date = (value?: string | Date) =>
  value ? new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—";

const logo = () => `${window.location.origin}/sainlogo.png`;

/** Public page a scanned QR code opens. */
export const verifyUrl = (token: string) =>
  `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/verify/${token}`;

const qrCode = (token?: string) =>
  token ? QRCode.toDataURL(verifyUrl(token), { margin: 1, width: 240, errorCorrectionLevel: "M" }) : Promise.resolve("");

const signatureCache = new Map<string, Promise<string>>();
/**
 * E-signature images are fetched from the API only at print time. Never
 * rejects: if no image can be found the slot still prints the signer's name,
 * title and signing time, so a document is never blocked by a missing image.
 */
function signatureImage(sig: ESignature) {
  const key = `${sig.signature}:${sig.user}`;
  if (!signatureCache.has(key)) {
    const request = api<{ image: string }>(`/signatures/${sig.signature}?user=${encodeURIComponent(sig.user)}`)
      .then((r) => r.image)
      .catch(() => {
        signatureCache.delete(key);
        return "";
      });
    signatureCache.set(key, request);
  }
  return signatureCache.get(key)!;
}

const signedOn = (when: string) =>
  new Date(when).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** One signature slot: e-signature image (when applied), line, role, name and title. */
function signatureSlot(caption: string, sig: ESignature | undefined, image: string) {
  const who = sig ? `${esc(sig.name)}${sig.title ? ` - ${esc(sig.title)}` : ""}` : "";
  return `<div class="sig">
    <div class="sigimg">${image ? `<img src="${image}" alt="">` : ""}</div>
    <div class="sigline"></div>
    <div class="cap">${esc(caption)}</div>
    ${sig ? `<b>${who}</b><div class="when">E-signed ${esc(signedOn(sig.signedAt))}</div>` : `<div class="when">Awaiting signature</div>`}
  </div>`;
}

const SIGNATURE_STYLES = `
  .sigs{display:flex;justify-content:space-between;gap:24px}.sig{flex:1;text-align:center}
  .sigimg{height:var(--sig-h);display:flex;align-items:flex-end;justify-content:center}
  .sigimg img{max-height:var(--sig-h);max-width:95%;margin-bottom:-4px;object-fit:contain}
  .sigline{border-bottom:1px solid #1d1d1f;margin-bottom:5px}
  .cap{color:#6b6b70;font-size:.9em}.when{color:#6b6b70;font-size:.85em}
  .verify{display:flex;align-items:center;gap:12px}.verify img{width:var(--qr);height:var(--qr)}
  .verify .code{font-family:monospace;font-size:10px;word-break:break-all}`;

function verifyBlock(qr: string, token: string | undefined, what: string) {
  if (!qr || !token) return "";
  return `<div class="verify"><img src="${qr}" alt="Verification code"><div><b>Scan to verify this ${what}</b><br>
    <span class="muted">Opens the ${esc(COMPANY.name)} record. If it does not match, the ${what} is not genuine.</span><br>
    <span class="code muted">${esc(verifyUrl(token))}</span></div></div>`;
}

const contactLine = () =>
  [COMPANY.address, COMPANY.phone, COMPANY.email].filter(Boolean).map(esc).join(" · ");

/**
 * Opens the print window straight away (so pop-up blockers allow it), then
 * fills it once signatures and the QR code are ready.
 */
async function openPrint(title: string, build: () => Promise<{ body: string; styles: string }>) {
  const w = window.open("", "_blank");
  if (!w) {
    alert("Allow pop-ups for this site to print documents.");
    return;
  }
  w.document.write(`<p style="font:14px Arial;padding:40px">Preparing ${esc(title)}…</p>`);
  try {
    const { body, styles } = await build();
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
  *{box-sizing:border-box}body{font:14px/1.5 Arial,Helvetica,sans-serif;color:#1d1d1f;margin:0;background:#fff}
  .logo{height:56px;width:auto}.muted{color:#6b6b70}.right{text-align:right}
  ${styles}</style></head><body>${body}
  <script>window.onload=()=>{const i=document.images;let n=i.length;if(!n)return window.print();for(const im of i){if(im.complete){if(--n===0)window.print()}else{im.onload=im.onerror=()=>{if(--n===0)window.print()}}}}</script>
  </body></html>`;
    w.document.open();
    w.document.write(html);
    w.document.close();
  } catch (err) {
    w.document.body.innerHTML = `<p style="font:14px Arial;padding:40px;color:#b91c1c">Could not prepare the document: ${esc((err as Error).message)}</p>`;
  }
}

export type OfferLetterData = {
  offer: Offer;
  buyer?: Buyer;
  property?: Property;
  unit?: Unit;
};

export function printOfferLetter({ offer, buyer, property, unit }: OfferLetterData) {
  const ref = offer.offerNumber || `ST/OL/${offer._id.slice(-6).toUpperCase()}`;
  const deposit = offer.initialDeposit || 0;
  const months = offer.installmentMonths || 0;
  const monthly = offer.paymentPlan === "INSTALLMENTS" && months ? Math.ceil((offer.agreedPrice - deposit) / months) : 0;
  const planText =
    offer.paymentPlan === "FULL"
      ? `Outright payment of ${money(offer.agreedPrice)} (${esc(amountInWords(offer.agreedPrice))}).`
      : `An initial deposit of ${money(deposit)}${months ? `, with the balance of ${money(offer.agreedPrice - deposit)} spread over ${months} month${months > 1 ? "s" : ""} (approximately ${money(monthly)} per month)` : ", with the balance payable in instalments as agreed with the company"}.`;

  const approved = !!offer.approval;
  return openPrint(`Offer letter ${ref}`, async () => {
  const [qr, image] = await Promise.all([qrCode(offer.verifyToken), offer.approval ? signatureImage(offer.approval) : ""]);
  const body = `<div class="page">${approved ? "" : `<div class="stamp">DRAFT</div>`}
  <header><img class="logo" src="${logo()}" alt="${esc(COMPANY.name)}"><div class="right muted small">${contactLine()}</div></header>
  <div class="meta"><div><b>Ref:</b> ${esc(ref)}</div><div><b>Date:</b> ${date(offer.createdAt || new Date())}</div></div>
  <div class="to">${esc(buyer?.fullName || "Subscriber")}<br>${esc(buyer?.address || "")}${buyer?.phone ? `<br>${esc(buyer.phone)}` : ""}${buyer?.email ? `<br>${esc(buyer.email)}` : ""}</div>
  <p>Dear ${esc(buyer?.fullName || "Sir/Madam")},</p>
  <h2>LETTER OF OFFER: ${esc(unit?.type || "PROPERTY").toUpperCase()} AT ${esc(property?.name || "").toUpperCase()}, ${esc(property?.location || "").toUpperCase()}</h2>
  <p>Further to your application, we are pleased to offer you the property described below on the following terms and conditions:</p>
  <table>
    <tr><td>Estate / property</td><td>${esc(property?.name || "—")}</td></tr>
    <tr><td>Location</td><td>${esc(property?.location || "—")}, Abuja</td></tr>
    <tr><td>Unit</td><td>${esc(unit?.unitNumber || "—")} · ${esc(unit?.type || "")}${unit?.bedrooms ? ` · ${unit.bedrooms} bedroom(s)` : ""}</td></tr>
    <tr><td>Offer price</td><td><b>${money(offer.agreedPrice)}</b><br><span class="muted small">${esc(amountInWords(offer.agreedPrice))}</span></td></tr>
    <tr><td>Payment plan</td><td>${planText}</td></tr>
    ${offer.validUntil ? `<tr><td>Offer valid until</td><td>${date(offer.validUntil)}</td></tr>` : ""}
  </table>
  <h3>Terms and conditions</h3>
  <ol>
    <li>All payments shall be made only into the company's designated bank account(s). Each payment will be acknowledged with an official ${esc(COMPANY.name)} receipt.</li>
    <li>${offer.validUntil ? `This offer lapses if the initial payment is not received by ${date(offer.validUntil)}.` : "This offer lapses if the initial payment is not received within fourteen (14) days of the date of this letter."}</li>
    <li>Allocation of the unit becomes final upon full payment of the offer price and execution of the Contract of Sale.</li>
    <li>Default on any agreed instalment for more than thirty (30) days may lead to revocation of this offer, subject to the company's refund policy.</li>
    <li>Statutory charges, documentation and legal fees are not included in the offer price unless stated otherwise.</li>
    ${offer.specialTerms ? `<li>${esc(offer.specialTerms).replace(/\n/g, "<br>")}</li>` : ""}
  </ol>
  <p>Kindly sign the acceptance below and return a copy to us to confirm your acceptance of this offer.</p>
  <p>Yours faithfully,<br>For: <b>${esc(COMPANY.name)}</b></p>
  <div class="signs"><div class="sigs">${signatureSlot("For and on behalf of " + COMPANY.name, offer.approval, image)}<div class="sig"></div></div></div>
  ${approved ? "" : `<p class="draftnote">DRAFT: not valid until approved and e-signed by the CEO or COO.</p>`}
  <div class="accept">
    <h3>Acceptance</h3>
    <p>I, ${esc(buyer?.fullName || "_______________________")}, accept the above offer on the terms and conditions stated.</p>
    <div class="sigs"><div class="sig"><div class="sigline" style="height:36px"></div>Signature</div><div class="sig"><div class="sigline" style="height:36px"></div>Date</div></div>
  </div>
  <footer class="muted small">${verifyBlock(qr, offer.verifyToken, "offer letter")}<div>Offer ID ${esc(offer._id)} · Generated from the ${esc(COMPANY.name)} portal</div></footer>
  </div>`;

  return { body, styles: `
  ${SIGNATURE_STYLES}
  .page{position:relative;max-width:800px;margin:auto;padding:40px 48px}
  .signs{--sig-h:70px;margin-top:20px;font-size:12px}.draftnote{color:#b91c1c;font-weight:bold;font-size:12px}
  .stamp{position:fixed;top:40%;left:50%;transform:translate(-50%,-50%) rotate(-24deg);font-size:110px;font-weight:bold;color:rgba(200,30,30,.12);border:8px solid rgba(200,30,30,.12);padding:4px 30px;pointer-events:none}
  .verify{--qr:84px;text-align:left;margin-bottom:10px}
  header{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;border-bottom:4px solid #3c3c3f;padding-bottom:14px}
  .small{font-size:11px}.meta{display:flex;justify-content:space-between;margin:22px 0}.to{margin-bottom:18px}
  h2{font-size:15px;text-decoration:underline;margin:18px 0}h3{font-size:14px;margin-top:22px}
  table{width:100%;border-collapse:collapse;margin:14px 0}td{padding:9px 10px;border:1px solid #d8d8dc;vertical-align:top}td:first-child{width:32%;background:#f4f4f5;color:#4a4a4f}
  ol{padding-left:20px}li{margin-bottom:6px}
  .accept{margin-top:34px;border-top:1px dashed #9a9aa0;padding-top:8px}.accept .sigs{gap:60px;margin-top:30px}footer{margin-top:30px;text-align:center}
  @media print{.page{padding:0}@page{margin:18mm}}` };
  });
}

export type ReceiptData = {
  payment: Payment;
  offer?: Offer;
  buyer?: Buyer;
  property?: Property;
  unit?: Unit;
  payments: Payment[];
};

export function printReceipt(format: ReceiptFormat, { payment, offer, buyer, property, unit, payments }: ReceiptData) {
  const pos = receiptPosition(payment, offer, payments);
  const provisional = payment.status !== "CONFIRMED";
  const receiptNo = payment.receiptNumber || `PROV-${payment._id.slice(-6).toUpperCase()}`;
  const method = payment.method.replaceAll("_", " ");
  const forWhat = `${unit?.type || "Property"}${unit?.unitNumber ? ` (${unit.unitNumber})` : ""}${property ? ` at ${property.name}, ${property.location}` : ""}`;
  // When the property is fully paid the receipt states the full price as paid.
  const headline = pos.fullyPaid
    ? `<div class="paidfull">PAID IN FULL · ${money(pos.total)}</div>`
    : pos.known
      ? `<div class="part">Part payment · Balance ${money(pos.balance)}</div>`
      : "";
  const summary = pos.known
    ? `<tr><td>Total price</td><td class="right">${money(pos.total)}</td></tr>
       <tr><td>This payment</td><td class="right">${money(payment.amount)}</td></tr>
       <tr><td>Total paid to date</td><td class="right"><b>${money(pos.paidToDate)}</b></td></tr>
       <tr class="bal"><td>${pos.fullyPaid ? "Status" : "Outstanding balance"}</td><td class="right"><b>${pos.fullyPaid ? "Fully paid" : money(pos.balance)}</b></td></tr>`
    : `<tr><td>Amount</td><td class="right"><b>${money(payment.amount)}</b></td></tr>`;
  const stamp = provisional ? `<div class="stamp">${payment.status === "REVERSED" ? "REVERSED" : "PROVISIONAL"}</div>` : "";
  const auths = payment.authorizations || [];

  return openPrint(`Receipt ${receiptNo}`, async () => {
    // Signature images only go on a receipt once every required signature is in.
    const [qr, ...images] = await Promise.all([
      qrCode(payment.verifyToken),
      ...[0, 1].map((i) => (!provisional && auths[i] ? signatureImage(auths[i]) : Promise.resolve(""))),
    ]);
    const signatures = `<div class="sigs">${signatureSlot("Received by", auths[0], images[0])}${signatureSlot("Authorised by", auths[1], images[1])}</div>`;

    if (format === "compact") {
      const body = `<div class="slip">${stamp}
      <div class="center"><img class="logo" src="${logo()}" alt="${esc(COMPANY.name)}"><div class="muted tiny">${contactLine()}</div></div>
      <div class="title">PAYMENT RECEIPT</div>
      <div class="row"><span>Receipt no.</span><b>${esc(receiptNo)}</b></div>
      <div class="row"><span>Date</span><b>${date(payment.paidAt)}</b></div>
      <div class="row"><span>Received from</span><b>${esc(buyer?.fullName || "—")}</b></div>
      <div class="row"><span>For</span><b class="right">${esc(forWhat)}</b></div>
      <div class="row"><span>Method</span><b>${esc(method)}</b></div>
      ${payment.reference ? `<div class="row"><span>Reference</span><b>${esc(payment.reference)}</b></div>` : ""}
      <div class="amount">${money(payment.amount)}</div>
      <div class="center muted tiny">${esc(amountInWords(payment.amount))}</div>
      ${headline}
      <table>${summary}</table>
      <div class="signs">${signatures}</div>
      ${qr ? `<div class="qr"><img src="${qr}" alt="Verification code"><div class="tiny muted">Scan to verify this receipt</div></div>` : ""}
      <div class="center muted tiny">Thank you for your payment.${provisional ? " Provisional until signed by the CEO and COO." : ""}</div>
    </div>`;
      return { body, styles: `
      ${SIGNATURE_STYLES}
      .slip{position:relative;width:340px;margin:20px auto;padding:18px;border:1px dashed #9a9aa0}
      .center{text-align:center}.logo{height:42px;margin-bottom:6px}.tiny{font-size:10px}
      .title{text-align:center;font-weight:bold;letter-spacing:3px;margin:12px 0;border-top:2px solid #3c3c3f;border-bottom:2px solid #3c3c3f;padding:6px 0}
      .row{display:flex;justify-content:space-between;gap:12px;font-size:12px;padding:4px 0;border-bottom:1px dotted #d0d0d4}.row span{color:#6b6b70;white-space:nowrap}
      .amount{font-size:26px;font-weight:bold;text-align:center;margin-top:14px}
      .paidfull,.part{text-align:center;font-weight:bold;font-size:12px;margin:10px 0;padding:6px;border-radius:4px}.paidfull{background:#1d1d1f;color:#fff}.part{background:#ececee}
      table{width:100%;font-size:12px;border-collapse:collapse}td{padding:4px 0}.bal td{border-top:1px solid #1d1d1f;padding-top:6px}
      .signs{--sig-h:64px;margin:20px 0 10px;font-size:10px}.signs .sigs{gap:14px}
      .qr{text-align:center;margin:8px 0}.qr img{width:96px;height:96px}
      .stamp{position:absolute;top:45%;left:50%;transform:translate(-50%,-50%) rotate(-24deg);font-size:34px;font-weight:bold;color:rgba(200,30,30,.18);border:4px solid rgba(200,30,30,.18);padding:4px 12px;pointer-events:none}
      @media print{.slip{margin:0 auto}@page{size:80mm auto;margin:4mm}}` };
    }

    const body = `<div class="page">${stamp}
    <header><img class="logo" src="${logo()}" alt="${esc(COMPANY.name)}"><div class="right"><div class="title">OFFICIAL RECEIPT</div><div class="muted small">${contactLine()}</div></div></header>
    <div class="meta"><div><span class="muted">Receipt no.</span><br><b>${esc(receiptNo)}</b></div><div class="right"><span class="muted">Date</span><br><b>${date(payment.paidAt)}</b></div></div>
    <div class="line-item"><span class="muted">Received from</span><span class="fill">${esc(buyer?.fullName || "—")}</span></div>
    <div class="line-item"><span class="muted">The sum of</span><span class="fill">${esc(amountInWords(payment.amount))}</span></div>
    <div class="line-item"><span class="muted">Being payment for</span><span class="fill">${esc(forWhat)}</span></div>
    <div class="line-item"><span class="muted">Payment method</span><span class="fill">${esc(method)}${payment.reference ? ` · Ref: ${esc(payment.reference)}` : ""}</span></div>
    <div class="grid">
      <div class="box"><div class="muted small">Amount received</div><div class="amount">${money(payment.amount)}</div>${headline}</div>
      <table>${summary}</table>
    </div>
    <div class="signs">${signatures}</div>
    <footer class="muted small">${verifyBlock(qr, payment.verifyToken, "receipt")}<div>${provisional ? "This receipt is provisional until it is e-signed by the CEO and COO. " : ""}Please keep this receipt safely; it is required for allocation and documentation. Payment ID ${esc(payment._id)}</div></footer>
  </div>`;
    return { body, styles: `
    ${SIGNATURE_STYLES}
    .page{position:relative;max-width:780px;margin:auto;padding:40px 48px}
    header{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;border-bottom:4px solid #3c3c3f;padding-bottom:14px}
    .title{font-size:20px;font-weight:bold;letter-spacing:4px}.small{font-size:11px}
    .meta{display:flex;justify-content:space-between;margin:24px 0}
    .line-item{display:flex;gap:14px;align-items:baseline;margin:14px 0}.line-item .muted{white-space:nowrap;width:150px}.fill{flex:1;border-bottom:1px dotted #8a8a90;padding-bottom:3px;font-weight:bold}
    .grid{display:grid;grid-template-columns:1fr 1.2fr;gap:24px;margin-top:28px;align-items:start}
    .box{border:2px solid #1d1d1f;border-radius:8px;padding:16px}.amount{font-size:28px;font-weight:bold;margin-top:4px}
    .paidfull,.part{margin-top:10px;font-weight:bold;font-size:12px;padding:6px 8px;border-radius:4px;display:inline-block}.paidfull{background:#1d1d1f;color:#fff}.part{background:#ececee}
    table{width:100%;border-collapse:collapse}td{padding:8px 10px;border-bottom:1px solid #e1e1e4}.bal td{border-top:2px solid #1d1d1f;border-bottom:none}
    .signs{--sig-h:80px;margin-top:36px;font-size:12px}.signs .sigs{gap:80px}
    footer{margin-top:30px;border-top:1px solid #e1e1e4;padding-top:12px}.verify{--qr:92px;margin-bottom:10px}
    .stamp{position:absolute;top:42%;left:50%;transform:translate(-50%,-50%) rotate(-20deg);font-size:72px;font-weight:bold;color:rgba(200,30,30,.13);border:6px solid rgba(200,30,30,.13);padding:6px 24px;pointer-events:none}
    @media print{.page{padding:0}@page{size:A4;margin:16mm}}` };
  });
}
