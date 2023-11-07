import { defineStore } from "pinia";
import { Vector2 } from "three";
export const usePGAStore = defineStore('pga', () => {
  const driveWheelSpeed = ref(0) /* RPM */
  const steerAngle = ref(0)
  const bodyPosition: Ref<Vector2> = ref(new Vector2())
  const playAnimation = ref(true)
  return {driveWheelSpeed, steerAngle, bodyPosition, playAnimation}
})