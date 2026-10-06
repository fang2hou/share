<script lang="ts">
  let { status }: { status: "connecting" | "live" | "reconnecting" } = $props();

  const color = $derived(
    status === "live"
      ? "bg-emerald-500"
      : status === "reconnecting"
        ? "bg-amber-500"
        : "bg-stone-300",
  );
</script>

<span class="size-2 rounded-full {color}" title={status}></span>
