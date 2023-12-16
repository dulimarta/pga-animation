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
        @click="findBikePath"
        color="green"
        :disabled="!initialMarkerShown || !finalMarkerShown"
        >Find Path</v-btn
      >
    </div>
    <v-textarea label="Debugging output" v-model="debugText"></v-textarea>
    <ul>
      <li>Path distance {{ pathDistance.toFixed(2) }}</li>
      <li>Line 1 orientation: {{ initialOrientation.toFixed(3) }}</li>
      <li>Line 2 orientation: {{ finalOrientation.toFixed(3) }}</li>
      <li>
        Angle between {{ (finalOrientation - initialOrientation).toFixed(3) }}
      </li>
    </ul>
  </div>
</template>
<script setup lang="ts">
import { usePGAStore } from "~/store/pga-store";
import { storeToRefs } from "pinia";
import { MathUtils, Raycaster, Vector2, Vector3 } from "three";
import { useVisualStore } from "~/store/visual-store";
const { makePoint, makeDirection } = usePGA2D();
const CANVAS_SIZE = 320;
// const box: Ref<HTMLCanvasElement | null> = ref(null);
const store = usePGAStore();
const visualStore = useVisualStore();
const { /*bodyPosition, bodyRotation, */ runMode } = storeToRefs(store);
const { makeArrow, makeSphere } = visualStore;
const {
  visualScene,
  visualCamera,
  mousePositionOnGround,
  mouseWheelDirection,
} = storeToRefs(visualStore);
// const initialPose = new Vector2();
// const finalPose = new Vector2();
const activePose: Ref<"initial" | "final"> = ref("initial");
const pathDistance = ref(0);
const debugText = ref("N/A");
// let arrowOrientation = 0;
const initialOrientation = ref(0);
const finalOrientation = ref(0);
const initialMarker = makeArrow(50, 4, "green");
const finalMarker = makeArrow(50, 4, "red");
const initialMarkerShown = ref(false);
const finalMarkerShown = ref(false);
const intersectionSphere = makeSphere(5, "blue");
const rotationPivotSphere = makeSphere(5, "yellow")
const transitionSphere = makeSphere(8, "white")
// let activeMarker = initialMarker;
onMounted(() => {
  visualScene.value?.add(intersectionSphere);
  visualScene.value?.add(rotationPivotSphere);
  visualScene.value?.add(transitionSphere);
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

// watch(
//   () => activePose.value,
//   (active: "initial" | "final") => {
//     // if (active === "initial") arrowOrientation = initialOrientation.value;
//     // else arrowOrientation = finalOrientation.value;
//   }
// );
function within360(x: number) {
  if (x > 360) return x - 360;
  if (x < 0) return x + 360;
  return x;
}
watch(
  [() => mousePositionOnGround.value, () => mouseWheelDirection.value],
  ([pos, wheel]: [Vector3, number]) => {
    checkMarkersVisibility();
    if (activePose.value === "initial") {
      initialOrientation.value += wheel / 2;
      initialOrientation.value = within360(initialOrientation.value);
      initialMarker.position.copy(pos);
      initialMarker.rotation.z = MathUtils.degToRad(initialOrientation.value);
    } else {
      finalOrientation.value += wheel / 2;
      finalOrientation.value = within360(finalOrientation.value);
      finalMarker.position.copy(pos);
      finalMarker.rotation.z = MathUtils.degToRad(finalOrientation.value);
    }
  },
  { deep: true }
);

function checkMarkersVisibility() {
  if (activePose.value === "initial") {
    if (!initialMarkerShown.value) {
      visualScene.value?.add(initialMarker);
      initialMarkerShown.value = true;
    }
  } else {
    if (!finalMarkerShown.value) {
      visualScene.value?.add(finalMarker);
      finalMarkerShown.value = true;
    }
  }
  if (initialMarkerShown.value && finalMarkerShown.value) {
    findBikePath();
  }
}

function parseLine(text: string, L: any): string {
  return `${text}: ${L.e1.toFixed(2)}X ${L.e2.toFixed(2)}Y + ${L.e0.toFixed(
    2
  )}`;
}
function parsePoint(text: string, P: any): string {
  return `${text}: (${-P.e02.toFixed(2)},${P.e01.toFixed(2)})`;
}

function withinPi(x: number): number {
  if (x > Math.PI) return x - Math.PI;
  if (x < -Math.PI) return x + Math.PI;
  return x;
}
function findBikePath() {
  const initialPoint = makePoint(
    initialMarker.position.x,
    initialMarker.position.y
  );
  const finalPoint = makePoint(finalMarker.position.x, finalMarker.position.y);
  // const iAngle = withinPi(initialMarker.rotation.z);
  const initialDirection = makeDirection(
    Math.cos(initialMarker.rotation.z),
    Math.sin(initialMarker.rotation.z)
  );
  // const fAngle = withinPi(finalMarker.rotation.z);
  const finalDirection = makeDirection(
    Math.cos(finalMarker.rotation.z),
    Math.sin(finalMarker.rotation.z)
  );
  const line1 = initialPoint.Vee(initialDirection);
  const line2 = finalPoint.Vee(finalDirection);
  const intersection = line1.Wedge(line2);
  pathDistance.value = initialPoint.Vee(finalPoint).Length;
  if (Math.abs(intersection.e12) > 1e-5) {
    intersectionSphere.position.set(
      -intersection.e02 / intersection.e12,
      intersection.e01 / intersection.e12,
      0
    );
    const initialToIntersection = initialPoint.Vee(intersection);
    const intersectionToFinal = intersection.Vee(finalPoint);
    const i2xDistance = initialToIntersection.Dot(initialDirection).e0;
    const x2fDistance = intersectionToFinal.Dot(finalDirection).e0;
    // const s2 = makeSphere(5, "cyan");
    // s2.position.set(-finalPoint.e02, finalPoint.e01, 0);
    // visualScene.value?.add(s2);
    debugText.value =
      ` I2X dist: ${i2xDistance.toFixed(2)}  X2F dist ${x2fDistance.toFixed(
        2
      )}`;
    if (i2xDistance * x2fDistance > 0) {
      const bisector = line1.Normalized.Sub(line2.Normalized)
      debugText.value += " ONE TURN only";
      let pivotOfRotation
      if (Math.abs(i2xDistance) < Math.abs(x2fDistance)) {
        const iPerp = line1.Dot(initialPoint)
        pivotOfRotation = bisector.Wedge(iPerp)
        const fPerp = line2.Dot(pivotOfRotation)
        const fPrior = fPerp.Wedge(line2)
        transitionSphere.position.set(-fPrior.e02/fPrior.e12, fPrior.e01/fPrior.e12, 0)
        debugText.value += ' Start is ahead, rotate then translate'
      } else {
        const fPerp = line2.Dot(finalPoint)
        pivotOfRotation = bisector.Wedge(fPerp)
        const iPerp = line1.Dot(pivotOfRotation)
        const iPost = iPerp.Wedge(line1)
        transitionSphere.position.set(-iPost.e02/iPost.e12, iPost.e01/iPost.e12, 0)
        debugText.value += ' Start is behind, translate then rotate'
      }
      rotationPivotSphere.position.set(-pivotOfRotation.e02/pivotOfRotation.e12, pivotOfRotation.e01/pivotOfRotation.e12, 0)
    } else debugText.value += " TWO TURNS required";
  } else {
    debugText.value = "Parallel lines";
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
