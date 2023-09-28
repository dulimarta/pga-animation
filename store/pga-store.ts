import { defineStore } from "pinia";
export const usePGAStore = defineStore('pga', () => {
  const driveWheelSpeed = ref(10) /* RPM */

  return {driveWheelSpeed}
})