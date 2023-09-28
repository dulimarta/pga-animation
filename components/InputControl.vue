<template>
  <div class="input">
    Input Control
    <v-slider
      v-model="driveWheelSpeed"
      :min="0"
      :max="30"
      :step="1"
      :label="`Drive Wheel (${driveWheelSpeed} RPM)`"
    />
    <v-slider
      v-model="steerAngle"
      :min="-50"
      :max="50"
      :step=".5"
      :label="`Steer Angle (${steerAngle.toFixed(1)} deg)`"
    />

  </div>
</template>
<script setup lang="ts">
import { usePGAStore } from "~/store/pga-store";
import { storeToRefs } from "pinia";
const store = usePGAStore();
const { driveWheelSpeed, steerAngle } = storeToRefs(store);
</script>
<style scoped>
.input {
  padding: 1em;
  width: 400px;
  /* display: inline-flex; */
  /* flex-direction: column; */
}
</style>
