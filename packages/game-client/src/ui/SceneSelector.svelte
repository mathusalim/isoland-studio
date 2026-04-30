<script lang="ts">
  import { activeScene, switchSceneFn, SCENE_IDS, SCENE_LABELS } from './sceneStore.js'
</script>

<div class="fixed top-3 left-3 z-9999 flex items-center gap-1.5 font-mono text-xs pointer-events-auto">
  <span class="text-yellow-300/90 tracking-widest mr-0.5">DEV</span>
  {#each SCENE_IDS as id (id)}
    <button
      class="px-3.5 py-1 rounded border cursor-pointer transition-colors duration-100
        {$activeScene === id
        ? 'border-white/85 bg-white/18 text-white'
        : 'border-white/25 bg-black/55 text-white hover:border-white/50'}"
      onclick={() => $switchSceneFn(id)}
    >
      {SCENE_LABELS[id]}
    </button>
  {/each}
</div>
