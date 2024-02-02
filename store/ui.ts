import { defineStore } from "pinia";
import {
  Group,
  Mesh,
  Vector3,
  CylinderGeometry,
  MeshPhongMaterial,
  SphereGeometry,
  TorusGeometry,
  Matrix4,
  Scene,
  Camera,
} from "three";

const ALPHA = 0.5;
export const useVisualStore = defineStore("visual", () => {
  // const initialMarker: Ref<Group> = ref(makeArrow())
  const visualScene: Ref<Scene | null> = ref(null);
  const visualCamera: Ref<Camera | null> = ref(null);
  const mousePositionOnGround = ref(new Vector3());
  const mouseWheelScrollAmount = ref(0);
  const brakeApplied = ref(false);
  const showGeometry = ref(true);
  const runMode: Ref<"plan" | "manual-control" | "autonomous"> = ref("manual-control");
  const driveWheelTorqueInput = ref(0); /* Newton-M */
  const steerVelocityInput = ref(0);
  let lastInterpolatedTorque = 0;
  let currInterpolatedTorque = 0;
  let lastInputTorque = 0;
  const computedTorque = (): number => {
    // watch(driveWheelTorqueInput, (torque: number) => {
    // console.debug(
    //   `Drive wheel torque changes to ${driveWheelTorqueInput.value.toFixed(2)}`
    // );
    // f_{k-1+alpha}
    lastInterpolatedTorque = currInterpolatedTorque;
    currInterpolatedTorque =
      ALPHA * lastInputTorque + (1 - ALPHA) * driveWheelTorqueInput.value;
    lastInputTorque = driveWheelTorqueInput.value; // f_{k-1} = f_k
    lastInterpolatedTorque =
      ALPHA * lastInterpolatedTorque + (1 - ALPHA) * currInterpolatedTorque;
    return lastInterpolatedTorque;
  };

  return {
    visualScene,
    visualCamera,
    mousePositionOnGround,
    mouseWheelScrollAmount,
    brakeApplied,
    showGeometry,
    runMode,
    driveWheelTorqueInput,
    computedTorque,
    steerVelocityInput,
  };
});
