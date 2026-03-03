import { writable, type Readable } from 'svelte/store';
import type { FinancialModule } from './types';

/**
 * Manages the available financial modules and the currently active one.
 */
class ModuleRegistry {
	private modules = new Map<string, FinancialModule<any, any, any>>();
	private activeModuleId = writable<string | null>(null);

	/**
	 * Registers a new financial module.
	 */
	register(module: FinancialModule<any, any, any>) {
		this.modules.set(module.id, module);
		// Set first registered module as active if none is set
		this.activeModuleId.update(current => current || module.id);
	}

	/**
	 * Returns all registered modules.
	 */
	getAllModules(): FinancialModule<any, any, any>[] {
		return Array.from(this.modules.values());
	}

	/**
	 * Returns a module by ID.
	 */
	getModule(id: string): FinancialModule<any, any, any> | undefined {
		return this.modules.get(id);
	}

	/**
	 * Switches the active module.
	 */
	setActive(id: string) {
		if (this.modules.has(id)) {
			this.activeModuleId.set(id);
		}
	}

	/**
	 * Returns a store containing the ID of the active module.
	 */
	getActiveId(): Readable<string | null> {
		return { subscribe: this.activeModuleId.subscribe };
	}
}

export const registry = new ModuleRegistry();
