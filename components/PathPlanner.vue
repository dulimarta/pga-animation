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
      <li>Line 1 orientation: {{ initialOrientation.toFixed(3) }}</li>
      <li>Line 2 orientation: {{ finalOrientation.toFixed(3) }}</li>
    </ul>
  </div>
</template>
<script setup lang="ts">
import { usePGAStore } from "~/store/pga-store";
import { storeToRefs } from "pinia";
import { MathUtils, TorusGeometry, Vector3 } from "three";
import { useVisualStore } from "~/store/visual-store";
import Algebra from "ganja.js";

const { makePoint, makeDirection } = usePGA2D();
const MARKER_LENGTH = 50;
const store = usePGAStore();
const visualStore = useVisualStore();
const PGA2D = Algebra({ p: 2, q: 0, r: 1, graded: false });
const { runMode, bodyPosition, bodyRotation } = storeToRefs(store);
const { makeArrow, makeSphere, makePipe, makeArc } = visualStore;
const { visualScene, mousePositionOnGround, mouseWheelScrollAmount } =
  storeToRefs(visualStore);
const activePose: Ref<"initial" | "final"> = ref("initial");
const debugText = ref("N/A");
const initialOrientation = ref(0);
const finalOrientation = ref(0);
const initialMarker = makeArrow(MARKER_LENGTH, 4, "green");
const finalMarker = makeArrow(MARKER_LENGTH, 4, "red");
const initialMarkerShown = ref(false);
const finalMarkerShown = ref(false);
const intersectionSphere = makeSphere(5, "blue");
const rotationPivotSphere = makeSphere(5, "yellow");
const rotationPivot2Sphere = makeSphere(5, "yellow");
const transitionSphere = makeSphere(8, "green");
const transitionSphere2 = makeSphere(8, "white");
const transitionPipe = makePipe(1, 4, "white");
const arcFromInitial = makeArc(1, 4, 90, "white");
const arcToFinal = makeArc(1, 4, 90, "white");
let doubleTurnPath = false;

onMounted(() => {
  visualScene.value?.add(intersectionSphere);
  visualScene.value?.add(rotationPivotSphere);
  visualScene.value?.add(transitionSphere);
  visualScene.value?.add(transitionPipe);
  visualScene.value?.add(arcFromInitial);

  visualScene.value?.add(rotationPivot2Sphere);
  visualScene.value?.add(transitionSphere2);
});

