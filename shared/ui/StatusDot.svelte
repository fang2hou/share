<script lang="ts">
  let {
    status,
    variant = "dot",
  }: { status: "connecting" | "live" | "reconnecting"; variant?: "dot" | "logo" } = $props();

  const color = $derived(
    status === "live"
      ? "bg-emerald-500"
      : status === "reconnecting"
        ? "bg-amber-500"
        : "bg-stone-300",
  );
</script>

{#if variant === "logo"}
  <!-- The wordmark period scales with the lettering and follows connection state. -->
  <span
    class="ml-[0.18em] inline-block size-[0.24em] rounded-full align-baseline {color}"
    title={status}
  ></span>
{:else}
  <span class="size-2 rounded-full {color}" title={status}></span>
{/if}
