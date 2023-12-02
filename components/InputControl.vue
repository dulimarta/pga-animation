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
        <v-col>
          <v-slider
            v-model="steerAngle"
            :min="-80"
            :max="80"
            :step="0.5"
            :label="`Steer Angle (${steerAngle.toFixed(1)} deg)`"
        /></v-col>
      </v-row>
      <v-row>
        <v-col>(Debugging only)
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
      <v-switch v-model="playAnimation" :label="switchLabel"></v-switch>
      <v-switch v-model="showGeometry" label="Show Geometry" />
    </span>
  </div>
</template>

<script setup lang="ts">
import { usePGAStore } from "~/store/pga-store";
import { storeToRefs } from "pinia";
const store = usePGAStore();
const { driveWheelTorque, steerAngle, rigidRotationAngleDebug, playAnimation, showGeometry } =
  storeToRefs(store);

const switchLabel = computed(() =>
  playAnimation.value ? "Animate" : "Pause Animation"
);
function moreTorque() {
  driveWheelTorque.value = 2;
  setTimeout(() => {
    driveWheelTorque.value = 0;
  }, 500);
}
function lessTorque() {
  driveWheelTorque.value = -.5;
  setTimeout(() => {
    driveWheelTorque.value = 0;
  }, 500);
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
