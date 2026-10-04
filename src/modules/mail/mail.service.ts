import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Locale } from '@prisma/client';
import { createTransport, type Transporter } from 'nodemailer';

import { mailConfig, type MailConfig } from '../../config/app.config';
import { renderVerificationEmail } from './verification-email';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;

  constructor(@Inject(mailConfig.KEY) private readonly config: MailConfig) {
    this.transporter = config.isEnabled
      ? createTransport({
          host: config.host,
          port: config.port,
          secure: config.port === 465,
          auth: config.user ? { user: config.user, pass: config.password } : undefined,
        })
      : null;
  }

  async sendVerificationCode(to: string, code: string, locale: Locale): Promise<void> {
    const email = renderVerificationEmail(locale, code);

    if (!this.transporter) {
      this.logger.warn(`SMTP is not configured, verification code for ${to}: ${code}`);
      return;
    }

    await this.transporter.sendMail({
      from: this.config.from,
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  }
}
