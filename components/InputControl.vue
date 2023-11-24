<template>
  <h2>Input Control</h2>
  <div>
    <span style="margin-right:1em">Apply Wheel Torque</span>
      <v-btn @click="lessTorque" style="margin-right: 1em">
        <v-icon>mdi-tortoise</v-icon>
      </v-btn>
      <v-btn @click="moreTorque">
        <v-icon>mdi-rabbit</v-icon>
      </v-btn>
    </div>
    <v-slider
      v-model="steerAngle"
      :min="-80"
      :max="80"
      :step="0.5"
      :label="`Steer Angle (${steerAngle.toFixed(1)} deg)`"
    />
    <p></p>
    <v-switch v-model="playAnimation" :label="switchLabel"></v-switch>
</template>

<script setup lang="ts">
import { usePGAStore } from "~/store/pga-store";
import { storeToRefs } from "pinia";
const store = usePGAStore();
const { driveWheelTorque, steerAngle, playAnimation } = storeToRefs(store);

const switchLabel = computed(() =>
  playAnimation.value ? "Animate" : "Pause Animation"
);
function moreTorque() {
  driveWheelTorque.value = 1.5;
  setTimeout(() => {
    driveWheelTorque.value = 0;
  }, 500);
}
function lessTorque() {
  driveWheelTorque.value = -0.75;
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
