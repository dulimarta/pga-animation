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
import { MathUtils, Mesh, TorusGeometry, Vector3 } from "three";
import { useVisualStore } from "~/store/visual-store";
const { makePoint, makeDirection } = usePGA2D();
const CANVAS_SIZE = 320;
const MARKER_LENGTH = 50;
// const box: Ref<HTMLCanvasElement | null> = ref(null);
const store = usePGAStore();
const visualStore = useVisualStore();
const { /*bodyPosition, bodyRotation, */ runMode } = storeToRefs(store);
const { makeArrow, makeSphere, makePipe, makeArc } = visualStore;
const {
  visualScene,
  visualCamera,
  mousePositionOnGround,
  mouseWheelScrollAmount,
} = storeToRefs(visualStore);
// const initialPose = new Vector2();
// const finalPose = new Vector2();
const activePose: Ref<"initial" | "final"> = ref("initial");
const pathDistance = ref(0);
const debugText = ref("N/A");
// let arrowOrientation = 0;
const initialOrientation = ref(0);
const finalOrientation = ref(0);
const initialMarker = makeArrow(MARKER_LENGTH, 4, "green");
const finalMarker = makeArrow(MARKER_LENGTH, 4, "red");
const initialMarkerShown = ref(false);
const finalMarkerShown = ref(false);
const intersectionSphere = makeSphere(5, "blue");
const rotationPivotSphere = makeSphere(5, "yellow");
const transitionSphere = makeSphere(8, "white");
const transitionPipe = makePipe(1, 4, "white");
const turnArc = makeArc(1, 4, 90, "white");
// let activeMarker = initialMarker;
onMounted(() => {
  visualScene.value?.add(intersectionSphere);
  visualScene.value?.add(rotationPivotSphere);
  visualScene.value?.add(transitionSphere);
  visualScene.value?.add(transitionPipe);
  visualScene.value?.add(turnArc)
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

let lastMouseWheelScrollAmount = 0;
watch(
  [() => mousePositionOnGround.value, () => mouseWheelScrollAmount.value],
  ([pos, wheel]: [Vector3, number]) => {
    checkMarkersVisibility();
    const wheelScrollAmount = 0.8 * lastMouseWheelScrollAmount + 0.2 * wheel;
    lastMouseWheelScrollAmount = wheel;
    if (activePose.value === "initial") {
      initialOrientation.value += wheelScrollAmount;
      initialOrientation.value = within360(initialOrientation.value);
      initialMarker.position.copy(pos);
      initialMarker.rotation.z = MathUtils.degToRad(initialOrientation.value);
    } else {
      finalOrientation.value += wheelScrollAmount;
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

function rotateThenTranslate(
  initialPoint: any,
  finalPoint: any,
  line1: any,
  line2: any,
  bisector: any,
  rotateAmount: number
): [any,number] {
  const iPerp = line1.Dot(initialPoint); // Perpendicular from initial point
  const pivotOfRot = bisector.Wedge(iPerp).Normalized; // intersect the perpendicular with the angle bisector
  const fPerp = line2.Dot(pivotOfRot); // perpendicular to final point
  const fPrior = fPerp.Wedge(line2); // intermediate point prior to the final point
  const turnRad = pivotOfRot.Vee(initialPoint).Length

  transitionSphere.position.set(
    -fPrior.e02 / fPrior.e12,
    fPrior.e01 / fPrior.e12,
    0
  );
  const transitionDistance = fPrior.Normalized.Vee(
    finalPoint.Normalized
  ).Length;
  transitionPipe.position.set(
    -fPrior.e02 / fPrior.e12,
    fPrior.e01 / fPrior.e12,
    0
  );
  transitionPipe.rotation.z = MathUtils.degToRad(finalOrientation.value - 90);
  transitionPipe.translateY(transitionDistance / 2);
  transitionPipe.scale.y = transitionDistance;
  debugText.value += ` Start is ahead, rotate by ${rotateAmount.toFixed(
    1
  )} then translate by ${transitionDistance.toFixed(2)}`;
  return [pivotOfRot, turnRad]
}

function translateThenRotate(
  initialPoint: any,
  finalPoint: any,
  line1: any,
  line2: any,
  bisector: any,
  rotateAmount: number
): [any,number] {
  const fPerp = line2.Dot(finalPoint); // Perpendicular from the final point
  const pivot = bisector.Wedge(fPerp).Normalized; // intersect the perpendicular with the angle bisector
  const iPerp = line1.Dot(pivot); // Perpendicular to the initial point
  const iPost = iPerp.Wedge(line1); // intermediate point after the start point
  const turnRad = pivot.Vee(finalPoint).Length
  transitionSphere.position.set(
    -iPost.e02 / iPost.e12,
    iPost.e01 / iPost.e12,
    0
  );
  const transitionDistance =
    initialPoint.Normalized.Vee(iPost.Normalized).Length - MARKER_LENGTH;
  transitionPipe.position.set(-iPost.e02 / iPost.e12, iPost.e01 / iPost.e12, 0);
  transitionPipe.rotation.z = MathUtils.degToRad(initialOrientation.value + 90);
  transitionPipe.translateY(transitionDistance / 2);
  transitionPipe.scale.y = transitionDistance;
  debugText.value += ` Start is behind, translate by ${transitionDistance.toFixed(
    2
  )} then rotate by ${rotateAmount.toFixed(1)}`;
  return [pivot,turnRad];
}

function modifyTurningArc(radius: number, arcLengthDegree: number) {
  turnArc.geometry.dispose();
  const geo = new TorusGeometry(radius, 4, 10, Math.ceil(arcLengthDegree / 5), arcLengthDegree * Math.PI / 180)
  turnArc.geometry = geo
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
    debugText.value = ` I2X dist: ${i2xDistance.toFixed(
      2
    )}  X2F dist ${x2fDistance.toFixed(2)}`;
    if (i2xDistance * x2fDistance > 0) {
      let rotateAmount =
        i2xDistance < 0
          ? finalOrientation.value - initialOrientation.value
          : 360 - finalOrientation.value + initialOrientation.value;
      while (rotateAmount > 360) rotateAmount -= 360;
      while (rotateAmount < 0) rotateAmount += 360;
      const bisector = line1.Normalized.Sub(line2.Normalized);
      debugText.value += " ONE TURN only";
      let pivotOfRotation, radiusOfRotation;
      if (
        (rotateAmount < 180 && Math.abs(i2xDistance) < Math.abs(x2fDistance)) ||
        (rotateAmount > 180 && Math.abs(i2xDistance) > Math.abs(x2fDistance))
      ) {
        [pivotOfRotation, radiusOfRotation] = rotateThenTranslate(
          initialPoint,
          finalPoint,
          line1,
          line2,
          bisector,
          rotateAmount
        );
      } else {
        [pivotOfRotation, radiusOfRotation] = translateThenRotate(
          initialPoint,
          finalPoint,
          line1,
          line2,
          bisector,
          rotateAmount
        );
      }
      rotationPivotSphere.position.set(
        -pivotOfRotation.e02 / pivotOfRotation.e12,
        pivotOfRotation.e01 / pivotOfRotation.e12,
        0
      );
      turnArc.position.copy(rotationPivotSphere.position)
      // const turnRadius = pivotOfRotation.Vee(initialPoint).Length
      // debugText.value += `, turn radius ${radiusOfRotation.toFixed(2)}`
      modifyTurningArc(radiusOfRotation, rotateAmount)
      // if (rotateAmount < 180)
      if (i2xDistance > 0) {
        // lineup the arc with the final point
        turnArc.rotation.z = MathUtils.degToRad(90 + finalOrientation.value)
      }
      else {
        // lineup the arc with the initial point
        turnArc.rotation.z = MathUtils.degToRad(initialOrientation.value - 90)
      }
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
