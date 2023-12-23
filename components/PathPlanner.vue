<template>
  <div id="floor-map">
    <div class="text-h5">Path Planner</div>
    <!-- <p>While holding the <v-icon>mdi-apple-keyboard-shift</v-icon> key</p> -->
    <ul>
      <li>Move the mouse to change position</li>
      <li>Scroll the mouse wheel to change orientation</li>
      <li>
        Hold the Shift-key (<v-icon>mdi-apple-keyboard-shift</v-icon>) to alter
        the initial pose
      </li>
      <li>
        Hold the Alt-Key (<v-icon>mdi-apple-keyboard-option</v-icon>) to alter
        the final pose
      </li>
    </ul>
    <v-switch v-model="useDoubleArcs" label="Use Double Arcs"></v-switch>
    <v-switch v-model="useSharperTurns" :disabled="!useDoubleArcs" label="Use Sharper Turns"></v-switch>
    <!--div>
      <v-btn
        @click="findBikePath"
        color="green"
        :disabled="!initialMarkerShown || !finalMarkerShown"
        >Find Path</v-btn
      >
    </!--div-->
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
import { useKeyModifier } from "@vueuse/core";
const controlKey = useKeyModifier("Control", { events: ["mousemove"] });
const altKey = useKeyModifier("Alt", { events: ["mousemove"] });

const { makePoint, makeDirection } = usePGA2D();
const MARKER_LENGTH = 50;
const PATH_THICKNESS = 2.5
const store = usePGAStore();
const visualStore = useVisualStore();
const PGA2D = Algebra({ p: 2, q: 0, r: 1, graded: false });
const { runMode, bodyPosition, bodyRotation } = storeToRefs(store);
const { makeArrow, makeSphere, makePipe, makeArc } = visualStore;
const { visualScene, mousePositionOnGround, mouseWheelScrollAmount } =
  storeToRefs(visualStore);
const debugText = ref("N/A");
const initialOrientation = ref(0);
const finalOrientation = ref(0);
const useDoubleArcs = ref(false);
const useSharperTurns = ref(false);
const initialMarker = makeArrow(MARKER_LENGTH * 1.7, 4, "green");
const finalMarker = makeArrow(MARKER_LENGTH, 4, "red");
const initialMarkerShown = ref(false);
const finalMarkerShown = ref(false);
const intersectionSphere = makeSphere(5, "blue");
const rotationPivotSphere = makeSphere(5, "yellow");
const rotationPivot2Sphere = makeSphere(5, "yellow");
const transitionSphere = makeSphere(8, "green");
const transitionSphere2 = makeSphere(8, "white");
const transitionPipe = makePipe(1, PATH_THICKNESS, "white");
const arcFromInitial = makeArc(1, PATH_THICKNESS, 90, "white");
const arcToFinal = makeArc(1, PATH_THICKNESS, 90, "white");
let doubleTurnPath = false;

onMounted(() => {
  visualScene.value?.add(initialMarker);
  visualScene.value?.add(finalMarker);
  visualScene.value?.add(arcFromInitial);
  visualScene.value?.add(arcToFinal);
  visualScene.value?.add(intersectionSphere);
  visualScene.value?.add(rotationPivot2Sphere);
  visualScene.value?.add(rotationPivotSphere);
  visualScene.value?.add(transitionPipe);
  visualScene.value?.add(transitionSphere);
  visualScene.value?.add(transitionSphere2);
  initialMarker.position.z = -100;
  finalMarker.position.z = -100;
  intersectionSphere.position.z = -100;
  rotationPivotSphere.position.z = -100;
  transitionSphere.position.z = -100;
  transitionPipe.position.z = -100;
  arcFromInitial.position.z = -100;
  rotationPivot2Sphere.position.z = -100;
  transitionSphere2.position.z = -100;
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
      visualScene.value?.add(arcFromInitial);
      visualScene.value?.add(arcToFinal);
      visualScene.value?.add(finalMarker);
      visualScene.value?.add(initialMarker);
      visualScene.value?.add(intersectionSphere);
      visualScene.value?.add(rotationPivot2Sphere);
      visualScene.value?.add(rotationPivot2Sphere);
      visualScene.value?.add(rotationPivotSphere);
      visualScene.value?.add(transitionSphere);
      visualScene.value?.add(transitionSphere2);
    }
  }
);

