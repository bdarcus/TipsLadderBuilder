<script lang="ts">
	import { onMount } from 'svelte';
	import { ladderStore } from '../store/ladder';
	import { fetchMarketData, getRefCpi, type MarketData } from '../engine/market-data';
	import { runRebalance } from '../engine/rebalance-engine';
	import { toDateStr } from '../../../shared/date';
	import { exportToCsv } from '../engine/export';

	let marketData = $state<MarketData | null>(null);
	let error = $state<string | null>(null);

	onMount(async () => {
		ladderStore.load();
		try {
			marketData = await fetchMarketData();
		} catch (e) {
			error = "Failed to load market data.";
		}
	});

	let ladder = $derived($ladderStore);

	// Derived projection
	let projection = $derived.by(() => {
		if (!marketData) {
			return null;
		}
		if (!ladder.holdings.length || !ladder.target) {
			return null;
		}
		try {
			const dateStr = toDateStr(marketData.settlementDate);
			const refCPI = getRefCpi(marketData.refCpiRows, dateStr);
			const res = runRebalance({
				dara: ladder.target.income,
				method: 'Gap',
				holdings: ladder.holdings,
				tipsMap: marketData.tipsMap,
				refCPI: refCPI,
				settlementDate: marketData.settlementDate,
				startYear: ladder.target.startYear,
				endYear: ladder.target.endYear
			});
			return res;
		} catch (e) {
			console.error("Analysis: Rebalance failed", e);
			return null;
		}
	});

	// Helper to get status of a year
	function getYearStatus(year: number, income: number, target: number) {
		const ratio = target > 0 ? income / target : 0;
		
		if (income <= 0) {
			return { label: 'Unfunded', desc: 'No income for this year', color: 'bg-slate-100 text-slate-500', bar: 'bg-slate-200' };
		}
		if (ratio >= 0.98 && ratio <= 1.02) {
			return { label: 'Funded', desc: 'Meets income target (±2%)', color: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500' };
		}
		if (ratio < 0.98) {
			return { label: 'Partial', desc: 'Income below target (coupons only)', color: 'bg-amber-100 text-amber-700', bar: 'bg-amber-400' };
		}
		return { label: 'Surplus', desc: 'Income exceeds target', color: 'bg-blue-100 text-blue-700', bar: 'bg-emerald-600' };
	}

	let years = $derived.by(() => {
		if (!projection) return [];
		const uniqueYears = Array.from(new Set(projection.results.map((r: any) => parseInt(r[3])).filter((y: any) => !isNaN(y)))) as number[];
		return uniqueYears.sort((a, b) => a - b).map(y => {
			const row = projection.results.find((r: any) => parseInt(r[3]) === y);
			const income = row ? row[6] : 0;
			const target = ladder.target?.income || 0;
			return {
				year: y,
				income,
				target,
				status: getYearStatus(y, income, target),
				isGap: projection.summary.gapYears.includes(y)
			};
		});
	});
</script>

{#if !ladder.target}
	<div class="text-center py-20 bg-white rounded-3xl border border-slate-200 shadow-sm">
		<div class="text-5xl mb-6">🔭</div>
		<h2 class="font-serif text-3xl font-bold text-slate-900 mb-4">No Ladder Found</h2>
		<p class="text-slate-500 max-w-sm mx-auto mb-8">You haven't designed or imported a ladder yet. Start by designing a new plan.</p>
	</div>
{:else}
	<div class="space-y-8">
		<header class="flex flex-col md:flex-row md:items-end justify-between gap-4">
			<div>
				<h1 class="font-serif text-4xl font-bold text-slate-900">Ladder Dashboard</h1>
				<p class="text-slate-500 mt-2">Tracking income for {ladder.target.startYear} – {ladder.target.endYear}</p>
			</div>
			<div class="flex gap-2">
				<button 
					onclick={() => {
						const dateStr = toDateStr(marketData!.settlementDate);
						const refCPI = getRefCpi(marketData!.refCpiRows, dateStr);
						const res = runRebalance({
							dara: ladder.target!.income,
							method: 'Gap',
							holdings: ladder.holdings,
							tipsMap: marketData!.tipsMap,
							refCPI: refCPI,
							settlementDate: marketData!.settlementDate
						});
						ladderStore.save({
							...ladder,
							lastResults: res
						});
					}}
					class="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-500 uppercase tracking-widest transition-colors shadow-sm"
				>
					Run Rebalance
				</button>
				<button onclick={() => ladderStore.reset()} class="px-4 py-2 text-xs font-bold text-slate-400 hover:text-red-600 uppercase tracking-widest transition-colors">Reset</button>
				<button 
					onclick={() => projection && exportToCsv('tips-ladder-projection.csv', projection.HDR, projection.results)}
					class="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-50 uppercase tracking-widest transition-colors"
				>
					Export Plan
				</button>
				<a href="/import" class="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-50 uppercase tracking-widest transition-colors">Sync CSV</a>
			</div>
		</header>

		<!-- Visual Chart -->
		<div class="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
			<div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
				<h3 class="font-serif text-xl font-bold">Annual Real Income Projection</h3>
				<div class="flex flex-wrap gap-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
					<div class="flex items-center group relative cursor-help">
						<span class="w-3 h-3 bg-emerald-500 rounded-full mr-2"></span> Funded
					</div>
					<div class="flex items-center group relative cursor-help">
						<span class="w-3 h-3 bg-amber-400 rounded-full mr-2"></span> Partial
					</div>
					<div class="flex items-center group relative cursor-help">
						<span class="w-3 h-3 border-2 border-emerald-400 rounded-full mr-2"></span> Gap (Covered)
					</div>
				</div>
			</div>

			<div class="relative h-64 flex items-end gap-2 border-b border-slate-100 pb-2">
				{#if years.length === 0}
					<div class="absolute inset-0 flex items-center justify-center text-slate-300 italic text-sm">
						Calculating projection...
					</div>
				{/if}
				{#each years as y}
					{@const barHeight = ladder.target && ladder.target.income > 0 ? Math.min(100, (y.income / (ladder.target.income * 1.5)) * 100) : 0}
					<div class="flex-1 flex flex-col items-center group relative h-full justify-end">
						<div class="absolute bottom-0 w-full bg-slate-50 opacity-50" style="height: 100%"></div>
						<div 
							class="{y.status.bar} w-full max-w-[32px] rounded-t-sm transition-all group-hover:brightness-110 min-h-[2px] relative z-10" 
							style="height: {barHeight}%"
						></div>
						<div class="absolute -bottom-8 text-[10px] font-black {y.isGap ? 'text-emerald-600' : 'text-slate-400'} whitespace-nowrap">
							{y.year}
						</div>
					</div>
				{/each}
				
				{#if ladder.target && ladder.target.income > 0}
					<div class="absolute w-full border-t-2 border-dashed border-slate-300 pointer-events-none" style="bottom: {(1 / 1.5) * 100}%">
						<span class="absolute right-0 -top-6 text-[10px] font-black text-slate-400 uppercase">Target DARA</span>
					</div>
				{/if}
			</div>
		</div>

		<!-- List View -->
		<div class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
			<table class="w-full text-left">
				<thead class="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
					<tr>
						<th class="px-6 py-4">Year</th>
						<th class="px-6 py-4">Funded Income</th>
						<th class="px-6 py-4">Target Gap</th>
						<th class="px-6 py-4">Status</th>
						<th class="px-6 py-4 text-right">Coverage Strategy</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#each years as y}
						<tr class="hover:bg-slate-50 transition-colors">
							<td class="px-6 py-4">
								<div class="font-serif text-lg font-bold">{y.year}</div>
							</td>
							<td class="px-6 py-4 font-bold text-slate-700">
								${Math.round(y.income).toLocaleString()}
							</td>
							<td class="px-6 py-4 text-sm {y.income - y.target >= -100 ? 'text-emerald-600' : 'text-red-500'}">
								{y.income - y.target >= 0 ? '+' : ''}{Math.round(y.income - y.target).toLocaleString()}
							</td>
							<td class="px-6 py-4">
								<span class="px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest {y.status.color}">
									{y.status.label}
								</span>
							</td>
							<td class="px-6 py-4 text-right">
								{#if y.isGap}
									<div class="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Duration Match</div>
								{:else if y.status.label === 'Funded' || y.status.label === 'Surplus'}
									<div class="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Maturity Rung</div>
								{:else}
									<div class="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Coupon-Only</div>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
{/if}
