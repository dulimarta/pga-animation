<template>
  <h2>Input Control</h2>
  <div style="margin: 0.5em">
    <v-container>
      <v-row>
        <v-col cols="6">
          <span>Drive Wheel Torque</span>
        </v-col>
        <v-col>
          <v-btn @click="lessTorque" style="margin-right: 0.5em">
            <v-icon>mdi-tortoise</v-icon>
          </v-btn>
          <v-btn @click="moreTorque">
            <v-icon>mdi-rabbit</v-icon>
          </v-btn>
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="6">
          <span>Steer Direction {{ steerAngleDegree }}&deg;</span>
        </v-col>
        <v-col>
          <v-btn @click="steerLeft" style="margin-right: 0.5em">
            <v-icon>mdi-rotate-left</v-icon>
          </v-btn>
          <v-btn @click="steerRight" style="margin-right: 0.5em">
            <v-icon>mdi-rotate-right</v-icon>
          </v-btn>
        </v-col>
      </v-row>      
    </v-container>
    <span id="switches">
      <v-switch v-model="brakeApplied" :label="switchLabel"></v-switch>
      <v-switch v-model="showGeometry" label="Show Geometry" />
    </span>
    <v-textarea v-model="infoText"></v-textarea>
  </div>
</template>

<script setup lang="ts">
import { usePGAStore } from "~/store/pga-store";
import { useVisualStore } from "~/store/ui";
import { storeToRefs } from "pinia";
import { MathUtils } from "three";
import { useKinematicsStore } from "~/store/kinematics";
const {parsePGAMotor } = usePGA3D()
const store = usePGAStore();
const uiStore = useVisualStore()
const kinematicStore = useKinematicsStore()
const {
  steerDirection,    
  steerMotor, bodyMotor
} = storeToRefs(store);
const {brakeApplied,   driveWheelTorqueInput, steerVelocityInput,
  showGeometry}= storeToRefs(uiStore)
  // const {steerVelocity} = storeToRefs(kinematicStore)
const STEER_SPEED = 30;
const infoText = ref("")
const switchLabel = computed(() =>
  brakeApplied.value ? "Release brake" : "Apply brake"
);

const steerAngleDegree = computed(() => MathUtils.radToDeg(steerDirection.value).toFixed(2))
infoText.value = parsePGAMotor("Body Motor", bodyMotor.value)
watch([steerMotor, bodyMotor], ([s,b]: [GAElement,GAElement]) => {
  // console.debug("Steer motor changed", s.toString())
  infoText.value = parsePGAMotor("Steer Motor", s) + '  ' + parsePGAMotor("Body Motor", b)
})
function moreTorque() {
  driveWheelTorqueInput.value = 2;
  setTimeout(() => {
    driveWheelTorqueInput.value = 0;
  }, 500);
}
function lessTorque() {
  driveWheelTorqueInput.value = -0.5;
  setTimeout(() => {
    driveWheelTorqueInput.value = 0;
  }, 500);
}

function steerLeft() {
  steerVelocityInput.value = MathUtils.degToRad(STEER_SPEED); // clockwise
  setTimeout(() => {
    steerVelocityInput.value = 0;
  }, 300);
}
function steerRight() {
  steerVelocityInput.value = -MathUtils.degToRad(STEER_SPEED); // anticlockwise
  setTimeout(() => {
    steerVelocityInput.value = 0;
  }, 300);
}
</script>
<style scoped>
.input {
  padding: 1em;
  width: 400px;
  display: grid;
  grid-template-columns: 4fr 1fr;
  /* display: inline-flex; */
  /* flex-direction: column; */
}
#switches {
  display: flex;
}
</style>
