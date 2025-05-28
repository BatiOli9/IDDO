import { createClient } from '@supabase/supabase-js';
import PDFDocument from 'pdfkit';
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

export const voucherService = {
    async generateAndUploadVoucher(data: VoucherData): Promise<string> {
        try {
            // Crear el PDF
            const doc = new PDFDocument({ margin: 40 });
            const chunks: Buffer[] = [];

            // Recolectar los chunks del PDF
            doc.on('data', (chunk) => chunks.push(chunk));

            // Título
            doc.fontSize(18).text('Comprobante de transferencia', { align: 'center', underline: true });
            doc.moveDown(0.5);
            doc.fontSize(10).text(`Fecha y hora: ${format(data.date, 'dd/MM/yyyy HH:mm:ss', { locale: es })}`, { align: 'center' });
            doc.moveDown(1.5);

            // Monto
            doc.fontSize(16).text(`$ ${data.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, { align: 'center', bold: true });
            doc.moveDown(1.5);

            // Datos del remitente
            doc.fontSize(12).text('De:', { underline: true });
            doc.text(`Nombre y apellido: ${data.senderName}`);
            doc.text(`DNI: ${data.senderDNI}`);
            doc.text(`CVU: ${data.senderCVU}`);
            doc.moveDown(1);

            // Datos del destinatario
            doc.fontSize(12).text('Para:', { underline: true });
            doc.text(`Nombre y apellido: ${data.receiverName}`);
            doc.text(`DNI: ${data.receiverDNI}`);
            doc.text(`CVU: ${data.receiverCVU}`);
            doc.moveDown(2);

            // Pie de página
            doc.fontSize(12).text('IDDO', { align: 'center', underline: true });

            // Finalizar el PDF
            doc.end();

            // Esperar a que se complete la generación del PDF
            const pdfBuffer = await new Promise<Buffer>((resolve) => {
                doc.on('end', () => {
                    resolve(Buffer.concat(chunks));
                });
            });

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