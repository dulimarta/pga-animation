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
    <v-radio-group v-model="activePose" inline>
      <v-radio label="Configure initial pose" value="initial"></v-radio>
      <v-radio label="Configure final pose" value="final"></v-radio>
    </v-radio-group>
    <div>
      <v-btn style="margin-right: 1em" @click="setMarkerPose" color="green"
        >Find Path</v-btn
      >
    </div>
  </div>
</template>
<script setup lang="ts">
import { usePGAStore } from "~/store/pga-store";
import { storeToRefs } from "pinia";
import { Group, MathUtils, Scene, Vector2 } from "three";
import { useVisualStore } from "~/store/visual-store";

const FLOOR_SIZE = 1000; // Must match the definition in ThreeCanvas.vue
const CANVAS_SIZE = 320;
const box: Ref<HTMLCanvasElement | null> = ref(null);
const store = usePGAStore();
const visualStore = useVisualStore();
const { /*bodyPosition, bodyRotation, */ runMode } = storeToRefs(store);
const { makeArrow } = visualStore;
const { visualScene } = storeToRefs(visualStore);
const initialPose: Ref<Vector2 | null> = ref(null);
const finalPose: Ref<Vector2 | null> = ref(null);
const activePose: Ref<"initial" | "final"> = ref("initial");
const canvasX = ref(0);
const canvasY = ref(0);
let arrowOrientation = 0;
let initialOrientation = 0;
let finalOrientation = 0;
let gfx: CanvasRenderingContext2D;
const initialMarker = makeArrow(50, 4, "green");
const finalMarker = makeArrow(50, 4, "red");
let initialMarkerShown = false;
let finalMarkerShown = false;
let activeMarker = initialMarker;
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

watch(
  () => runMode.value,
  (mode: "plan" | "run") => {
    if (mode === "run") {
      visualScene.value?.remove(initialMarker);
      visualScene.value?.remove(finalMarker);
    }
  }
);

watch(
  () => activePose.value,
  (active: "initial" | "final") => {
    if (active === "initial") arrowOrientation = initialOrientation;
    else arrowOrientation = finalOrientation;
  }
);

function checkMarkersVisibility() {
  if (activePose.value === "initial") {
    if (!initialMarkerShown) {
      visualScene.value?.add(initialMarker);
      initialMarkerShown = true;
    }
    activeMarker = initialMarker;
  } else {
    if (!finalMarkerShown) {
      visualScene.value?.add(finalMarker);
      finalMarkerShown = true;
    }
    activeMarker = finalMarker;
  }
}
function trackMouse(ev: MouseEvent) {
  if (ev.shiftKey) {
    checkMarkersVisibility();
    // console.debug(ev.offsetX, ev.offsetY);
    const bodyX = (ev.offsetX / CANVAS_SIZE) * FLOOR_SIZE - FLOOR_SIZE / 2;
    const bodyY = FLOOR_SIZE / 2 - (ev.offsetY / CANVAS_SIZE) * FLOOR_SIZE;
    if (activePose.value === "initial") {
      initialMarker.position.set(bodyX, bodyY, 0);
      initialPose.value?.set(bodyX, bodyY);
    } else {
      finalMarker.position.set(bodyX, bodyY, 0);
      finalPose.value?.set(bodyX, bodyY);
    }
    gfx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    drawPose(ev.offsetX, ev.offsetY, arrowOrientation, "black");
  }
}

function trackWheel(ev: WheelEvent) {
  if (ev.shiftKey) {
    checkMarkersVisibility();
    arrowOrientation += MathUtils.degToRad(2) * Math.sign(ev.deltaY);
    if (activePose.value === "initial") {
      initialMarker.rotation.z = -arrowOrientation - Math.PI / 2;
      initialOrientation = arrowOrientation;
    } else {
      finalMarker.rotation.z = -arrowOrientation - Math.PI / 2;
      finalOrientation = arrowOrientation;
    }
    gfx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    drawPose(ev.offsetX, ev.offsetY, arrowOrientation, "black");
  }
}
function drawPose(x: number, y: number, angleRad: number, color: string) {
  gfx.save();
  gfx.translate(x, y);
  gfx.rotate(angleRad);
  drawArrow(color);
  gfx.restore();
}
function drawArrow(c: string) {
  gfx.beginPath();
  gfx.lineWidth = 3;
  gfx.strokeStyle = c;
  gfx.moveTo(0, 0);
  gfx.lineTo(30, 0);
  gfx.stroke();

  gfx.beginPath();
  gfx.lineWidth = 3;
  gfx.fillStyle = c;
  gfx.moveTo(35, 0);
  gfx.lineTo(30, -5);
  gfx.lineTo(30, 5);
  gfx.closePath();
  gfx.fill();
}

function setMarkerPose() {
  if (initialPose.value === null) initialPose.value = new Vector2();
  initialPose.value.set(initialMarker.position.x, initialMarker.position.y);
  initialOrientation = arrowOrientation;
  canvasX.value =
    ((initialPose.value.x + FLOOR_SIZE / 2) * CANVAS_SIZE) / FLOOR_SIZE;
  canvasY.value =
    ((-initialPose.value.y + FLOOR_SIZE / 2) * CANVAS_SIZE) / FLOOR_SIZE;
  drawPose(canvasX.value, canvasY.value, initialOrientation, "green");
}

function setFinalPose() {
  if (finalPose.value === null) finalPose.value = new Vector2();
  // finalPose.value.set(bodyPosition.value);
  // finalOrientation = bodyRotation.value;
  canvasX.value =
    ((finalPose.value.x + FLOOR_SIZE / 2) * CANVAS_SIZE) / FLOOR_SIZE;
  canvasY.value =
    ((-finalPose.value.y + FLOOR_SIZE / 2) * CANVAS_SIZE) / FLOOR_SIZE;
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