function withinPlusMinus180(x: number): number {
  while (x > 180) x -= 360;
  while (x < -180) x += 360;
  return x;
}

function within360(x: number) {
  while (x > 360) x -= 360;
  while (x < 0) x += 360;
  return x;
}

let lastMouseWheelScrollAmount = 0;
watch(
  [() => mousePositionOnGround.value, () => mouseWheelScrollAmount.value],
  ([pos, wheel]: [Vector3, number]) => {
    const wheelScrollAmount =
      0.9 * lastMouseWheelScrollAmount + (0.1 * wheel) / 5;
    // console.debug(
    //   `"Mouse at (${pos.x.toFixed(1)},${pos.y.toFixed(
    //     1
    //   )}) wheel ${wheelScrollAmount} Ctrl:${controlKey.value} Alt:${
    //     altKey.value
    //   }`
    // );
    lastMouseWheelScrollAmount = wheel;
    if (controlKey.value) {
      initialMarkerShown.value = true;
      initialOrientation.value += wheelScrollAmount;
      initialOrientation.value = within360(initialOrientation.value);
      initialMarker.position.copy(pos);
      initialMarker.rotation.z = MathUtils.degToRad(initialOrientation.value);
      bodyPosition.value.set(pos.x, pos.y);
      bodyRotation.value = -initialMarker.rotation.z;
    } else if (altKey.value) {
      finalMarkerShown.value = true;
      finalOrientation.value += wheelScrollAmount;
      finalOrientation.value = within360(finalOrientation.value);
      finalMarker.position.copy(pos);
      finalMarker.rotation.z = MathUtils.degToRad(finalOrientation.value);
    }
    if (initialMarkerShown.value && finalMarkerShown.value) {
      findBikePath();
    }
  },
  { deep: true }
);

