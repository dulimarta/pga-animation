import { defineStore } from "pinia";
import { Vector2 } from "three";
export const usePGAStore = defineStore('pga', () => {
  const driveWheelTorque = ref(0) /* Newton-M */
  const steerAngle = ref(0)
  const bodyRotation = ref(0)
  const bodyPosition: Ref<Vector2> = ref(new Vector2())
  const playAnimation = ref(true)

  // const floorInputPosition: Ref<Vector2> = ref(new Vector2())
  return {driveWheelTorque, steerAngle, bodyPosition, bodyRotation, playAnimation}
})