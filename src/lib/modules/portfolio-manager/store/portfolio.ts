import { writable, derived, type Readable } from 'svelte/store';

export interface MarketAssumptions {
	equityReturn: number; // e.g., 0.06 for 6%
	tipsReturn: number;   // e.g., 0.02 for 2%
	inflation: number;    // e.g., 0.02 for 2%
	updatedAt: string;    // YYYY-MM-DD
}

export interface PortfolioState {
	balance: number;
	equityAllocation: number; // 0.0 to 1.0 (proxy for risk)
	marketAssumptions: MarketAssumptions;
	retirementYear: number;
}

const DEFAULT_STATE: PortfolioState = {
	balance: 1000000,
	equityAllocation: 0.6, // 60/40 default
	marketAssumptions: {
		equityReturn: 0.055, // Elm Wealth-ish estimate
		tipsReturn: 0.018,
		inflation: 0.02,
		updatedAt: '2026-03-01'
	},
	retirementYear: 2045
};

function createPortfolioStore() {
	const { subscribe, set, update } = writable<PortfolioState>(DEFAULT_STATE);

	return {
		subscribe,
		set,
		update,
		save: (state: PortfolioState) => {
			if (typeof localStorage !== 'undefined') {
				try { localStorage.setItem('portfolio_manager_state', JSON.stringify(state)); } catch (e) { console.warn('localStorage unavailable (save):', e); }
			}
			set(state);
		},
		load: () => {
			if (typeof localStorage !== 'undefined') {
				try {
					const saved = localStorage.getItem('portfolio_manager_state');
					if (saved) set(JSON.parse(saved));
				} catch (e) { console.warn('localStorage unavailable (load):', e); }
			}
		},
		reset: () => {
			if (typeof localStorage !== 'undefined') {
				try { localStorage.removeItem('portfolio_manager_state'); } catch (e) { console.warn('localStorage unavailable (reset):', e); }
			}
			set(DEFAULT_STATE);
		}
	};
}

export const portfolioStore = createPortfolioStore();

/**
 * Derived store that calculates the weighted expected real return based on asset allocation.
 */
export const expectedRealReturn = derived(portfolioStore, ($state) => {
	const equ = $state.equityAllocation * $state.marketAssumptions.equityReturn;
	const bond = (1 - $state.equityAllocation) * $state.marketAssumptions.tipsReturn;
	// Simplification: (1+r_nom)/(1+infl) - 1. For small r, approx r_nom - infl.
	const nominalReturn = equ + bond;
	return (1 + nominalReturn) / (1 + $state.marketAssumptions.inflation) - 1;
});
