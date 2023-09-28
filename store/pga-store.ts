import { defineStore } from "pinia";
export const usePGAStore = defineStore('pga', () => {
  const driveWheelSpeed = ref(20) /* RPM */
  const steerAngle = ref(0)

  return {driveWheelSpeed, steerAngle}
})