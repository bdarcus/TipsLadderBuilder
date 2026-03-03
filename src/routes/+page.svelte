<script lang="ts">
	import { registry } from '$lib';
	import { goto } from '$app/navigation';
	
	const modules = registry.getAllModules();

	function manageModule(id: string) {
		registry.setActive(id);
		goto('/design');
	}
</script>

<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
	{#each modules as m}
		<div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
			<div class="flex items-center space-x-3 mb-4">
				<div class="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
					<svelte:component this={m.ui.Icon} />
				</div>
				<h2 class="text-xl font-bold text-slate-900">{m.name}</h2>
			</div>
			
			<div class="mb-6">
				<svelte:component this={m.ui.Dashboard} />
			</div>

			<button 
				onclick={() => manageModule(m.id)}
				class="w-full py-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-emerald-50 hover:text-emerald-600 transition-colors font-medium text-sm"
			>
				Manage {m.name}
			</button>
		</div>
	{/each}
</div>

<div class="mt-12 bg-white p-8 rounded-xl border border-slate-200">
	<h2 class="text-2xl font-serif font-bold text-slate-900 mb-4">Merton-Inspired Planning</h2>
	<p class="text-slate-600 max-w-3xl leading-relaxed">
		This platform integrates specialized modules to create a holistic retirement plan. 
		The <strong>TIPS Ladder</strong> provides a guaranteed floor of real income. 
		The <strong>Total Portfolio</strong> manages your risky assets with constant amortization. 
		The <strong>Smart Withdrawal</strong> module uses joint life expectancy to dynamically determine your safe spending rate.
	</p>
</div>
