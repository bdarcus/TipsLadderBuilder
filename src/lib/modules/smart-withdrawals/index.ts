import { derived, get } from 'svelte/store';
import { withdrawalStore, type WithdrawalState } from './store/withdrawal';
import { calculateTargetHorizon, getTargetProbFromMargin } from './engine/life-expectancy';
import { calculateConstantAmortization } from '../portfolio-manager/engine/amortization';
import { registry } from '../../core/registry';
import type { FinancialModule, ProjectionData } from '../../core/types';

// Placeholder components
import WithdrawalIcon from './components/WithdrawalIcon.svelte';
import WithdrawalConfig from './components/WithdrawalConfig.svelte';
import WithdrawalDashboard from './components/WithdrawalDashboard.svelte';
import WithdrawalAnalysis from './components/WithdrawalAnalysis.svelte';

/**
 * Implementation of the Smart Withdrawal Module (Merton-Inspired).
 * This module coordinates data from the TIPS and Portfolio modules.
 */
export const SmartWithdrawalModule: FinancialModule<WithdrawalState, any, any> = {
	id: 'smart-withdrawals',
	name: 'Smart Withdrawal',
	description: 'Merton-inspired dynamic spending using joint life expectancy.',

	store: {
		subscribe: withdrawalStore.subscribe,
		save: withdrawalStore.save,
		load: withdrawalStore.load,
		reset: withdrawalStore.reset,
		publicData: derived([withdrawalStore], ([$state]) => {
			const targetProb = getTargetProbFromMargin($state.conservatismMargin);
			const years = calculateTargetHorizon($state.people, targetProb);
			return {
				planningHorizonYears: years,
				targetSurvivalProb: targetProb
			};
		})
	},

	engine: {
		calculate: (params) => {
			const state = get(withdrawalStore);
			const targetProb = getTargetProbFromMargin(state.conservatismMargin);
			const yearsRemaining = calculateTargetHorizon(state.people, targetProb);

			// Get data from other modules via the registry
			const tipsModule = registry.getModule('tips-ladder');
			const portfolioModule = registry.getModule('portfolio-manager');

			const tipsData = tipsModule ? get(tipsModule.store.publicData) : { realIncomeFloor: 0 };
			const portfolioData = portfolioModule ? get(portfolioModule.store.publicData) : { totalBalance: 0, expectedRealReturn: 0.02 };

			// Dynamic Spending Formula
			const floor = tipsData.realIncomeFloor || 0;
			const upside = calculateConstantAmortization(
				portfolioData.totalBalance || 0,
				portfolioData.expectedRealReturn || 0.02,
				yearsRemaining
			);

			return {
				totalSpending: floor + upside,
				floor,
				upside,
				yearsRemaining,
				targetProb
			};
		},
		project: (state): ProjectionData => {
			// Spending projection
			const calc = SmartWithdrawalModule.engine.calculate({});
			const years: number[] = [];
			const values: number[] = [];
			const startYear = new Date().getFullYear();
			
			for (let i = 0; i < calc.yearsRemaining; i++) {
				years.push(startYear + i);
				values.push(calc.totalSpending);
			}

			return { years, values };
		}
	},

	ui: {
		Icon: WithdrawalIcon,
		Config: WithdrawalConfig,
		Dashboard: WithdrawalDashboard,
		Analysis: WithdrawalAnalysis
	}
};
