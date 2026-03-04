<script lang="ts">
	import { registry } from '$lib';
</script>

{#if registry.activeId}
	{@const activeModule = registry.getModule(registry.activeId)}
	{#if activeModule}
		{@const Config = activeModule.ui.Config}
		<Config />
	{/if}
{:else}
	<div class="p-12 text-center text-slate-400">
		Please select a module to begin designing.
	</div>
{/if}
