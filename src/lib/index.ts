import { registry } from './core/registry';
import { TipsLadderModule } from './modules/tips-ladder';
import { TotalPortfolioModule } from './modules/portfolio-manager';
import { SmartWithdrawalModule } from './modules/smart-withdrawals';

// Register all available modules
registry.register(TipsLadderModule);
registry.register(TotalPortfolioModule);
registry.register(SmartWithdrawalModule);

export { registry };
export * from './core/types';
export * from './core/registry';
