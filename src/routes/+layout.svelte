<script lang="ts">
  import type { LayoutProps } from "./$types";
  import "../app.css";
  import ReadyFrame from "#shared/ui/ReadyFrame.svelte";

  let { children }: LayoutProps = $props();
</script>

<ReadyFrame>{@render children()}</ReadyFrame>
