import { defineStore } from "pinia";
import { Vector2 } from "three";
const { makeScalar, makePoint, makePlane } = usePGA3D();

export type SegmentType = {
  kind: "Rot" | "Trans"; //| "Start" | "End";
  startX: number,
  startY: number
};
export type RotationPath = SegmentType & {
  // kind: SegmentType,
  centerX: number;
  centerY: number;
  arcAngleDegree: number;
  radius: number
};

export type TranslationPath = SegmentType & {
  distance: number;
};
// type Terminal = SegmentType & {
//   x: number;
//   y: number;
// };
export type PathSegment = RotationPath | TranslationPath; //| Terminal;
export const usePGAStore = defineStore("pga", () => {
  const driveWheelTorque = ref(0); /* Newton-M */
  const steerVelocity = ref(0);
  const steerDirection = ref(0) /* in radians */
  // const rigidRotationAngleDebug = ref(0)
  const bodyRotation = ref(Math.PI/5); // in radians
  const bodyPosition: Ref<Vector2> = ref(new Vector2());
  const brakeApplied = ref(false);
  const showGeometry = ref(true);
  const bikeInMotion = ref(false);
  const runMode: Ref<"plan" | "run" | "execute"> = ref("run");
  const steerMotor: Ref<GAElement> = ref(makeScalar(1));
  const bodyMotor: Ref<GAElement> = ref(makeScalar(1));
  const rearHub: Ref<GAElement> = ref(makePoint(0, 0, 0))
  const frontHub: Ref<GAElement> = ref(makePoint(0, 0, 0))
  const rearWheelPlane: Ref<GAElement> = ref(makePlane(1, 0, 0, 0))
  const frontWheelPlane: Ref<GAElement> = ref(makePlane(1, 0, 0, 10))
  const paths: Ref<Array<PathSegment>> = ref([]);

  return {
    driveWheelTorque,
    steerVelocity,
    steerDirection,
    bodyPosition,
    bodyRotation,
    bikeInMotion,
    brakeApplied,
    showGeometry,
    runMode,
    steerMotor,
    bodyMotor,
    rearHub,
    frontHub,
    rearWheelPlane,
    frontWheelPlane,
    paths
  };
});