function parseLine(text: string, L: any): string {
  return `${text}: ${L.e1.toFixed(2)}X ${L.e2.toFixed(2)}Y + ${L.e0.toFixed(
    2
  )}`;
}
function parsePoint(text: string, P: any): string {
  return `${text}: (${-P.e02.toFixed(2)},${P.e01.toFixed(2)} Scale = ${
    P.e12
  }})`;
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
    PATH_THICKNESS,
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
  rotationPivot2Sphere.position.z = -100;
  transitionSphere2.position.z = -100;
  arcToFinal.position.z = -100;
  arcFromInitial.position.z = -100;

  let rotateAmount =
    startToIntersectionDistance < 0
      ? finalOrientation.value - initialOrientation.value
      : 360 - finalOrientation.value + initialOrientation.value;
  rotateAmount = within360(rotateAmount);
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
  const startPerp = line1.Dot(initialPoint);
  const targetPerp = line2.Dot(finalPoint);
  let E = startPerp.Wedge(line2).Normalized;
  const P = line1.Wedge(line2).Normalized;
  let outgoingRadius = initialPoint.Vee(E).Length;
  let distanceEC = finalPoint.Vee(E).Length;
  const distanceEP = P.Vee(E).Length;
  const headingDiff = withinPlusMinus180(
    finalOrientation.value - initialOrientation.value
  );

  const isConverging = startToIntersectionDistance * headingDiff < 0;
  debugText.value +=
    (isConverging ? " converging" : " diverging") +
    ` EA:${outgoingRadius.toFixed(2)} EC:${distanceEC.toFixed(
      2
    )} EP:${distanceEP.toFixed(2)} `;
  if (isConverging && distanceEC > distanceEP) {
    // target point is ahead of the heading intersection
    debugText.value += `Does not require double arc, use single turn`;
    return false;
  }
  /* Four cases:
    startToIntersectionDist   headingDiff
           > 0                   > 0      diverging L-to-R
           > 0                   < 0      converging L-to-R
           < 0                   > 0      converging R-to-L
           < 0                   < 0      diverging R-to-L
  */

  if (
    (isConverging &&
      Math.abs(intersectionToFinalDistance) >
        Math.abs(startToIntersectionDistance)) ||
    (!isConverging &&
      Math.abs(intersectionToFinalDistance) <
        Math.abs(startToIntersectionDistance))
  ) {
    // target is way behind the start point
    intersectionSphere.position.z = -100;
    rotationPivotSphere.position.z = -100;
    rotationPivot2Sphere.position.z = -100;
    transitionSphere2.position.z = -100;
    return false;
  }

  let modifiedOutgoingArcCenter = false;
  if (distanceEC < outgoingRadius) {
    // Target is inside the outgoing circle,
    // We will attempt to move the center of the circle
    if (useSharperTurns.value) {
      if (E.e12 < 0) {
        modifiedOutgoingArcCenter = true;
        E.e01 /= E.e12;
        E.e02 /= E.e12;
        E.e12 = 1;
      }
      let newE;
      let fractionDenom = 2;
      while (distanceEC < outgoingRadius && fractionDenom < 50) {
        // target is inside the outgoing circle, try to move the center of the outgoing
        // circle closer to target
        newE = PGA2D.Mul(1 / fractionDenom, E).Add(
          PGA2D.Mul(1 - 1 / fractionDenom, initialPoint)
        );
        fractionDenom++;
        distanceEC = finalPoint.Vee(newE).Length;
        outgoingRadius = initialPoint.Vee(newE).Length;
      }
      if (fractionDenom < 50) {
        debugText.value += ` MODIFIED outgoing arc center`;
        // Attempt to move the center of outgoing arc
        rotationPivotSphere.position.set(-E.e02 / E.e12, E.e01 / E.e12, 0);
        rotationPivot2Sphere.position.set(-newE.e02, newE.e01, 0);

        E = newE;
      } else {
        debugText.value += ` Failed attempt to use sharper arcs`;
        return false;
      }
    }
    else {
      console.debug("Target is too close to shart, and sharper turns are not allowed")
      debugText.value += ` Cannot use double arc`;
      return false;
    }
  }

  // console.debug("Attempt to move E halfway ", parsePoint("start", initialPoint),
  //   parsePoint("Old E", E), parsePoint(" to new E", newE))
  // E = newE
  // debugText.value += parsePoint(" to new  E", E);

  // if (distanceEC < outgoingRadius) {
  // }

  debugText.value += `" DOUBLE ARCS with headingDiff ${headingDiff.toFixed(2)}`;
  let isLeftRightArcs = startToIntersectionDistance > 0;
  let M = isConverging ? startPerp.Wedge(targetPerp) : line1.Wedge(targetPerp);
  M = M.Normalized;
  if (M.e12 < 0) {
    M.e01 /= M.e12;
    M.e02 /= M.e12;
    M.e12 = 1;
  }

  debugText.value +=
    " => OK" + (isLeftRightArcs ? " Left-To-Right" : " Right-To-Left");

  intersectionSphere.position.set(-P.e02 / P.e12, P.e01 / P.e12, 0);
  rotationPivotSphere.position.set(-E.e02 / E.e12, E.e01 / E.e12, 0);
  transitionSphere2.position.set(-M.e02 / M.e12, M.e01 / M.e12, 0);
  let lowAlpha = 0;
  let hiAlpha = 1;
  let alpha;
  let arcCenterFound = false;
  let count = 0;
  let H;
  let distanceHC = 0;
  // if (leftToRightArcs) {
  //   const alpha = 0.3
  //   H = PGA2D.Mul(1 - alpha, M).Add(PGA2D.Mul(alpha, finalPoint));
  //   debugText.value += parsePoint("M at", M)
  // } else {
  if (modifiedOutgoingArcCenter) {
    E.e01 *= -1;
    E.e02 *= -1;
    E.e12 *= -1;
  }
  while (lowAlpha < hiAlpha && !arcCenterFound && count < 100) {
    alpha = (lowAlpha + hiAlpha) / 2;
    H = PGA2D.Mul(1 - alpha, M).Add(PGA2D.Mul(alpha, finalPoint));
    const distanceHE = H.Vee(E).Length;
    distanceHC = H.Vee(finalPoint).Length;

    // console.debug(
    //   ` |HC| = ${distanceHC.toFixed(3)}, |EA| = ${outgoingRadius.toFixed(
    //     3
    //   )} Total:${(distanceHC + outgoingRadius).toFixed(
    //     3
    //   )} vs. |HE| = ${distanceHE.toFixed(3)}`
    // );
    // debugger
    if (Math.abs(distanceHC + outgoingRadius - distanceHE) < 1e-3) {
      arcCenterFound = true;
    } else if (distanceHE > distanceHC + outgoingRadius) {
      // if (isLeftRightArcs)
      //   console.debug(
      //     `HC is too short, alpha ${alpha} needs to move away from target`
      //   );
      hiAlpha = alpha;
    } else {
      // if (isLeftRightArcs)
      //   console.debug(
      //     `HC is too long, alpha ${alpha} needs to move closer to target`
      //   );
      lowAlpha = alpha;
    }
    count++;
  }
  if (arcCenterFound) {
    const lineHE = H.Vee(E);
    const oArcLenDeg = MathUtils.radToDeg(
      Math.acos(lineHE.Normalized.Dot(startPerp.Normalized))
    );
    const outgoingArcLength = isLeftRightArcs ? 180 - oArcLenDeg : oArcLenDeg;
    const iArcLenDeg = MathUtils.radToDeg(
      Math.acos(lineHE.Normalized.Dot(targetPerp.Normalized))
    );
    const incomingArcLength = isLeftRightArcs ? 180 - iArcLenDeg : iArcLenDeg;
    debugText.value += ` outgoing arc ${outgoingArcLength.toFixed(
      1
    )} incoming arc length ${incomingArcLength.toFixed(1)}`;
    rotationPivot2Sphere.position.set(-H.e02 / H.e12, H.e01 / H.e12, 0);
    transitionPipe.position.z = -100;
    transitionSphere.position.z = -100;
    arcFromInitial.position.set(-E.e02 / E.e12, E.e01 / E.e12, 0);
    arcFromInitial.rotation.z =
      startToIntersectionDistance < 0
        ? MathUtils.degToRad(90 - outgoingArcLength + initialOrientation.value)
        : MathUtils.degToRad(initialOrientation.value - 90);
    modifyTurningArc(arcFromInitial, outgoingRadius, outgoingArcLength);
    arcToFinal.position.set(-H.e02 / H.e12, H.e01 / H.e12, 0);
    arcToFinal.rotation.z =
      intersectionToFinalDistance > 0
        ? MathUtils.degToRad(-incomingArcLength + finalOrientation.value - 90)
        : MathUtils.degToRad(90 + finalOrientation.value);
    // visualScene.value?.add(arcToFinal);
    modifyTurningArc(arcToFinal, distanceHC, incomingArcLength);
  } else {
    debugText.value += " cannot find incoming arc";
    arcFromInitial.position.z = -100;
    arcToFinal.position.z = -100;
    return false;
  }
  return true;
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
  const headingDiff = withinPlusMinus180(
    finalOrientation.value - initialOrientation.value
  );
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
    debugText.value += ` Flip bisector from ${bisectorOrientation.toFixed(2)}`;
    bisectorOrientation = (bisectorOrientation + 180) % 360;
    debugText.value += ` to ${bisectorOrientation.toFixed(2)}`;
  }
  // debugText.value += ` TWO TURNS, heading diff ${headingDiff.toFixed(
  //   2
  // )}, bisector orientation ${bisectorOrientation.toFixed(2)}`;
  // visualScene.value?.add(rotationPivot2Sphere);
  // visualScene.value?.add(transitionSphere2);
  // visualScene.value?.add(arcToFinal);
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
  outgoingRotationArcLength = within360(
    startToIntersectionDistance < 0
      ? 180 - bisectorOrientation + initialOrientation.value
      : 180 + bisectorOrientation - initialOrientation.value
  );

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

  incomingRotationArcLength = within360(incomingRotationArcLength);

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
  if (Math.abs(intersection.e12) < 1e-5) {
    console.debug("Parallel line");
    debugText.value = "Parallel lines";
    return;
  }
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
    console.debug("Mozzi-Chasles Single Turn");
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
      useDoubleArcs.value &&
      doDoubleArc(
        initialPoint,
        finalPoint,
        line1,
        line2,
        i2xDistance,
        x2fDistance
      )
    ) {
      // If double arc is allowed and the path can be solved using double
      // arc, then we are done
      return;
    } else {
      // We will be here when either double arcs is not allowed,
      // or attempt to use double arcs failed
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
