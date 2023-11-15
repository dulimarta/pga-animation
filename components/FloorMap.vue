<template>
  <div class="text-h5">Floor Map</div>
  <div id="box" @mousemove="trackMouse" @wheel.passive="trackWheel"></div>
</template>
<script setup lang="ts">
import { usePGAStore } from "~/store/pga-store";
import { storeToRefs } from "pinia";
import { MathUtils } from "three";

const FLOOR_SIZE = 1000 // Must match the definition in ThreeCanvas.vue
const store = usePGAStore();
const {bodyPosition, bodyRotation} = storeToRefs(store)
function trackMouse(ev: MouseEvent) {
  if (ev.shiftKey) {
    // console.debug(ev.offsetX, ev.offsetY);
    const bodyX = FLOOR_SIZE /2 - ev.offsetX/256 * FLOOR_SIZE
    const bodyY = ev.offsetY/256 * FLOOR_SIZE - FLOOR_SIZE/2
    bodyPosition.value.set(bodyX, bodyY)
  }
}
function trackWheel(ev: WheelEvent) {
  if (ev.shiftKey) {
    console.debug(ev.deltaMode, ev.deltaX, ev.deltaY, ev.deltaZ, ev.movementX, ev.movementY)
    if (Math.sign(ev.deltaY) > 0)
      bodyRotation.value += MathUtils.degToRad(2)
    else
    bodyRotation.value -= MathUtils.degToRad(2)
  }
}
</script>
<style scoped>
#box {
  width: 256px;
  height: 256px;
  border: 1px solid gray;
}
</style>
