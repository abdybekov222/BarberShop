import { Global, Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramBotService } from './telegram-bot.service';
import { MailService } from './mail.service';
import { FeedbackController } from './feedback.controller';
import { RemindersService } from './reminders.service';

@Global()
@Module({
  controllers: [FeedbackController],
  providers: [TelegramService, TelegramBotService, MailService, RemindersService],
  exports: [TelegramService, TelegramBotService, MailService],
})
export class NotificationsModule {}
