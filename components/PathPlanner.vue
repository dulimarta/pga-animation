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
    <div style="display: flex">
      <v-switch v-model="useDoubleArcs" label="Use Double Arcs"></v-switch>
      <v-switch
        v-model="useSharperTurns"
        :disabled="!useDoubleArcs"
        label="Use Sharper Turns"
      ></v-switch>
    </div>

    <div v-if="paths.length > 0">
      <v-radio-group label="Path segments" v-model="selectedPath">
        <v-radio
          class="path-segment"
          v-for="(p, idx) in paths"
          :label="parsePath(p)"
          :value="idx"
          :key="idx"
        ></v-radio>
      </v-radio-group>
      <!--v-slider-- v-model="tValue" min="0" max="1" step="0.01" @update:model-value="tValueChanged"></!--v-slider-->
    </div>
    <v-btn
      :disabled="
        parallelWarning ||
        !initialMarkerShown ||
        !finalMarkerShown ||
        paths.length === 0
      "
      @click="executePlan"
      >Execute</v-btn
    >
    <v-btn class="ml-2" :disabled="paths.length === 0" @click="resetExecutor"
      >Restart</v-btn
    >
    <v-textarea label="Debugging output" v-model="debugText"></v-textarea>
    <!-- Snackbar timeout:-1 to keep it shown indefinitely -->
    <ul>
      <li>Initial Orientation: {{ initialOrientation }}</li>
      <li>Final Orientation: {{ finalOrientation }}</li>
    </ul>
    <v-snackbar
      v-model="parallelWarning"
      :timeout="-1"
      location="top"
      color="red-accent-4"
      >Start and target orientations are parallel</v-snackbar
    >
  </div>
</template>
<script setup lang="ts">
import type {
  PathSegment,
  RotationPath,
  TranslationPath
} from "@/store/planner"
  import {usePGAStore} from "~/store/pga-store";
import { storeToRefs } from "pinia";
import { MathUtils, Mesh, TorusGeometry, Vector3 } from "three";
import { useVisualComposable } from "~/composables/visual-factory";
import Algebra from "ganja.js";
import { useKeyModifier } from "@vueuse/core";
import type { GAElement } from "~/composables/pga";
import { useVisualStore } from "~/store/ui"
import { usePlannerStore } from "~/store/planner";
const controlKey = useKeyModifier("Control", { events: ["mousemove"] });
const altKey = useKeyModifier("Alt", { events: ["mousemove"] });

const {
  makePoint: make2DPoint,
  makeDirection: make2DDirection,
  parsePGAPoint: dump2DPoint,
  lineSlopeInRadian,
} = usePGA2D();
const {
  makeDirection: make3DDirection,
  makeScalar,
  parsePGAMotor,
  makePoint: make3DPoint,
  lerp,
  sandwich,
} = usePGA3D();
const MARKER_LENGTH = 50;
const PATH_THICKNESS = 2.5;
const store = usePGAStore(); 
const PGA2D = Algebra({ p: 2, q: 0, r: 1, graded: false });
const PGA3D = Algebra({ p: 3, q: 0, r: 1, graded: false });
const { bodyPosition, bodyRotation, bodyMotor, rearHub } =
  storeToRefs(store);
const plannerStore = usePlannerStore()
const { paths, selectedPath} = storeToRefs(plannerStore)

const { makeArrow, makeSphere, makePipe, makeArc } = useVisualComposable();
const visualStore = useVisualStore()
const { visualScene, mousePositionOnGround, mouseWheelScrollAmount, runMode } =
  storeToRefs(visualStore);
const debugText = ref("N/A");
const initialOrientation = ref(0);
const finalOrientation = ref(0);
const useDoubleArcs = ref(true);
const useSharperTurns = ref(true);
const tValue = ref(0);
const parallelWarning = ref(false);
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

