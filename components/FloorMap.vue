<template>
  <div id="floor-map">
    <div class="text-h5">Floor Map</div>
    <p>Press `Shift` to set bike pose</p>
    <ul>
      <li>Move the mouse to change position</li>
      <li>Use mouse wheel to change orientation</li>
    </ul>
    <v-radio-group v-model="activePose" inline>
      <v-radio label="Configure initial pose" value="initial"></v-radio>
      <v-radio label="Configure final pose" value="final"></v-radio>
    </v-radio-group>
    <div>
      <v-btn
        style="margin-right: 1em"
        @click="findPath"
        color="green"
        :disabled="!initialMarkerShown || !finalMarkerShown"
        >Find Path</v-btn
      >
      Path distance {{ pathDistance.toFixed(2) }}
    </div>
  </div>
</template>
<script setup lang="ts">
import { usePGAStore } from "~/store/pga-store";
import { storeToRefs } from "pinia";
import { MathUtils, Raycaster, Vector2, Vector3 } from "three";
import { useVisualStore } from "~/store/visual-store";
const { makePoint } = usePGA2D();
const CANVAS_SIZE = 320;
const box: Ref<HTMLCanvasElement | null> = ref(null);
const store = usePGAStore();
const visualStore = useVisualStore();
const { /*bodyPosition, bodyRotation, */ runMode } = storeToRefs(store);
const { makeArrow, makeSphere } = visualStore;
const { visualScene, visualCamera, mousePositionOnGround, mouseWheelDirection } =
  storeToRefs(visualStore);
// const initialPose = new Vector2();
// const finalPose = new Vector2();
const activePose: Ref<"initial" | "final"> = ref("initial");
const pathDistance = ref(0);
let arrowOrientation = 0;
let initialOrientation = 0;
let finalOrientation = 0;
let gfx: CanvasRenderingContext2D;
const initialMarker = makeArrow(50, 4, "green");
const finalMarker = makeArrow(50, 4, "red");
const initialMarkerShown = ref(false);
const finalMarkerShown = ref(false);
let activeMarker = initialMarker;
onMounted(() => {
  if (box.value) {
    gfx = box.value.getContext("2d")!;
    // box.value.width = CANVAS_SIZE;
    // box.value.height = CANVAS_SIZE;
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

watch(
  [() => mousePositionOnGround.value, () => mouseWheelDirection.value],
  ([pos, wheel]: [Vector3,number]) => {
    checkMarkersVisibility();
    if (activePose.value === "initial") {
      initialOrientation += wheel
      initialMarker.position.copy(pos);
      initialMarker.rotation.z = MathUtils.degToRad(initialOrientation)
    } else {
      finalOrientation += wheel
      finalMarker.position.copy(pos);
      finalMarker.rotation.z = MathUtils.degToRad(finalOrientation)
    }
  }, {deep:true}
);

function checkMarkersVisibility() {
  if (activePose.value === "initial") {
    if (!initialMarkerShown.value) {
      visualScene.value?.add(initialMarker);
      initialMarkerShown.value = true;
    }
    activeMarker = initialMarker;
  } else {
    if (!finalMarkerShown.value) {
      visualScene.value?.add(finalMarker);
      finalMarkerShown.value = true;
    }
    activeMarker = finalMarker;
  }
}

function findPath() {
  const initialPoint = makePoint(initialMarker.position.x, initialMarker.position.y);
  const finalPoint = makePoint(finalMarker.position.x, finalMarker.position.y);
  pathDistance.value = initialPoint.Vee(finalPoint).Length;
  const s1 = makeSphere(5, "yellow");
  s1.position.set(-initialPoint.e02, initialPoint.e01, 0);
  visualScene.value?.add(s1);

  const s2 = makeSphere(5, "cyan");
  s2.position.set(-finalPoint.e02, finalPoint.e01, 0);
  visualScene.value?.add(s2);
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
