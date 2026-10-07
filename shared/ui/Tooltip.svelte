<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    label,
    children,
  }: {
    label: string;
    children: Snippet<[(element: HTMLElement) => () => void, string]>;
  } = $props();
  const id = $props.id();
  let tooltip = $state<HTMLDivElement>();

  function attach(element: HTMLElement): () => void {
    function show(): void {
      if (!tooltip || element.matches(":disabled, [aria-disabled='true']")) return;
      if (!tooltip.matches(":popover-open")) tooltip.showPopover();
      const anchor = element.getBoundingClientRect();
      const box = tooltip.getBoundingClientRect();
      tooltip.style.left = `${Math.max(8, Math.min(innerWidth - box.width - 8, anchor.left + (anchor.width - box.width) / 2))}px`;
      tooltip.style.top = `${anchor.top - box.height - 8 >= 8 ? anchor.top - box.height - 8 : anchor.bottom + 8}px`;
    }
    function hide(): void {
      if (tooltip?.matches(":popover-open")) tooltip.hidePopover();
    }
    function enter(event: PointerEvent): void {
      if (event.pointerType !== "touch") show();
    }
    function leave(): void {
      if (!element.matches(":focus-visible")) hide();
    }
    function escape(event: KeyboardEvent): void {
      if (event.key === "Escape") hide();
    }
    element.addEventListener("pointerenter", enter);
    element.addEventListener("pointerleave", leave);
    element.addEventListener("focusin", show);
    element.addEventListener("focusout", hide);
    element.addEventListener("click", hide);
    window.addEventListener("keydown", escape);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      hide();
      element.removeEventListener("pointerenter", enter);
      element.removeEventListener("pointerleave", leave);
      element.removeEventListener("focusin", show);
      element.removeEventListener("focusout", hide);
      element.removeEventListener("click", hide);
      window.removeEventListener("keydown", escape);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }
</script>

{@render children(attach, id)}
<div
  bind:this={tooltip}
  {id}
  popover="manual"
  role="tooltip"
  class="pointer-events-none fixed inset-auto m-0 w-max max-w-[calc(100vw-1rem)] rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 shadow-md"
>
  {label}
</div>
