import { derived, type Readable } from 'svelte/store';
import { ladderStore, type LadderState } from './store/ladder';
import { runRebalance } from './engine/rebalance-engine';
import type { FinancialModule, ProjectionData } from '../../core/types';

// Placeholder components - will move real components here later
import TipsIcon from './components/TipsIcon.svelte';
import TipsConfig from './components/TipsConfig.svelte';
import TipsDashboard from './components/TipsDashboard.svelte';
import TipsAnalysis from './components/TipsAnalysis.svelte';

/**
 * Implementation of the TIPS Ladder Module.
 */
export const TipsLadderModule: FinancialModule<LadderState, any, any> = {
	id: 'tips-ladder',
	name: 'TIPS Ladder',
	description: 'Build and track inflation-protected income ladders.',

	store: {
		subscribe: ladderStore.subscribe,
		save: ladderStore.save,
		load: ladderStore.load,
		reset: ladderStore.reset,
		publicData: derived(ladderStore, ($state) => ({
			// Expose relevant data for other modules (e.g., Withdrawal module)
			realIncomeFloor: $state.target?.income || 0,
			totalLadderValue: $state.lastResults?.summary?.totalCash || 0
		}))
	},

	engine: {
		calculate: (params) => runRebalance(params),
		project: (state): ProjectionData => {
			// Extract projection from last results
			if (!state.lastResults || !state.lastResults.results) {
				return { years: [], values: [] };
			}
			
			const results = state.lastResults.results;
			const years: number[] = [];
			const values: number[] = [];

			// Year is at index 3, ARA is at index 6 in the result row
			results.forEach((row: any[]) => {
				const yearStr = row[3];
				if (yearStr && !isNaN(parseInt(yearStr))) {
					years.push(parseInt(yearStr));
					values.push(row[6] || 0);
				}
			});

			return { years, values };
		}
	},

	ui: {
		Icon: TipsIcon,
		Config: TipsConfig,
		Dashboard: TipsDashboard,
		Analysis: TipsAnalysis
	}
};
