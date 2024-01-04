import { defineStore } from "pinia";
import { Vector2 } from "three";
const {makeScalar} = usePGA3D()
export const usePGAStore = defineStore('pga', () => {
  const driveWheelTorque = ref(0) /* Newton-M */
  const steerVelocity = ref(0)
  // const rigidRotationAngleDebug = ref(0)
  const bodyRotation = ref(0)
  const bodyPosition: Ref<Vector2> = ref(new Vector2())
  const brakeApplied = ref(false)
  const showGeometry = ref(true)
  const bikeInMotion = ref(false)
  const runMode: Ref<"plan" | "run"> = ref("run")
  const steerMotor: Ref<GAElement> = ref(makeScalar(1))
  const bodyMotor: Ref<GAElement> = ref(makeScalar(1))

  return {driveWheelTorque, steerVelocity, bodyPosition, bodyRotation, bikeInMotion, brakeApplied, showGeometry, runMode, steerMotor, bodyMotor}
})