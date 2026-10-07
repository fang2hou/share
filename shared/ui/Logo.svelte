<script lang="ts">
  import { suppressContextMenu } from "./chrome.js";
  import StatusDot from "./StatusDot.svelte";
  let { status = "live" }: { status?: "connecting" | "live" | "reconnecting" } = $props();
</script>

<a
  href="/"
  aria-label="share"
  draggable="false"
  class="site-logo ui-chrome"
  {@attach suppressContextMenu}
>
  share<StatusDot {status} variant="logo" />
</a>
