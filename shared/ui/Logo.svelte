<script lang="ts">
  import { suppressContextMenu } from "./chrome.js";
  import StatusDot from "./StatusDot.svelte";
  let { status = "live" }: { status?: "connecting" | "live" | "reconnecting" } = $props();
</script>

<a
  href="/"
  aria-label="share"
  draggable="false"
  class="ui-chrome text-[length:calc(var(--header-control-height)/0.698)] leading-[1cap] font-bold tracking-[-0.04em] text-stone-900"
  {@attach suppressContextMenu}
>
  share<StatusDot {status} variant="logo" />
</a>