// watch(
//   () => runMode.value,
//   (mode: "plan" | "manual-control" | "autonomous") => {
//     if (mode === "manual-control") {
//       // visualScene.value?.remove(initialMarker);
//       // visualScene.value?.remove(finalMarker);
//       // visualScene.value?.remove(transitionSphere);
//       // visualScene.value?.remove(rotationPivotSphere);
//       // visualScene.value?.remove(rotationPivot2Sphere);
//       // visualScene.value?.remove(intersectionSphere);
//       // visualScene.value?.remove(arcFromInitial);
//       // visualScene.value?.remove(arcToFinal);
//     } else {
//       // visualScene.value?.add(arcFromInitial);
//       // visualScene.value?.add(arcToFinal);
//       // visualScene.value?.add(finalMarker);
//       // visualScene.value?.add(initialMarker);
//       // visualScene.value?.add(intersectionSphere);
//       // visualScene.value?.add(rotationPivot2Sphere);
//       // visualScene.value?.add(rotationPivot2Sphere);
//       // visualScene.value?.add(rotationPivotSphere);
//       // visualScene.value?.add(transitionSphere);
//       // visualScene.value?.add(transitionSphere2);
//       // initialMarker.rotation.z = -bodyRotation.value;
//     }
//   }
// );

watch(
  [() => useDoubleArcs.value, () => useSharperTurns.value],
  ([doubleArc, sharperTurn]: [boolean, boolean]) => {
    findBikePath();
  }
);

watch(selectedPath, (sel: number) => {
  console.debug(`Selected path changed to ${sel}`)
  const sx = paths.value[sel].startX;
  const sy = paths.value[sel].startY;
  tValue.value = 0;
  bodyPosition.value.x = sx;
  bodyPosition.value.y = sy;
  bodyRotation.value = -paths.value[sel].startHeading;
  rearHub.value = make3DPoint(sx, sy, 0);
  plannerStore.selectActivePath(sel);
});

