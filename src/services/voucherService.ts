import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

interface VoucherData {
    transactionId: number;
    amount: number;
    senderName: string;
    senderCVU: string;
    senderDNI: string;
    receiverName: string;
    receiverCVU: string;
    receiverDNI: string;
    date: Date;
}

function buildVoucherHTML(data: VoucherData): string {
    const fecha = format(data.date, "EEEE, d 'de' MMMM 'de' yyyy 'a las' HH:mm 'hs'", { locale: es });
    return `
    <html>
    <head>
      <meta charset="utf-8" />
      <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        @page {
          size: A4;
          margin: 0;
        }
        html, body {
          height: 100%;
          margin: 0;
          padding: 0;
          background: #eaf4fb;
        }
        body {
          font-family: 'Be Vietnam Pro', Arial, sans-serif;
          margin: 0;
          padding: 0;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          min-height: 100vh;
        }
        .voucher-container {
          background: #fff;
          width: 420px;
          margin: 48px 0 0 0;
          border-radius: 18px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.10);
          padding: 36px 32px 28px 32px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .voucher-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: #1976d2;
          text-align: left;
          margin-bottom: 10px;
        }
        .voucher-date {
          color: #5bb3f7;
          font-size: 1.05rem;
          margin-bottom: 18px;
        }
        .voucher-amount {
          font-size: 2.2rem;
          color: #1976d2;
          font-weight: 700;
          margin-bottom: 18px;
          letter-spacing: 1px;
          text-align: center;
        }
        .section {
          border-top: 2px solid #5bb3f7;
          padding-top: 18px;
          margin-top: 18px;
        }
        .section-title {
          font-weight: 700;
          color: #1976d2;
          margin-bottom: 8px;
          font-size: 1.1rem;
        }
        .fullname {
          font-size: 1.15rem;
          font-weight: 700;
          color: #1976d2;
          margin-bottom: 4px;
        }
        .info-row {
          margin-bottom: 4px;
          font-size: 1rem;
        }
        .info-label {
          font-weight: 600;
          color: #1976d2;
        }
        .voucher-footer {
          text-align: center;
          color: #b3c6e0;
          font-size: 1.15rem;
          margin-top: 32px;
          letter-spacing: 2px;
        }
      </style>
    </head>
    <body>
      <div class="voucher-container">
        <div class="voucher-title">Comprobante de transferencia</div>
        <div class="voucher-date">${fecha.charAt(0).toUpperCase() + fecha.slice(1)}</div>
        <div class="voucher-amount">$ ${data.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
        <div class="section">
          <div class="section-title">De</div>
          <div class="fullname">${data.senderName}</div>
          <div class="info-row"><span class="info-label">DNI:</span> ${data.senderDNI}</div>
          <div class="info-row"><span class="info-label">CVU:</span> ${data.senderCVU}</div>
        </div>
        <div class="section">
          <div class="section-title">Para</div>
          <div class="fullname">${data.receiverName}</div>
          <div class="info-row"><span class="info-label">DNI:</span> ${data.receiverDNI}</div>
          <div class="info-row"><span class="info-label">CVU:</span> ${data.receiverCVU}</div>
        </div>
        <div class="voucher-footer">IDDO</div>
      </div>
    </body>
    </html>
    `;
}

export const voucherService = {
    async generateAndUploadVoucher(data: VoucherData): Promise<string> {
        try {
            // Generar HTML
            const html = buildVoucherHTML(data);

            // Lanzar puppeteer y generar PDF
            const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
            const page = await browser.newPage();
            await page.setContent(html, { waitUntil: 'networkidle0' });
            const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
            await browser.close();

            // Generar nombre único para el archivo
            const fileName = `voucher_${data.transactionId}_${Date.now()}.pdf`;

            // Subir el PDF a Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('vouchers')
                .upload(fileName, pdfBuffer, {
                    contentType: 'application/pdf',
                    cacheControl: '3600'
                });

            if (uploadError) {
                throw new Error(`Error al subir el voucher: ${uploadError.message}`);
            }

            // Obtener la URL pública del archivo
            const { data: { publicUrl } } = supabase.storage
                .from('vouchers')
                .getPublicUrl(fileName);

            return publicUrl;
        } catch (error) {
            console.error('Error al generar y subir el voucher:', error);
            throw error;
        }
    }
}; 