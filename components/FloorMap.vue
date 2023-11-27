<template>
  <div id="floor-map">
  <div class="text-h5">Floor Map</div>
  <p>Press `Shift` to set bike pose</p>
  <ul>
    <li>Move the mouse to change position</li>
    <li>Use mouse wheel to change orientation</li>
  </ul>
  <div id="box" :style="boxStyle" @mousemove="trackMouse" @wheel.passive="trackWheel"></div>
  <v-btn style="margin-right: 1em">Set Initial Pose</v-btn>
  <v-btn>Set Final Pose</v-btn>
</div>
</template>
<script setup lang="ts">
import { usePGAStore } from "~/store/pga-store";
import { storeToRefs } from "pinia";
import { MathUtils } from "three";

const FLOOR_SIZE = 1000 // Must match the definition in ThreeCanvas.vue
const CANVAS_SIZE = 320
const store = usePGAStore();
const { bodyPosition, bodyRotation } = storeToRefs(store)
const boxStyle = computed(() => {
  return {
    width: CANVAS_SIZE+"px", height: CANVAS_SIZE+"px"
  }
})
function trackMouse(ev: MouseEvent) {
  if (ev.shiftKey) {
    // console.debug(ev.offsetX, ev.offsetY);
    const bodyX = FLOOR_SIZE /2 - ev.offsetX/CANVAS_SIZE * FLOOR_SIZE
    const bodyY = ev.offsetY/CANVAS_SIZE * FLOOR_SIZE - FLOOR_SIZE/2
    bodyPosition.value.set(bodyX, bodyY)
  }
}
function trackWheel(ev: WheelEvent) {
  if (ev.shiftKey) {
    
    bodyRotation.value += MathUtils.degToRad(2) * Math.sign(ev.deltaY)
    
  }
}
</script>
<style scoped>
#box {
  border: 1px solid gray;
  margin: 8px 0;
}
#floor-map {
  margin: 1em;
}
</style>
