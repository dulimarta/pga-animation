import { defineStore } from "pinia";
import { Vector2 } from "three";
export const usePGAStore = defineStore('pga', () => {
  const driveWheelTorque = ref(0) /* Newton-M */
  const steerVelocity = ref(0)
  // const rigidRotationAngleDebug = ref(0)
  const bodyRotation = ref(0)
  const bodyPosition: Ref<Vector2> = ref(new Vector2())
  const brakeApplied = ref(false)
  const showGeometry = ref(true)
  const runMode: Ref<"setup"|"run"> = ref("run")

  // const floorInputPosition: Ref<Vector2> = ref(new Vector2())
  return {driveWheelTorque, steerVelocity, bodyPosition, bodyRotation, brakeApplied, showGeometry, runMode}
})