<template>
  <h2>Input Control</h2>
  <div style="margin: 0.5em">
    <v-container>
      <v-row>
        <v-col cols="6">
          <span>Apply Wheel Torque</span>
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
          <span>Steer Direction</span>
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
      <v-row v-if="false">
        <v-col
          >(Debugging only)
          <v-slider
            v-model="rigidRotationAngleDebug"
            :min="-120"
            :max="120"
            :step="2"
            :label="`Body Angle (${rigidRotationAngleDebug.toFixed(1)} deg)`"
          />
        </v-col>
      </v-row>
    </v-container>
    <span style="display: flex">
      <v-switch v-model="brakeApplied" :label="switchLabel"></v-switch>
      <v-switch v-model="showGeometry" label="Show Geometry" />
    </span>
  </div>
</template>

<script setup lang="ts">
import { usePGAStore } from "~/store/pga-store";
import { storeToRefs } from "pinia";
import { MathUtils } from "three";
const store = usePGAStore();
const {
  driveWheelTorque,
  steerVelocity,
  rigidRotationAngleDebug,
  brakeApplied,
  showGeometry,
} = storeToRefs(store);

const STEER_SPEED = 30;
const switchLabel = computed(() =>
  brakeApplied.value ? "Release brake" : "Apply brake"
);
function moreTorque() {
  driveWheelTorque.value = 2;
  setTimeout(() => {
    driveWheelTorque.value = 0;
  }, 500);
}
function lessTorque() {
  driveWheelTorque.value = -0.5;
  setTimeout(() => {
    driveWheelTorque.value = 0;
  }, 500);
}

function steerLeft() {
  steerVelocity.value = MathUtils.degToRad(STEER_SPEED); // clockwise
  setTimeout(() => {
    steerVelocity.value = 0;
  }, 300);
}
function steerRight() {
  steerVelocity.value = -MathUtils.degToRad(STEER_SPEED); // anticlockwise
  setTimeout(() => {
    steerVelocity.value = 0;
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
</style>
