import { Controller, Get } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import { AiBudgetService } from '../ai/ai-budget.service';
import { Public } from '../auth/public.decorator';
import { activeAiProvider } from '../ai/ai.constants';

/**
 * GET /api/config — публичный endpoint (кэш ≤ 60 с на клиенте).
 * Возвращает настройки салона + статус ИИ-зеркала.
 */
@Public()
@Controller('config')
export class ConfigController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly budget: AiBudgetService,
  ) {}

  @Get()
  async getConfig() {
    const [base, aiStatus] = await Promise.all([
      this.catalog.getConfig(),
      this.budget.getStatus(),
    ]);
    return {
      ...base,
      ai_enabled: !(aiStatus?.kill_switch ?? true),
      ai_remaining_usd: aiStatus?.remaining_usd ?? 0,
      ai_demo: activeAiProvider() === 'mock',
    };
  }
}
