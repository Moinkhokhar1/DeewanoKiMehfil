const sharp = require('sharp');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

async function generateTicket({
  bookingId,
  buyerName,
  ticketCode,
  bookingRef
}) {
  const templatePath = path.join(
    __dirname,
    '..',
    'public',
    'assets',
    'ticket-template.png'
  );

  const outputDir = path.join(
    __dirname,
    '..',
    'public',
    'uploads',
    'misc'
  );

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  /*
   * Generate QR
   */
  const qrBuffer = await QRCode.toBuffer(
    JSON.stringify({
      ref: bookingRef,
      ticket: ticketCode
    }),
    {
      width: 180,
      margin: 1,
      errorCorrectionLevel: 'H'
    }
  );

  /*
   * Text layer
   *
   * Ticket image = 2000 x 647
   *
   * These coordinates can be adjusted
   * after seeing the generated result.
   */
  const textSvg = `
    <svg width="2000" height="647">

      <style>
        .buyer-name {
          fill: #ffffff;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 28px;
          font-weight: 600;
        }

        .ticket-code {
          fill: #d9ad36;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 22px;
          font-weight: 600;
        }
      </style>

      <!-- Booker Name -->
      <text
        x="35"
        y="535"
        class="buyer-name"
      >
        ${escapeXml(buyerName)}
      </text>

      <!-- Ticket Code -->
      <text
        x="35"
        y="575"
        class="ticket-code"
      >
        ${escapeXml(ticketCode)}
      </text>

    </svg>
  `;

  const filename = `ticket-${bookingId}-${Date.now()}.png`;

  const outputPath = path.join(
    outputDir,
    filename
  );

  /*
   * Combine:
   *
   * 1. Original ticket
   * 2. QR
   * 3. Booker name
   * 4. Ticket code
   */
  await sharp(templatePath)
    .composite([
      {
        input: qrBuffer,
        left: 40,
        top: 285
      },
      {
        input: Buffer.from(textSvg),
        left: 0,
        top: 0
      }
    ])
    .png()
    .toFile(outputPath);

  return {
    filePath: outputPath,
    publicPath: `/uploads/misc/${filename}`
  };
}


function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}


module.exports = {
  generateTicket
};