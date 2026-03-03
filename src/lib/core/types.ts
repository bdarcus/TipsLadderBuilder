import type { ComponentType } from 'svelte';
import type { Readable } from 'svelte/store';

/**
 * Common projection data structure for consistency across modules.
 */
export interface ProjectionData {
	years: number[];
	values: number[];
	metadata?: Record<string, any>;
}

/**
 * Standard interface for a financial tool/plugin.
 */
export interface FinancialModule<TState, TParams, TResult> {
	id: string;
	name: string;
	description: string;

	// State & Persistence
	store: {
		subscribe: (run: (value: TState) => void) => () => void;
		save: (state: TState) => void;
		load: () => TState;
		reset: () => void;
		publicData: Readable<any>;
	};

	// Logic & Calculation
	engine: {
		calculate: (params: TParams) => TResult;
		project: (state: TState) => ProjectionData;
	};

	// UI Components
	ui: {
		Icon: ComponentType;
		Config: ComponentType;
		Dashboard: ComponentType;
		Analysis: ComponentType;
		Import?: ComponentType;
	};
}
