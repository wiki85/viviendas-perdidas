import * as logger from 'firebase-functions/logger';
import { adminEmails } from '../params.js';

/**
 * Avisos por correo a las cuentas de moderación (mensajes de contacto
 * nuevos, fotos pendientes de validar). Salen por Brevo con el mismo
 * remitente que El Recuento y nunca rompen la petición que los origina:
 * si no hay clave o el envío falla, se registra y ya.
 */

const SENDER = { name: 'Viviendas Perdidas', email: 'boletin@aquiviviamos.com' };
const SITE_URL = 'https://www.aquiviviamos.com';

function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;');
}

/** Plantilla mínima con la cabecera de marca de los correos del proyecto. */
function shell(title: string, bodyHtml: string): string {
  return `
  <div style="margin:0;padding:24px;background:#f4f1e9;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;color:#1e2b27">
    <div style="max-width:560px;margin:0 auto;background:#fffdf8;border-radius:16px;padding:28px;border:1px solid rgba(30,43,39,.08)">
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:18px"><tr>
        <td><img src="${SITE_URL}/icons/icon-192.png" width="46" height="46" alt="Aquí Vivíamos" style="display:block;border-radius:12px"></td>
        <td style="padding-left:12px"><strong style="font-size:17px">${escapeHtml(title)}</strong><br>
        <span style="font-size:13px;color:#5c6b66">Aviso interno de moderación</span></td>
      </tr></table>
      ${bodyHtml}
      <p style="font-size:12px;color:#8a958f;margin-top:22px">
        Gestión en <a href="${SITE_URL}/admin" style="color:#315d4c">${SITE_URL.replace('https://', '')}/admin</a>.
      </p>
    </div>
  </div>`;
}

export interface ModerationNotice {
  subject: string;
  title: string;
  /** Pares etiqueta → texto plano; se escapan aquí. */
  fields: Array<{ label: string; value: string }>;
}

export async function notifyModerators(
  notice: ModerationNotice,
  fetchImplementation: typeof fetch = fetch,
): Promise<void> {
  try {
    const apiKey = process.env.BREVO_API_KEY ?? '';
    if (apiKey.length === 0) {
      logger.info('Aviso a moderación omitido (sin BREVO_API_KEY)', { subject: notice.subject });
      return;
    }
    const to = adminEmails
      .value()
      .split(',')
      .map((email) => email.trim())
      .filter((email) => email.length > 0)
      .map((email) => ({ email }));
    if (to.length === 0) return;
    const body = notice.fields
      .map(
        (field) =>
          `<p style="margin:6px 0;font-size:14px"><strong>${escapeHtml(field.label)}:</strong> ${escapeHtml(field.value).replace(/\n/gu, '<br>')}</p>`,
      )
      .join('');
    const response = await fetchImplementation('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        sender: SENDER,
        to,
        subject: notice.subject,
        htmlContent: shell(notice.title, body),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      logger.error('Brevo rechazó el aviso a moderación', {
        status: response.status,
        subject: notice.subject,
      });
    }
  } catch (error) {
    logger.error('Aviso a moderación fallido', {
      subject: notice.subject,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
