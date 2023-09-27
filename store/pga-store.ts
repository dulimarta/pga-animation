import { defineStore } from "pinia";
export const usePGAStore = defineStore('pga', () => {
  const tireSpeed = ref(5) /* RPM */

  return {tireSpeed}
})