watch(
  () => runMode.value,
  (mode: "plan" | "run") => {
    if (mode === "run") {
      visualScene.value?.remove(initialMarker);
      visualScene.value?.remove(finalMarker);
      visualScene.value?.remove(transitionSphere);
      visualScene.value?.remove(rotationPivotSphere);
      visualScene.value?.remove(rotationPivot2Sphere);
      visualScene.value?.remove(intersectionSphere);
      visualScene.value?.remove(arcFromInitial);
      visualScene.value?.remove(arcToFinal);
    } else {
      visualScene.value?.add(initialMarker);
      visualScene.value?.add(finalMarker);
      visualScene.value?.add(transitionSphere);
      visualScene.value?.add(rotationPivotSphere);
      visualScene.value?.add(intersectionSphere);
      visualScene.value?.add(arcFromInitial);
      if (doubleTurnPath) {
        visualScene.value?.add(rotationPivot2Sphere);
        visualScene.value?.add(arcToFinal);
        visualScene.value?.add(rotationPivot2Sphere);
      }
    }
  }
);

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
    const wheelScrollAmount =
      0.9 * lastMouseWheelScrollAmount + (0.1 * wheel) / 5;
    lastMouseWheelScrollAmount = wheel;
    if (activePose.value === "initial") {
      initialOrientation.value += wheelScrollAmount;
      initialOrientation.value = within360(initialOrientation.value);
      initialMarker.position.copy(pos);
      initialMarker.rotation.z = MathUtils.degToRad(initialOrientation.value);
      bodyPosition.value.set(pos.x, pos.y);
      bodyRotation.value = -initialMarker.rotation.z;
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

function rotateThenTranslate(
  initialPoint: any,
  finalPoint: any,
  line1: any,
  line2: any,
  bisector: any
): [any, number] {
  const iPerp = line1.Dot(initialPoint); // Perpendicular from initial point
  const pivotOfRot = bisector.Wedge(iPerp).Normalized; // intersect the perpendicular with the angle bisector
  const fPerp = line2.Dot(pivotOfRot); // perpendicular to final point
  const fPrior = fPerp.Wedge(line2); // intermediate point prior to the final point
  const turnRad = pivotOfRot.Vee(initialPoint).Length;

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
  // debugText.value += ` Start is ahead, rotate by ${rotateAmount.toFixed(
  //   1
  // )} then translate by ${transitionDistance.toFixed(2)}`;
  return [pivotOfRot, turnRad];
}

function translateThenRotate(
  initialPoint: any,
  finalPoint: any,
  line1: any,
  line2: any,
  bisector: any
): [any, number] {
  const fPerp = line2.Dot(finalPoint); // Perpendicular from the final point
  const pivot = bisector.Wedge(fPerp).Normalized; // intersect the perpendicular with the angle bisector
  const iPerp = line1.Dot(pivot); // Perpendicular to the initial point
  const iPost = iPerp.Wedge(line1); // intermediate point after the start point
  const turnRad = pivot.Normalized.Vee(finalPoint.Normalized).Length;
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
  return [pivot, turnRad];
}

function modifyTurningArc(arc: any, radius: number, arcLengthDegree: number) {
  arc.geometry.dispose();
  const geo = new TorusGeometry(
    radius,
    4,
    10,
    Math.ceil(arcLengthDegree / 5),
    (arcLengthDegree * Math.PI) / 180
  );
  arc.geometry = geo;
}

function doSingleTurn(
  initialPoint: any,
  finalPoint: any,
  line1: any,
  line2: any,
  startToIntersectionDistance: number,
  intersectionToFinalDistance: number
) {
  doubleTurnPath = false;
  // visualScene.value?.remove(rotationPivot2Sphere);
  // visualScene.value?.remove(transitionSphere2);
  visualScene.value?.remove(arcToFinal);

  let rotateAmount =
    startToIntersectionDistance < 0
      ? finalOrientation.value - initialOrientation.value
      : 360 - finalOrientation.value + initialOrientation.value;
  rotateAmount = within360(rotateAmount);
  // while (rotateAmount > 360) rotateAmount -= 360;
  // while (rotateAmount < 0) rotateAmount += 360;
  const bisector = line1.Normalized.Sub(line2.Normalized);
  debugText.value += " ONE TURN only---";
  let pivotOfRotation, radiusOfRotation;
  if (
    (rotateAmount < 180 &&
      Math.abs(startToIntersectionDistance) <
        Math.abs(intersectionToFinalDistance)) ||
    (rotateAmount > 180 &&
      Math.abs(startToIntersectionDistance) >
        Math.abs(intersectionToFinalDistance))
  ) {
    [pivotOfRotation, radiusOfRotation] = rotateThenTranslate(
      initialPoint,
      finalPoint,
      line1,
      line2,
      bisector
    );
  } else {
    [pivotOfRotation, radiusOfRotation] = translateThenRotate(
      initialPoint,
      finalPoint,
      line1,
      line2,
      bisector
    );
  }
  rotationPivotSphere.position.set(
    -pivotOfRotation.e02 / pivotOfRotation.e12,
    pivotOfRotation.e01 / pivotOfRotation.e12,
    0
  );
  arcFromInitial.position.copy(rotationPivotSphere.position);
  modifyTurningArc(arcFromInitial, radiusOfRotation, rotateAmount);
  if (startToIntersectionDistance > 0) {
    // lineup the arc with the final point
    arcFromInitial.rotation.z = MathUtils.degToRad(90 + finalOrientation.value);
  } else {
    // lineup the arc with the initial point
    arcFromInitial.rotation.z = MathUtils.degToRad(
      initialOrientation.value - 90
    );
  }
}

function doDoubleArc(
  initialPoint: any,
  finalPoint: any,
  line1: any,
  line2: any,
  startToIntersectionDistance: number,
  intersectionToFinalDistance: number
) {
  debugText.value += " DOUBLE ARCS";
  const startPerp = line1.Dot(initialPoint);
  const targetPerp = line2.Dot(finalPoint);
  const E = startPerp.Wedge(line2).Normalized;
  const P = line1.Wedge(line2).Normalized;
  const M = startPerp.Wedge(targetPerp).Normalized;
  const distanceEA = initialPoint.Vee(E).Length;
  const distanceEC = finalPoint.Vee(E).Length;
  const distanceEP = P.Vee(E).Length;
  if (distanceEC > distanceEP) {
    debugText.value += `Does not require double arc, use single turn`;
    return false;
  } else if (distanceEA < distanceEC) {
    debugText.value += " => OK";
    intersectionSphere.position.set(-P.e02 / P.e12, P.e01 / P.e12, 0);
    rotationPivotSphere.position.set(-E.e02 / E.e12, E.e01 / E.e12, 0);
    transitionSphere2.position.set(-M.e02 / M.e12, M.e01 / M.e12, 0);
    let lowAlpha = 0;
    let hiAlpha = 1;
    let alpha;
    let arcCenterFound = false;
    let count = 0;
    let H;
    while (lowAlpha < hiAlpha && !arcCenterFound && count < 100) {
      alpha = (lowAlpha + hiAlpha) / 2;
      H = PGA2D.Mul(1 - alpha, M).Add(PGA2D.Mul(alpha, finalPoint));
      const distanceHE = H.Vee(E).Length;
      const distanceHC = H.Vee(finalPoint).Length;
      console.debug(
        ` |HC| = ${distanceHC.toFixed(3)}, |EA| = ${distanceEA.toFixed(
          3
        )} Total:${(distanceHC + distanceEA).toFixed(
          3
        )} vs. |HE| = ${distanceHE.toFixed(3)}`
      );
      if (Math.abs(distanceHC + distanceEA - distanceHE) < 1e-5) {
        arcCenterFound = true;
        console.debug("Arc ctr found");
      } else if (distanceHE > distanceHC + distanceEA) {
        console.debug(
          `HC is too short, alpha ${alpha} needs to move away from target`
        );
        hiAlpha = alpha;
      } else {
        console.debug(
          `HC is too long, alpha ${alpha} needs to move closer to target`
        );
        lowAlpha = alpha;
      }
      count++;
    }
    rotationPivot2Sphere.position.set(-H.e02 / H.e12, H.e01 / H.e12, 0);
    return true;
  } else {
    debugText.value += `Start point can't catch up`;
    intersectionSphere.position.z = -100;
    rotationPivotSphere.position.z = -100;
    rotationPivot2Sphere.position.z = -100;
    transitionSphere2.position.z = -100;
    return false;
  }
}

function doDoubleTurn(
  initialPoint: any,
  finalPoint: any,
  line1: any,
  line2: any,
  startToIntersectionDistance: number,
  intersectionToFinalDistance: number
) {
  doubleTurnPath = true;
  let headingDiff = finalOrientation.value - initialOrientation.value;
  while (headingDiff > 180) headingDiff -= 360;
  while (headingDiff < -180) headingDiff += 360;
  const isDiverging = intersectionToFinalDistance * headingDiff < 0;
  let bisectorOrientation =
    (initialOrientation.value + finalOrientation.value) / 2;
  // Confirm that the bisector orientation is pointing in the same
  // direction as the initial and final orientations by computing
  // its DOT product.
  const ci = Math.cos(MathUtils.degToRad(initialOrientation.value));
  const si = Math.sin(MathUtils.degToRad(initialOrientation.value));
  const cf = Math.cos(MathUtils.degToRad(finalOrientation.value));
  const sf = Math.sin(MathUtils.degToRad(finalOrientation.value));
  const cb = Math.cos(MathUtils.degToRad(bisectorOrientation));
  const sb = Math.sin(MathUtils.degToRad(bisectorOrientation));
  if (ci * cb + si * sb < 0 || cf * cb + sf * sb < 0) {
    debugText.value += ` Flip bisector from ${bisectorOrientation}`;
    bisectorOrientation = (bisectorOrientation + 180) % 360;
    debugText.value += ` to ${bisectorOrientation}`;
  }
  // debugText.value += ` TWO TURNS, heading diff ${headingDiff.toFixed(
  //   2
  // )}, bisector orientation ${bisectorOrientation.toFixed(2)}`;
  visualScene.value?.add(rotationPivot2Sphere);
  visualScene.value?.add(transitionSphere2);
  visualScene.value?.add(arcToFinal);
  const bisectorCtr = line1.Normalized.Add(line2.Normalized); // main bisector
  const bisectorLeft = line1.Normalized.Add(bisectorCtr.Normalized);
  const bisectorRight = bisectorCtr.Normalized.Add(line2.Normalized);
  // The right rotation pivot and the incoming tangent are always determined by the final point
  // So we can compute them immediately
  const rightPivot = line2.Dot(finalPoint).Wedge(bisectorRight);
  const incomingTangentRight = bisectorCtr.Dot(rightPivot).Wedge(bisectorCtr);
  transitionSphere2.position.set(
    -incomingTangentRight.e02 / incomingTangentRight.e12,
    incomingTangentRight.e01 / incomingTangentRight.e12,
    0
  );
  rotationPivot2Sphere.position.set(
    -rightPivot.e02 / rightPivot.e12,
    rightPivot.e01 / rightPivot.e12,
    0
  );
  arcToFinal.position.set(
    -rightPivot.e02 / rightPivot.e12,
    rightPivot.e01 / rightPivot.e12,
    0
  );
  let outgoingRotationPivot, outgoingRotationRadius, outgoingRotationArcLength;
  if (
    (!isDiverging &&
      Math.abs(startToIntersectionDistance) <
        Math.abs(intersectionToFinalDistance)) ||
    (isDiverging &&
      Math.abs(startToIntersectionDistance) >
        Math.abs(intersectionToFinalDistance))
  ) {
    // relative to the intersection point, initial point is ahead of final point
    [outgoingRotationPivot, outgoingRotationRadius] = rotateThenTranslate(
      initialPoint,
      incomingTangentRight,
      line1,
      bisectorCtr,
      bisectorLeft
    );
    const ctr1 = bisectorCtr.Dot(outgoingRotationPivot).Wedge(bisectorCtr);
    transitionSphere.position.set(-ctr1.e02 / ctr1.e12, ctr1.e01 / ctr1.e12, 0);
    const transitionLength = incomingTangentRight.Normalized.Vee(
      ctr1.Normalized
    ).Length;
    transitionPipe.position.set(-ctr1.e02 / ctr1.e12, ctr1.e01 / ctr1.e12, 0);
    transitionPipe.rotation.z = MathUtils.degToRad(bisectorOrientation + 90);
    transitionPipe.translateY(transitionLength / 2);
    transitionPipe.scale.y = transitionLength;
  } else {
    // start is farther from intersection
    [outgoingRotationPivot, outgoingRotationRadius] = translateThenRotate(
      initialPoint,
      incomingTangentRight,
      line1,
      bisectorCtr,
      bisectorLeft
    );
  }
  arcFromInitial.position.set(
    -outgoingRotationPivot.e02 / outgoingRotationPivot.e12,
    outgoingRotationPivot.e01 / outgoingRotationPivot.e12,
    0
  );
  arcFromInitial.rotation.z =
    startToIntersectionDistance < 0
      ? -MathUtils.degToRad(90 - bisectorOrientation)
      : MathUtils.degToRad(initialOrientation.value - 90);
  outgoingRotationArcLength =
    startToIntersectionDistance < 0
      ? 180 - bisectorOrientation + initialOrientation.value
      : 180 + bisectorOrientation - initialOrientation.value;

  while (outgoingRotationArcLength < 0) outgoingRotationArcLength += 360;
  while (outgoingRotationArcLength > 360) outgoingRotationArcLength -= 360;
  modifyTurningArc(
    arcFromInitial,
    outgoingRotationRadius,
    outgoingRotationArcLength
  );
  rotationPivotSphere.position.set(
    -outgoingRotationPivot.e02 / outgoingRotationPivot.e12,
    outgoingRotationPivot.e01 / outgoingRotationPivot.e12,
    0
  );
  const incomingRotationRadius = rightPivot.Normalized.Vee(
    finalPoint.Normalized
  ).Length;
  let incomingRotationArcLength =
    intersectionToFinalDistance > 0
      ? finalOrientation.value - bisectorOrientation + 180
      : bisectorOrientation - finalOrientation.value + 180;

  while (incomingRotationArcLength < 0) incomingRotationArcLength += 360;
  while (incomingRotationArcLength > 360) incomingRotationArcLength -= 360;

  modifyTurningArc(
    arcToFinal,
    incomingRotationRadius,
    incomingRotationArcLength
  );
  arcToFinal.rotation.z =
    intersectionToFinalDistance > 0
      ? MathUtils.degToRad(90 + bisectorOrientation)
      : MathUtils.degToRad(90 + finalOrientation.value);
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

  // pathDistance.value = initialPoint.Vee(finalPoint).Length;
  if (Math.abs(intersection.e12) > 1e-5) {
    intersectionSphere.position.set(
      -intersection.e02 / intersection.e12,
      intersection.e01 / intersection.e12,
      0
    );
    const initialToIntersection = initialPoint.Vee(intersection);
    const intersectionToFinal = intersection.Vee(finalPoint);
    const i2xDistance = initialToIntersection.Dot(initialDirection).e0;
    let x2fDistance = intersectionToFinal.Dot(finalDirection).e0;
    // const s2 = makeSphere(5, "cyan");
    // s2.position.set(-finalPoint.e02, finalPoint.e01, 0);
    // visualScene.value?.add(s2);
    debugText.value =
      ` I2X dist: ${i2xDistance.toFixed(2)}` +
      ` X2F dist: ${x2fDistance.toFixed(2)}`;
    if (i2xDistance * x2fDistance > 0) {
      doSingleTurn(
        initialPoint,
        finalPoint,
        line1,
        line2,
        i2xDistance,
        x2fDistance
      );
    } else {
      if (
        doDoubleArc(
          initialPoint,
          finalPoint,
          line1,
          line2,
          i2xDistance,
          x2fDistance
        ) === false
      ) {
        doDoubleTurn(
          initialPoint,
          finalPoint,
          line1,
          line2,
          i2xDistance,
          x2fDistance
        );
      }
    }
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
