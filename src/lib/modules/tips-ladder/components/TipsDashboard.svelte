<script lang="ts">
	import { ladderStore } from '../store/ladder';
	import { formatCurrency } from '../../../shared/financial';
	
	let ladder = $derived($ladderStore);
</script>

{#if !ladder.target}
	<div class="text-slate-400 italic text-sm">No ladder designed.</div>
{:else}
	<div class="space-y-3">
		<div class="flex justify-between items-end">
			<div>
				<div class="text-[10px] font-black uppercase tracking-widest text-slate-400">Target Income</div>
				<div class="text-2xl font-serif font-bold text-slate-900">{formatCurrency(ladder.target.income)} <span class="text-xs font-sans text-slate-400 font-normal">/yr</span></div>
			</div>
			<div class="text-right">
				<div class="text-[10px] font-black uppercase tracking-widest text-slate-400">Duration</div>
				<div class="text-sm font-bold text-slate-700">{ladder.target.startYear} – {ladder.target.endYear}</div>
			</div>
		</div>
		
		<div class="pt-2 border-t border-slate-100">
			<div class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Status</div>
			<div class="flex items-center space-x-2">
				<div class="h-2 flex-1 bg-slate-100 rounded-full overflow-hidden">
					<div class="h-full bg-emerald-500" style="width: {ladder.holdings.length > 0 ? '100%' : '0%'}"></div>
				</div>
				<span class="text-[10px] font-bold text-emerald-600">{ladder.holdings.length > 0 ? 'ACTIVE' : 'EMPTY'}</span>
			</div>
		</div>
	</div>
{/if}
