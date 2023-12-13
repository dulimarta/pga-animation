<template>
  <div id="floor-map">
    <div class="text-h5">Floor Map</div>
    <p>Press `Shift` to set bike pose</p>
    <ul>
      <li>Move the mouse to change position</li>
      <li>Use mouse wheel to change orientation</li>
    </ul>
    <canvas
      id="box"
      ref="box"
      @mousemove="trackMouse"
      @wheel.passive="trackWheel"
    ></canvas>
    <div>
      <v-btn style="margin-right: 1em" @click="setInitialPose" color="green">Set Start</v-btn>
      <v-btn @click="setFinalPose" color="red">Set Final</v-btn>
    </div>
  </div>
</template>
<script setup lang="ts">
import { usePGAStore } from "~/store/pga-store";
import { storeToRefs } from "pinia";
import { MathUtils, Vector2 } from "three";

const FLOOR_SIZE = 1000; // Must match the definition in ThreeCanvas.vue
const CANVAS_SIZE = 320;
const box: Ref<HTMLCanvasElement | null> = ref(null);
const store = usePGAStore();
const { bodyPosition, bodyRotation } = storeToRefs(store);
const initialPose: Ref<Vector2 | null> = ref(null);
const finalPose: Ref<Vector2 | null> = ref(null);
const canvasX = ref(0)
  const canvasY = ref(0)
let initialOrientation = 0;
let finalOrientation = 0;
// const boxStyle = computed(() => {
//   return {
//     width: CANVAS_SIZE+"px", height: CANVAS_SIZE+"px"
//   }
// })
let gfx: CanvasRenderingContext2D;
onMounted(() => {
  if (box.value) {
    gfx = box.value.getContext("2d")!;
    box.value.width = CANVAS_SIZE;
    box.value.height = CANVAS_SIZE;
  }
  console.debug(
    `Canvas dim ${box.value?.width}x${box.value?.height} ${box.value?.clientWidth}x${box.value?.clientHeight}`
  );
});

function trackMouse(ev: MouseEvent) {
  if (ev.shiftKey) {
    // console.debug(ev.offsetX, ev.offsetY);
    const bodyX = (ev.offsetX / CANVAS_SIZE) * FLOOR_SIZE - FLOOR_SIZE/2;
    const bodyY = FLOOR_SIZE/2 - (ev.offsetY / CANVAS_SIZE) * FLOOR_SIZE;
    bodyPosition.value.set(bodyX, bodyY);
    gfx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    drawPose(ev.offsetX, ev.offsetY, bodyRotation.value, "black");
    if (initialPose.value !== null) {
      canvasX.value = (initialPose.value.x + FLOOR_SIZE/2) * CANVAS_SIZE / FLOOR_SIZE
      canvasY.value = (-initialPose.value.y + FLOOR_SIZE/2) * CANVAS_SIZE/FLOOR_SIZE
      // console.debug(`X Conversion ${initialPose.value.x} ==> ${canvasX}`)
      drawPose(canvasX.value, canvasY.value, initialOrientation, "green");
    }
  }
}

function drawPose(x: number, y: number, angleRad: number, color:string) {
  gfx.save();
  gfx.translate(x, y);
  gfx.rotate(angleRad);
  drawArrow(color);
  gfx.restore();
}
function drawArrow(c:string) {
  gfx.beginPath();
  gfx.lineWidth = 3
  gfx.strokeStyle = c
  gfx.moveTo(0, 0);
  gfx.lineTo(30, 0);
  gfx.stroke();

  gfx.beginPath();
  gfx.lineWidth = 3
  gfx.fillStyle = c
  gfx.moveTo(35, 0);
  gfx.lineTo(30, -5);
  gfx.lineTo(30, 5);
  gfx.closePath();
  gfx.fill();
}
function trackWheel(ev: WheelEvent) {
  if (ev.shiftKey) {
    bodyRotation.value += MathUtils.degToRad(2) * Math.sign(ev.deltaY);
    gfx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    drawPose(ev.offsetX, ev.offsetY, bodyRotation.value, "black");
    if (initialPose.value !== null) {
      canvasX.value = (initialPose.value.x + FLOOR_SIZE/2) * CANVAS_SIZE / FLOOR_SIZE
      canvasY.value = (-initialPose.value.y + FLOOR_SIZE/2) * CANVAS_SIZE/FLOOR_SIZE
      drawPose(canvasX.value, canvasY.value, initialOrientation, "green");
    }

  }
}

function setInitialPose() {
  if (initialPose.value === null) initialPose.value = new Vector2();
  initialPose.value.copy(bodyPosition.value);
  initialOrientation = bodyRotation.value;
  canvasX.value = (initialPose.value.x + FLOOR_SIZE/2) * CANVAS_SIZE / FLOOR_SIZE
  canvasY.value = (-initialPose.value.y + FLOOR_SIZE/2) * CANVAS_SIZE/FLOOR_SIZE
  drawPose(canvasX.value, canvasY.value, initialOrientation, "green");

}

function setFinalPose() {
  if (finalPose.value === null) finalPose.value = new Vector2();
  finalPose.value.copy(bodyPosition.value);
  finalOrientation = bodyRotation.value;
  canvasX.value = (finalPose.value.x + FLOOR_SIZE/2) * CANVAS_SIZE / FLOOR_SIZE
  canvasY.value = (-finalPose.value.y + FLOOR_SIZE/2) * CANVAS_SIZE/FLOOR_SIZE
  drawPose(canvasX.value, canvasY.value, finalOrientation, "red");
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
