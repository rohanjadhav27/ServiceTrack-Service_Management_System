import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
const font = fileURLToPath(new URL('../assets/DejaVuSans.ttf', import.meta.url));
const bold = fileURLToPath(new URL('../assets/DejaVuSans-Bold.ttf', import.meta.url));
const money = (n) =>
  `INR ${(n / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export async function invoicePdf(job) {
  const inv = job.invoice;
  const doc = new PDFDocument({
    size: 'A4',
    margin: 45,
    bufferPages: true,
    info: { Title: inv.number, Author: config.workshopName },
  });
  const chunks = [];
  const complete = new Promise((resolve, reject) => {
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  doc.registerFont('regular', font).registerFont('bold', bold).font('regular');
  function header() {
    doc
      .fillColor('#15283e')
      .font('bold')
      .fontSize(19)
      .text(config.workshopName, 45, 42, { width: 390 });
    doc
      .font('regular')
      .fontSize(9)
      .fillColor('#566579')
      .text(config.workshopAddress || 'Vehicle service invoice', { width: 490 });
    doc.moveDown(0.5).text('Demonstration invoice - tax not configured');
    doc.moveDown();
  }
  header();
  doc.font('bold').fontSize(13).fillColor('#15283e').text(inv.number);
  doc.font('regular').fontSize(10).moveDown(0.5);
  doc.text(
    `Issued: ${new Date(inv.issuedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`,
  );
  doc.text(`Customer: ${inv.customerName}`);
  doc.text(`Vehicle: ${inv.registration} | Job: ${job.number}`);
  const status = inv.payment?.at
    ? inv.payment.testMode
      ? 'TEST PAID - no real money'
      : 'PAID'
    : 'UNPAID';
  doc.font('bold').text(`Status: ${status}`).moveDown();
  let y = doc.y + 8;
  function tableHeader() {
    doc.rect(45, y, 505, 25).fill('#edf2f8');
    doc.fillColor('#233249').font('bold').fontSize(9);
    doc.text('Description', 53, y + 7, { width: 245 });
    doc.text('Qty / h', 306, y + 7, { width: 45 });
    doc.text('Rate', 356, y + 7, { width: 85, align: 'right' });
    doc.text('Amount', 447, y + 7, { width: 95, align: 'right' });
    y += 32;
  }
  tableHeader();
  for (const line of inv.lines) {
    doc.font('regular').fontSize(9);
    const description = `${line.description}\n${line.kind === 'part' ? 'Part' : 'Labour'}`;
    const height = Math.max(38, doc.heightOfString(description, { width: 245 }) + 14);
    if (y + height > 740) {
      doc.addPage();
      header();
      y = doc.y + 10;
      tableHeader();
    }
    doc.fillColor('#233249').text(description, 53, y, { width: 245 });
    doc.text(String(line.quantity), 306, y, { width: 45 });
    doc.text(money(line.unitPricePaise), 356, y, { width: 85, align: 'right' });
    doc.text(money(line.amountPaise), 447, y, { width: 95, align: 'right' });
    y += height;
    doc
      .moveTo(45, y - 6)
      .lineTo(550, y - 6)
      .strokeColor('#dce4ee')
      .stroke();
  }
  if (y + 135 > 740) {
    doc.addPage();
    header();
    y = doc.y + 12;
  }
  doc
    .font('bold')
    .fontSize(13)
    .text(`Total: ${money(inv.totalPaise)}`, 45, y + 8, { width: 497, align: 'right' });
  y += 43;
  doc.font('regular').fontSize(9);
  if (inv.payment?.at) {
    doc.text(`Payment: ${inv.payment.method}`, 45, y, { width: 505 });
    doc.text(`Reference: ${inv.payment.reference || 'Cash received'}`, { width: 505 });
    doc.text(
      `Recorded: ${new Date(inv.payment.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`,
      { width: 505 },
    );
    if (inv.payment.testMode)
      doc.text('Razorpay TEST transaction. This is not evidence of actual funds received.', {
        width: 505,
      });
  } else doc.text('Payment is due. Please contact the service advisor.', 45, y, { width: 505 });
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc
      .font('regular')
      .fontSize(8)
      .fillColor('#68768a')
      .text(`ServiceTrack | ${inv.number} | Page ${i + 1} of ${pages.count}`, 45, 775, {
        width: 505,
        align: 'center',
        lineBreak: false,
      });
  }
  doc.end();
  return complete;
}
