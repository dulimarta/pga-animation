import { defineStore } from "pinia";
import { Vector2 } from "three";
const { makeScalar, makePoint, makePlane } = usePGA3D();


// type Terminal = SegmentType & {
//   x: number;
//   y: number;
// };
export const usePGAStore = defineStore("pga", () => {
  const steerDirection = ref(0); /* in radians */
  // const rigidRotationAngleDebug = ref(0)
  const bodyRotation = ref(0); // in radians
  const bodyPosition: Ref<Vector2> = ref(new Vector2());
  const bikeInMotion = ref(false);
  const steerMotor: Ref<GAElement> = ref(makeScalar(1));
  const bodyMotor: Ref<GAElement> = ref(makeScalar(1));
  const rearHub: Ref<GAElement> = ref(makePoint(0, 0, 0));
  const frontHub: Ref<GAElement> = ref(makePoint(0, 0, 0));
  const rearWheelPlane: Ref<GAElement> = ref(makePlane(1, 0, 0, 0));
  const frontWheelPlane: Ref<GAElement> = ref(makePlane(1, 0, 0, 10));
  
  return {
    steerDirection,
    bodyPosition,
    bodyRotation,
    bikeInMotion,
    steerMotor,
    bodyMotor,
    rearHub,
    frontHub,
    rearWheelPlane,
    frontWheelPlane
  };
});
