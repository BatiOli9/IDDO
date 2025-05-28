import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    service: 'gmail', // Puedes cambiarlo por otro proveedor
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

function buildMailHTML({ childName, amount, receiverName, date }: { childName: string, amount: number, receiverName: string, date: Date }) {
    return `
    <html>
    <head>
      <meta charset="utf-8" />
      <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        body {
          font-family: 'Be Vietnam Pro', Arial, sans-serif !important;
          background: #fff;
          margin: 0;
          padding: 0;
        }
        .mail-container {
          background: #fff;
          max-width: 380px;
          margin: 32px auto;
          border-radius: 14px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.10);
          padding: 28px 20px 20px 20px;
        }
        .mail-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: #1976d2;
          margin-bottom: 12px;
          font-family: 'Be Vietnam Pro', Arial, sans-serif !important;
        }
        .mail-info {
          color: #5bb3f7;
          font-size: 1rem;
          margin-bottom: 18px;
          font-family: 'Be Vietnam Pro', Arial, sans-serif !important;
        }
        .mail-amount {
          font-size: 1.5rem;
          color: #1976d2;
          font-weight: 700;
          margin-bottom: 18px;
          letter-spacing: 1px;
          font-family: 'Be Vietnam Pro', Arial, sans-serif !important;
        }
        .mail-section {
          border-top: 2px solid #5bb3f7;
          padding-top: 14px;
          margin-top: 14px;
        }
        .mail-label {
          font-weight: 700;
          color: #1976d2;
          font-size: 1rem;
          font-family: 'Be Vietnam Pro', Arial, sans-serif !important;
        }
        .mail-section span, .mail-section div {
          font-size: 1rem;
          font-family: 'Be Vietnam Pro', Arial, sans-serif !important;
        }
        .mail-warning {
          color: #b71c1c;
          font-size: 0.95rem;
          margin-top: 12px;
          font-family: 'Be Vietnam Pro', Arial, sans-serif !important;
        }
        .mail-footer {
          text-align: center;
          color: #b3c6e0;
          font-size: 1rem;
          margin-top: 22px;
          letter-spacing: 2px;
          font-family: 'Be Vietnam Pro', Arial, sans-serif !important;
        }
      </style>
    </head>
    <body>
      <div class="mail-container">
        <div class="mail-title">Notificación de gasto de tu hijo/a</div>
        <div class="mail-info">Hola, te informamos que tu hijo/a <b>${childName}</b> realizó una transferencia:</div>
        <div class="mail-amount">$ ${amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
        <div class="mail-section">
          <div><span class="mail-label">Destinatario:</span> ${receiverName}</div>
          <div><span class="mail-label">Fecha:</span> ${date.toLocaleString('es-AR')}</div>
        </div>
        <div class="mail-warning">Si no reconocés este movimiento, por favor comunicate con soporte.</div>
        <div class="mail-footer">IDDO</div>
      </div>
    </body>
    </html>
    `;
}

export async function sendParentNotification({
    parentEmail,
    childName,
    amount,
    receiverName,
    date
}: {
    parentEmail: string,
    childName: string,
    amount: number,
    receiverName: string,
    date: Date
}) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: parentEmail,
        subject: 'Notificación de gasto de tu hijo/a',
        html: buildMailHTML({ childName, amount, receiverName, date })
    };
    await transporter.sendMail(mailOptions);
}

export async function sendLimitExceededNotification({
    parentEmail,
    childName,
    amount,
    limit,
    receiverName,
    date
}: {
    parentEmail: string,
    childName: string,
    amount: number,
    limit: number,
    receiverName: string,
    date: Date
}) {
    const html = `
    <html>
    <head>
      <meta charset="utf-8" />
      <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        body {
          font-family: 'Be Vietnam Pro', Arial, sans-serif !important;
          background: #fff;
          margin: 0;
          padding: 0;
        }
        .mail-container {
          background: #fff;
          max-width: 400px;
          margin: 32px auto;
          border-radius: 14px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.10);
          padding: 28px 20px 20px 20px;
        }
        .mail-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: #b71c1c;
          margin-bottom: 12px;
        }
        .mail-info {
          color: #b71c1c;
          font-size: 1rem;
          margin-bottom: 18px;
        }
        .mail-amount {
          font-size: 1.2rem;
          color: #b71c1c;
          font-weight: 700;
          margin-bottom: 10px;
        }
        .mail-section {
          border-top: 2px solid #b71c1c;
          padding-top: 14px;
          margin-top: 14px;
        }
        .mail-label {
          font-weight: 700;
          color: #b71c1c;
          font-size: 1rem;
        }
        .mail-section span, .mail-section div {
          font-size: 1rem;
        }
        .mail-footer {
          text-align: center;
          color: #b3c6e0;
          font-size: 1rem;
          margin-top: 22px;
          letter-spacing: 2px;
        }
      </style>
    </head>
    <body>
      <div class="mail-container">
        <div class="mail-title">Intento de transferencia bloqueado</div>
        <div class="mail-info">Le informamos que su hijo/a <b>${childName}</b> intentó realizar una transferencia que excede el <b>límite diario</b> permitido.</div>
        <div class="mail-amount">Monto intentado: $ ${amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
        <div class="mail-section">
          <div><span class="mail-label">Límite diario permitido:</span> $ ${limit.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
          <div><span class="mail-label">Destinatario:</span> ${receiverName}</div>
          <div><span class="mail-label">Fecha:</span> ${date.toLocaleString('es-AR')}</div>
        </div>
        <div class="mail-section" style="border:none; margin-top:18px; padding-top:0; color:#333;">
          <div>La operación fue bloqueada automáticamente por el sistema.</div>
        </div>
        <div class="mail-footer">IDDO</div>
      </div>
    </body>
    </html>
    `;
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: parentEmail,
        subject: 'Intento de transferencia bloqueado por límite diario',
        html
    };
    await transporter.sendMail(mailOptions);
} 