import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { formatKgs } from '@barbershop/shared';
import { escapeHtml } from './telegram.service';

/**
 * Письма о заказах (бонус из требований: «почтага заказ жөнөтүү»).
 * SMTP задаётся через SMTP_HOST/PORT/USER/PASS; без них письма только логируются.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: Transporter | null;
  private readonly from = process.env.MAIL_FROM ?? 'BARS Barber Club <no-reply@bars.kg>';

  constructor() {
    const host = process.env.SMTP_HOST;
    this.transport = host
      ? nodemailer.createTransport({
          host,
          port: Number(process.env.SMTP_PORT ?? 587),
          secure: Number(process.env.SMTP_PORT) === 465,
          auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
        })
      : null;
    if (!host) this.logger.warn('SMTP не настроен — письма о заказах не отправляются');
  }

  async orderCreated(to: string, order: { number: number; total: number; items: { name: string; qty: number; price: number }[]; delivery: string }) {
    const rows = order.items
      .map(
        (i) =>
          `<tr><td style="padding:6px 0">${escapeHtml(i.name)} × ${i.qty}</td><td style="padding:6px 0;text-align:right">${formatKgs(i.price * i.qty)}</td></tr>`,
      )
      .join('');
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#141414">
        <h2 style="margin:0 0 4px">Заказ №${order.number} принят</h2>
        <p style="color:#666;margin:0 0 20px">BARS Barber Club · Бишкек</p>
        <table style="width:100%;border-collapse:collapse;border-top:1px solid #ddd">${rows}
          <tr><td style="padding:10px 0;border-top:1px solid #ddd"><b>Итого</b></td>
          <td style="padding:10px 0;border-top:1px solid #ddd;text-align:right"><b>${formatKgs(order.total)}</b></td></tr>
        </table>
        <p>${escapeHtml(order.delivery)}. Мы позвоним, когда заказ будет готов.</p>
      </div>`;
    await this.send(to, `Заказ №${order.number} — BARS Barber Club`, html);
  }

  private async send(to: string, subject: string, html: string) {
    if (!this.transport) {
      this.logger.log(`[mail:dry-run] ${to}: ${subject}`);
      return;
    }
    try {
      await this.transport.sendMail({ from: this.from, to, subject, html });
    } catch (e) {
      this.logger.error(`Письмо не отправлено: ${(e as Error).message}`);
    }
  }
}