let lastMouseWheelScrollAmount = 0;
watch(
  [() => mousePositionOnGround.value, () => mouseWheelScrollAmount.value],
  ([pos, wheel]: [Vector3, number]) => {
    const wheelScrollAmount =
      0.9 * lastMouseWheelScrollAmount + (0.1 * wheel) / 5;
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

function parsePath(p: PathSegment): string {
  const commonText =
    `${p.kind} Start (${p.startX.toFixed(2)},${p.startY.toFixed(2)})` +
    ` Heading:${within360(MathUtils.radToDeg(p.startHeading)).toFixed(2)} deg`;
  let specificText = "";
  if (p.kind === "Trans") {
    const t = p as TranslationPath;
    specificText = `D=${t.distance.toFixed(2)}`;
  } else if (p.kind === "Rot") {
    const r = p as RotationPath;
    specificText = `Center:(${r.centerX.toFixed(2)},${r.centerY.toFixed(
      2
    )}) Radius:${r.radius.toFixed(2)} Arc Angle:${r.arcAngleDegree.toFixed(
      2
    )} deg`;
  } else {
    return (
      `Final at (${p.startX.toFixed(2)},${p.startY.toFixed(2)})` +
      ` Heading:${within360(MathUtils.radToDeg(p.startHeading)).toFixed(2)} deg`
    );
  }
  return commonText + " " + specificText;
}

function rotateThenTranslate(
  initialPoint: GAElement,
  finalPoint: GAElement,
  line1: GAElement,
  line2: GAElement,
  bisector: GAElement
): [GAElement, number, [number, number], number] {
  // Use subarray in return to avoid confusion of so many numbers

  const iPerp = line1.Dot(initialPoint); // Perpendicular from initial point
  const pivotOfRot = bisector.Wedge(iPerp).Normalized; // intersect the perpendicular with the angle bisector
  const fPerp = line2.Dot(pivotOfRot); // perpendicular to final point
  const fPrior = fPerp.Wedge(line2); // intermediate point prior to the final point
  const turnRad = pivotOfRot.Vee(initialPoint).Length;

  const tangentX = -fPrior.e02 / fPrior.e12;
  const tangentY = fPrior.e01 / fPrior.e12;
  transitionSphere.position.set(tangentX, tangentY, 0);
  const translationDistance = fPrior.Normalized.Vee(
    finalPoint.Normalized
  ).Length;
  transitionPipe.position.set(tangentX, tangentY, 0);
  transitionPipe.rotation.z = MathUtils.degToRad(finalOrientation.value - 90);
  transitionPipe.translateY(translationDistance / 2);
  transitionPipe.scale.y = translationDistance;
  // The tangent point is also the end point of the arc
  return [pivotOfRot, turnRad, [tangentX, tangentY], translationDistance];
}

function translateThenRotate(
  initialPoint: GAElement,
  finalPoint: GAElement,
  initialLine: GAElement,
  finalLine: GAElement,
  bisector: GAElement
): [number, [number, number], GAElement, number] {
  // Use subarray in return to avoid confusion of so many numbers
  const fPerp = finalLine.Dot(finalPoint); // Perpendicular from the final point
  const pivot = bisector.Wedge(fPerp).Normalized; // intersect the perpendicular with the angle bisector
  const iPerp = initialLine.Dot(pivot); // Perpendicular to the initial point
  const iPost = iPerp.Wedge(initialLine); // intermediate point after the start point
  const turnRad = pivot.Normalized.Vee(finalPoint.Normalized).Length;
  const tangentX = -iPost.e02 / iPost.e12;
  const tangentY = iPost.e01 / iPost.e12;
  transitionSphere.position.set(tangentX, tangentY, 0);
  const translationDistance = initialPoint.Normalized.Vee(
    iPost.Normalized
  ).Length;
  transitionPipe.position.set(-iPost.e02 / iPost.e12, iPost.e01 / iPost.e12, 0);
  transitionPipe.rotation.z = MathUtils.degToRad(initialOrientation.value + 90);
  transitionPipe.translateY((translationDistance - MARKER_LENGTH) / 2);
  transitionPipe.scale.y = translationDistance - MARKER_LENGTH;

  // The tangent point is also the starting point of the arc
  return [translationDistance, [tangentX, tangentY], pivot, turnRad];
}

function modifyArc(arc: Mesh, radius: number, arcAngleDegree: number) {
  arc.geometry.dispose();
  const geo = new TorusGeometry(
    radius,
    PATH_THICKNESS,
    10,
    Math.ceil(arcAngleDegree / 5),
    (arcAngleDegree * Math.PI) / 180
  );
  arc.geometry = geo;
}

function doSingleTurn(
  initialPoint: GAElement,
  finalPoint: GAElement,
  initialLine: GAElement,
  finalLine: GAElement,
  startToIntersectionDistance: number,
  intersectionToFinalDistance: number
) {
  rotationPivot2Sphere.position.z = -100;
  transitionSphere2.position.z = -100;
  arcToFinal.position.z = -100;
  arcFromInitial.position.z = -100;

  let rotateAmount =
    startToIntersectionDistance < 0
      ? finalOrientation.value - initialOrientation.value
      : 360 - finalOrientation.value + initialOrientation.value;
  rotateAmount = within360(rotateAmount);
  const isCCW = startToIntersectionDistance < 0;
  let isRotateThenTranslate = false;
  const bisector = initialLine.Normalized.Sub(finalLine.Normalized);
  debugText.value += " ONE TURN only---";
  let pivotOfRotation: GAElement,
    radiusOfRotation: number,
    translateDistance: number,
    tangentX: number,
    tangentY: number;
  if (
    (rotateAmount < 180 &&
      Math.abs(startToIntersectionDistance) <
        Math.abs(intersectionToFinalDistance)) ||
    (rotateAmount > 180 &&
      Math.abs(startToIntersectionDistance) >
        Math.abs(intersectionToFinalDistance))
  ) {
    [
      pivotOfRotation,
      radiusOfRotation,
      [tangentX, tangentY],
      translateDistance,
    ] = rotateThenTranslate(
      initialPoint,
      finalPoint,
      initialLine,
      finalLine,
      bisector
    );
    isRotateThenTranslate = true;
  } else {
    [
      translateDistance,
      [tangentX, tangentY],
      pivotOfRotation,
      radiusOfRotation,
    ] = translateThenRotate(
      initialPoint,
      finalPoint,
      initialLine,
      finalLine,
      bisector
    );
    isRotateThenTranslate = false;
  }
  const pivotX = -pivotOfRotation.e02 / pivotOfRotation.e12;
  const pivotY = pivotOfRotation.e01 / pivotOfRotation.e12;
  const startX = -initialPoint.e02 / initialPoint.e12;
  const startY = initialPoint.e01 / initialPoint.e12;
  const tDist = Math.sqrt(
    Math.pow(startX - tangentX, 2) + Math.pow(startY - tangentY, 2)
  );
  console.debug(
    `translateThenRotate distance ${tDist.toFixed(
      2
    )} ${translateDistance.toFixed(2)}`
  );
  const rotationSegment: RotationPath = {
    kind: "Rot",
    centerX: pivotX,
    centerY: pivotY,
    arcAngleDegree: isCCW ? rotateAmount : -rotateAmount,
    radius: radiusOfRotation,
    startX: NaN,
    startY: NaN,
    startHeading: NaN,
  };
  if (isRotateThenTranslate) {
    rotationSegment.startX = startX;
    rotationSegment.startY = startY;
    rotationSegment.startHeading = MathUtils.degToRad(initialOrientation.value);
    paths.value.push(rotationSegment, {
      kind: "Trans",
      distance: translateDistance,
      startX: tangentX,
      startY: tangentY,
      startHeading: MathUtils.degToRad(finalOrientation.value),
    });
  } else {
    rotationSegment.startX = tangentX;
    rotationSegment.startY = tangentY;
    rotationSegment.startHeading = MathUtils.degToRad(initialOrientation.value);
    paths.value.push(
      {
        kind: "Trans",
        distance: translateDistance,
        startX,
        startY,
        startHeading: MathUtils.degToRad(initialOrientation.value),
      },
      rotationSegment
    );
  }
  rotationPivotSphere.position.set(pivotX, pivotY, 0);
  arcFromInitial.position.copy(rotationPivotSphere.position);
  modifyArc(arcFromInitial, radiusOfRotation, rotateAmount);
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
  initialPoint: GAElement,
  finalPoint: GAElement,
  initLine: GAElement,
  finalLine: GAElement,
  startToIntersectionDistance: number,
  intersectionToFinalDistance: number
) {
  const startPerp = initLine.Dot(initialPoint);
  const targetPerp = finalLine.Dot(finalPoint);
  let outCenter = startPerp.Wedge(finalLine).Normalized;
  const headingIntersect = initLine.Wedge(finalLine).Normalized;
  let outgoingRadius = initialPoint.Vee(outCenter).Length;
  let distanceEC = finalPoint.Vee(outCenter).Length;
  const distanceEP = headingIntersect.Vee(outCenter).Length;
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
  // console.debug(
  //   `doDoubleArc() |EC|=${distanceEC.toFixed(
  //     2
  //   )}, out going radius ${outgoingRadius}`
  // );
  if (distanceEC < outgoingRadius) {
    // Target is inside the outgoing circle,
    // We will attempt to move the center of the circle
    // closer to the start point (i.e. sharper outgoing radius)
    if (useSharperTurns.value) {
      if (outCenter.e12 < 0) {
        modifiedOutgoingArcCenter = true;
        outCenter.e01 /= outCenter.e12;
        outCenter.e02 /= outCenter.e12;
        outCenter.e12 = 1;
      }
      // Attempt to relocate the outgoing arc center to a barycenter using
      // fractional proportions 1/2, 1/3, 1/4, ..., 1/50
      let newOutCenter: GAElement = make2DPoint(0, 0);
      let fractionDenom = 2;
      const MAX_FRACTION = 50;
      while (distanceEC < outgoingRadius && fractionDenom < MAX_FRACTION) {
        // target is inside the outgoing circle, try to move the center of the outgoing
        // circle closer to target
        newOutCenter = PGA2D.Mul(1 / fractionDenom, outCenter).Add(
          PGA2D.Mul(1 - 1 / fractionDenom, initialPoint)
        );
        fractionDenom++;
        distanceEC = finalPoint.Vee(newOutCenter).Length;
        outgoingRadius = initialPoint.Vee(newOutCenter).Length;
      }
      if (fractionDenom < MAX_FRACTION) {
        debugText.value += ` MODIFIED outgoing arc center`;
        // Attempt to move the center of outgoing arc
        rotationPivotSphere.position.set(
          -outCenter.e02 / outCenter.e12,
          outCenter.e01 / outCenter.e12,
          0
        );
        rotationPivot2Sphere.position.set(
          -newOutCenter.e02,
          newOutCenter.e01,
          0
        );

        outCenter = newOutCenter;
        // DO NOT RETURN HERE, we need to continue below
      } else {
        debugText.value += ` Failed attempt to use sharper arcs after ${MAX_FRACTION} attempts`;
        return false;
      }
    } else {
      console.debug(
        "Target is too close to start, and sharper turns are not allowed"
      );
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

  debugText.value += ` DOUBLE ARCS with headingDiff ${headingDiff.toFixed(2)}`;
  let isLeftRightArcs = startToIntersectionDistance > 0;

  // Point M is the intersection between the perp of target heading and the (perp of) start heading
  let M = isConverging
    ? startPerp.Wedge(targetPerp).Normalized
    : initLine.Wedge(targetPerp).Normalized;

  M.e01 /= M.e12;
  M.e02 /= M.e12;
  M.e12 = 1;

  intersectionSphere.position.set(
    -headingIntersect.e02 / headingIntersect.e12,
    headingIntersect.e01 / headingIntersect.e12,
    0
  );
  rotationPivotSphere.position.set(
    -outCenter.e02 / outCenter.e12,
    outCenter.e01 / outCenter.e12,
    0
  );
  transitionSphere2.position.set(-M.e02 / M.e12, M.e01 / M.e12, 0);

  // Use the binary search technique to locate the center of the incoming arc
  let lowAlpha = 0;
  let hiAlpha = 1;
  let alpha: number;
  let inArcCenterFound = false;
  let count = 0;
  let inCenter: GAElement = make2DPoint(0, 0);
  let distanceHC = 0;
  if (modifiedOutgoingArcCenter) {
    outCenter.e01 *= -1;
    outCenter.e02 *= -1;
    outCenter.e12 *= -1;
  }
  while (lowAlpha < hiAlpha && !inArcCenterFound && count < 200) {
    alpha = (lowAlpha + hiAlpha) / 2;
    inCenter = PGA2D.Mul(1 - alpha, M).Add(PGA2D.Mul(alpha, finalPoint));
    const distanceHE = inCenter.Vee(outCenter).Length;
    distanceHC = inCenter.Vee(finalPoint).Length;

    if (Math.abs(distanceHC + outgoingRadius - distanceHE) < 1e-3) {
      inArcCenterFound = true;
    } else if (distanceHE > distanceHC + outgoingRadius) {
      hiAlpha = alpha;
    } else {
      lowAlpha = alpha;
    }
    count++;
  }
  if (inArcCenterFound) {
    /* Connect the two circle center (which is also perpendicular of the common tangent) */
    const perpTangent = inCenter.Vee(outCenter);
    const inRadius = inCenter.Vee(finalPoint).Length;
    const outRadius = outCenter.Vee(initialPoint).Length;
    const r1 = inRadius / (inRadius + outRadius);
    const r2 = outRadius / (inRadius + outRadius);
    const commonTangent = PGA2D.Mul(r2, inCenter.Normalized).Sub(
      PGA2D.Mul(r1, outCenter.Normalized)
    ).Normalized;
    // console.debug(`Computing common tangent with ratio ${r1.toFixed(2)}:${r2.toFixed(2)}`)
    // console.debug(dump2DPoint("DoubleArc outgoing center", outCenter.Normalized))
    // console.debug(dump2DPoint("DoubleArc incoming center", inCenter.Normalized))
    // console.debug(dump2DPoint("DoubleArc common tangent", commonTangent))
    const tangentX = -commonTangent.e02 / commonTangent.e12;
    const tangentY = commonTangent.e01 / commonTangent.e12;
    const oArcLenDeg = MathUtils.radToDeg(
      Math.acos(perpTangent.Normalized.Dot(startPerp.Normalized) as any)
    );
    const outgoingArcAngle = isLeftRightArcs ? 180 - oArcLenDeg : oArcLenDeg;
    const iArcLenDeg = MathUtils.radToDeg(
      Math.acos(perpTangent.Normalized.Dot(targetPerp.Normalized) as any)
    );
    const incomingArcAngle = isLeftRightArcs ? 180 - iArcLenDeg : iArcLenDeg;
    debugText.value += ` outgoing arc ${outgoingArcAngle.toFixed(
      1
    )} incoming arc length ${incomingArcAngle.toFixed(1)}`;
    rotationPivot2Sphere.position.set(
      -inCenter.e02 / inCenter.e12,
      inCenter.e01 / inCenter.e12,
      0
    );
    transitionPipe.position.z = -100;
    // transitionSphere.position.z = -100;
    transitionSphere.position.set(tangentX, tangentY, 0);
    transitionSphere2.position.z = -100;
    arcFromInitial.position.set(
      -outCenter.e02 / outCenter.e12,
      outCenter.e01 / outCenter.e12,
      0
    );
    arcFromInitial.rotation.z =
      startToIntersectionDistance < 0
        ? MathUtils.degToRad(90 - outgoingArcAngle + initialOrientation.value)
        : MathUtils.degToRad(initialOrientation.value - 90);
    modifyArc(arcFromInitial, outgoingRadius, outgoingArcAngle);
    paths.value.push({
      kind: "Rot", // Outgoing Arc
      centerX: -outCenter.e02 / outCenter.e12,
      centerY: outCenter.e01 / outCenter.e12,
      arcAngleDegree: isLeftRightArcs ? outgoingArcAngle : -outgoingArcAngle,
      radius: outgoingRadius,
      startX: -initialPoint.e02 / initialPoint.e12,
      startY: initialPoint.e01 / initialPoint.e12,
      startHeading: MathUtils.degToRad(initialOrientation.value),
    });
    arcToFinal.position.set(
      -inCenter.e02 / inCenter.e12,
      inCenter.e01 / inCenter.e12,
      0
    );
    arcToFinal.rotation.z =
      intersectionToFinalDistance > 0
        ? MathUtils.degToRad(-incomingArcAngle + finalOrientation.value - 90)
        : MathUtils.degToRad(90 + finalOrientation.value);
    modifyArc(arcToFinal, distanceHC, incomingArcAngle);
    // paths.value.push(
    //   "Rotate " +
    //     (isLeftRightArcs ? "CW" : "CCW") +
    //     ` ${incomingArcAngle.toFixed(2)} at ${dump2DPoint("R2", inCenter)}with radius ${distanceHC.toFixed(2)}`
    // );
    const inComingStartHeading = -(
      lineSlopeInRadian(perpTangent) +
      Math.PI / 2
    );
    paths.value.push({
      kind: "Rot", // Incoming arc
      centerX: -inCenter.e02 / inCenter.e12,
      centerY: inCenter.e01 / inCenter.e12,
      arcAngleDegree: isLeftRightArcs ? -incomingArcAngle : incomingArcAngle,
      radius: distanceHC,
      startX: tangentX,
      startY: tangentY,
      startHeading: isLeftRightArcs
        ? inComingStartHeading + Math.PI
        : inComingStartHeading,
    });
  } else {
    debugText.value += " cannot find incoming arc after 200 iterations";
    arcFromInitial.position.z = -100;
    arcToFinal.position.z = -100;
  }
  return inArcCenterFound;
}

/**
 * 
 * @param initialPoint 
 * @param finalPoint 
 * @param initialLine 
 * @param line2 
 * @param startToIntersectionDistance 
 * @param intersectionToFinalDistance 
 * 
 * the sign of both distances also determine whether the incoming/outgoing
 * arcs are CW or CCW
 */
function doDoubleTurn(
  initialPoint: GAElement,
  finalPoint: GAElement,
  initialLine: GAElement,
  line2: GAElement,
  startToIntersectionDistance: number,
  intersectionToFinalDistance: number
) {
  const headingDiff = withinPlusMinus180(
    finalOrientation.value - initialOrientation.value
  );
  const isDiverging = intersectionToFinalDistance * headingDiff < 0;
  const initOr = withinPlusMinus180(initialOrientation.value);
  const finalOr = withinPlusMinus180(finalOrientation.value);
  let bisectorOrientation = (initOr + finalOr) / 2;
  bisectorOrientation = within360(bisectorOrientation + 180);
  debugText.value += ` initOr ${initOr.toFixed(2)} finalOr ${finalOr.toFixed(
    2
  )} Bisector orientation ${bisectorOrientation.toFixed(2)}`;
  const bisectorCtr = initialLine.Normalized.Add(line2.Normalized); // main bisector
  const bisectorLeft = initialLine.Normalized.Add(bisectorCtr.Normalized);
  const bisectorRight = bisectorCtr.Normalized.Add(line2.Normalized);
  // The right rotation pivot and the incoming tangent are always determined by the final point
  // So we can compute them immediately
  const rightPivot = line2.Dot(finalPoint).Wedge(bisectorRight);
  const incomingArcTangentStart = bisectorCtr
    .Dot(rightPivot)
    .Wedge(bisectorCtr);
  const inTangentStartX =
    -incomingArcTangentStart.e02 / incomingArcTangentStart.e12;
  const inTangentStartY =
    incomingArcTangentStart.e01 / incomingArcTangentStart.e12;
  transitionSphere2.position.set(inTangentStartX, inTangentStartY, 0);
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
  let outgoingRotationPivot: GAElement,
    outgoingRotationRadius: number,
    outgoingRotationArcAngle: number,
    translationDistance: number,
    tangentOnStartX: number = NaN,
    tangentOnStartY: number = NaN,
    tangentOnMidPreX: number = NaN,
    tangentOnMidPreY: number = NaN;

  let isRotateThenTranslate = false;
  if (
    (!isDiverging &&
      Math.abs(startToIntersectionDistance) <
        Math.abs(intersectionToFinalDistance)) ||
    (isDiverging &&
      Math.abs(startToIntersectionDistance) >
        Math.abs(intersectionToFinalDistance))
  ) {
    // relative to the intersection point, initial point is ahead of final point
    isRotateThenTranslate = true;
    [
      outgoingRotationPivot,
      outgoingRotationRadius,
      [tangentOnMidPreX, tangentOnMidPreY],
      translationDistance,
    ] = rotateThenTranslate(
      initialPoint,
      incomingArcTangentStart,
      initialLine,
      bisectorCtr,
      bisectorLeft
    );
    const ctr1 = bisectorCtr.Dot(outgoingRotationPivot).Wedge(bisectorCtr);
    // tangentOnMidPostX = -ctr1.e02 / ctr1.e12;
    // tangentOnMidPostY = ctr1.e01 / ctr1.e12;
    transitionSphere.position.set(tangentOnMidPreX, tangentOnMidPreY, 0);
    const transitionLength = incomingArcTangentStart.Normalized.Vee(
      ctr1.Normalized
    ).Length;
    transitionPipe.position.set(tangentOnMidPreX, tangentOnMidPreY, 0);
    transitionPipe.rotation.z = MathUtils.degToRad(bisectorOrientation + 270);
    transitionPipe.translateY(transitionLength / 2);
    transitionPipe.scale.y = transitionLength;
  } else {
    // start is farther from intersection
    isRotateThenTranslate = false;
    [
      translationDistance,
      [tangentOnStartX, tangentOnStartY],
      outgoingRotationPivot,
      outgoingRotationRadius,
    ] = translateThenRotate(
      initialPoint,
      incomingArcTangentStart,
      initialLine,
      bisectorCtr,
      bisectorLeft
    );
  }
  arcFromInitial.position.set(
    -outgoingRotationPivot.e02 / outgoingRotationPivot.e12,
    outgoingRotationPivot.e01 / outgoingRotationPivot.e12,
    0
  );
  const deltaOut = bisectorOrientation - initialOrientation.value;
  outgoingRotationArcAngle = within360(
    startToIntersectionDistance < 0 ? 360 - deltaOut : deltaOut
  );
  // const outArcDetails =
  //   "Rotate " +
  //   (isOutgoingArcCCW ? "CCW" : "CW") +
  //   ` ${outgoingRotationArcAngle.toFixed(
  //     2
  //   )} degrees at ${dump2DPoint("R1", outgoingRotationPivot)} with radius ${outgoingRotationRadius.toFixed(2)}`;
  const outArcDetails: RotationPath = {
    kind: "Rot",
    centerX: -outgoingRotationPivot.e02 / outgoingRotationPivot.e12,
    centerY: outgoingRotationPivot.e01 / outgoingRotationPivot.e12,
    arcAngleDegree:
      Math.sign(startToIntersectionDistance) * outgoingRotationArcAngle,
    radius: outgoingRotationRadius,
    startX: NaN,
    startY: NaN,
    startHeading: NaN,
  };
  const startX = -initialPoint.e02 / initialPoint.e12;
  const startY = initialPoint.e01 / initialPoint.e12;
  if (isRotateThenTranslate) {
    outArcDetails.startX = startX;
    outArcDetails.startY = startY;
    outArcDetails.startHeading = MathUtils.degToRad(initialOrientation.value);
    paths.value.push(
      outArcDetails,
      {
        kind: "Trans",
        distance: translationDistance,
        startX: tangentOnMidPreX,
        startY: tangentOnMidPreY,
        startHeading: MathUtils.degToRad(bisectorOrientation),
      }
      // `Translate by ${translationDistance.toFixed(2)} units`
    );
  } else {
    outArcDetails.startX = tangentOnStartX;
    outArcDetails.startY = tangentOnStartY;
    outArcDetails.startHeading = MathUtils.degToRad(initialOrientation.value);
    paths.value.push(
      {
        kind: "Trans",
        distance: translationDistance,
        startX,
        startY,
        startHeading: MathUtils.degToRad(initialOrientation.value),
      },
      // `Translate by ${translationDistance.toFixed(2)} units`,
      outArcDetails
    );
  }
  modifyArc(arcFromInitial, outgoingRotationRadius, outgoingRotationArcAngle);
  arcFromInitial.position.z = 0;
  rotationPivotSphere.position.set(
    -outgoingRotationPivot.e02 / outgoingRotationPivot.e12,
    outgoingRotationPivot.e01 / outgoingRotationPivot.e12,
    0
  );
  arcFromInitial.rotation.z =
    startToIntersectionDistance < 0
      ? MathUtils.degToRad(bisectorOrientation - 270)
      : MathUtils.degToRad(initialOrientation.value - 90);

  // Calculate incoming arc
  const incomingRotationRadius = rightPivot.Normalized.Vee(
    finalPoint.Normalized
  ).Length;
  const deltaIn = finalOrientation.value - bisectorOrientation;
  let incomingRotationArcAngle = within360(
    intersectionToFinalDistance > 0 ? deltaIn : 360 - deltaIn
  );

  const inArcDetails: RotationPath = {
    kind: "Rot",
    centerX: -rightPivot.e02 / rightPivot.e12,
    centerY: -rightPivot.e01 / rightPivot.e12,
    arcAngleDegree:
      Math.sign(intersectionToFinalDistance) * incomingRotationArcAngle,
    radius: incomingRotationRadius,
    startX: inTangentStartX,
    startY: inTangentStartY,
    startHeading: MathUtils.degToRad(within360(bisectorOrientation)),
  };
  paths.value.push(inArcDetails);
  modifyArc(arcToFinal, incomingRotationRadius, incomingRotationArcAngle);
  arcToFinal.rotation.z =
    intersectionToFinalDistance > 0
      ? MathUtils.degToRad(270 + bisectorOrientation)
      : MathUtils.degToRad(90 + finalOrientation.value);
  arcToFinal.position.z = 0;
}

function findBikePath() {
  paths.value.splice(0);
  const initialPoint = make2DPoint(
    initialMarker.position.x,
    initialMarker.position.y
  );
  // paths.value.push({
  //   kind: "Start",
  //   x: initialMarker.position.x,
  //   y: initialMarker.position.y,
  // });
  const finalPoint = make2DPoint(
    finalMarker.position.x,
    finalMarker.position.y
  );
  // const iAngle = withinPi(initialMarker.rotation.z);
  const initialDirection = make2DDirection(
    Math.cos(initialMarker.rotation.z),
    Math.sin(initialMarker.rotation.z)
  );
  // const fAngle = withinPi(finalMarker.rotation.z);
  const finalDirection = make2DDirection(
    Math.cos(finalMarker.rotation.z),
    Math.sin(finalMarker.rotation.z)
  );
  const line1 = initialPoint.Vee(initialDirection);
  const line2 = finalPoint.Vee(finalDirection);
  const intersection = line1.Wedge(line2);

  // pathDistance.value = initialPoint.Vee(finalPoint).Length;
  if (Math.abs(intersection.e12) < 1e-5) {
    // console.debug("Parallel line");
    debugText.value = "Parallel lines";
    parallelWarning.value = true;
    return;
  }
  parallelWarning.value = false;
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
  paths.value.push({
    kind: "Final",
    startX: finalMarker.position.x,
    startY: finalMarker.position.y,
    startHeading: MathUtils.degToRad(finalOrientation.value),
  });
}

function executePlan() {
  runMode.value = "autonomous";
}

function resetExecutor() {
  console.debug("Reset Executor")
  runMode.value = "plan";
  selectedPath.value = 0

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

.pathSegment {
  border-top: 2px solid grey;
  padding: .5em 0;
}
.pathSegment:last-child {
  border-bottom: 2px solid grey;
}
</style>