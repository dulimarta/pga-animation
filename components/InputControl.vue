<template>
    <h2>Input Control</h2>
  <div class="input">
    <v-slider
      v-model="torqueInput"
      :min="-2"
      :max="2"
      :step="0.01"
      :label="`Wheel Torque (${torqueInput} Nm)`"
    />
    <v-btn @click="applyTorque">Apply</v-btn>
    <v-slider
      v-model="steerAngle"
      :min="-80"
      :max="80"
      :step="0.5"
      :label="`Steer Angle (${steerAngle.toFixed(1)} deg)`"
    />
    <p></p>
    <v-switch size="small" v-model="playAnimation"
    :label="switchLabel"></v-switch>
  </div>
</template>

<script setup lang="ts">
import { usePGAStore } from "~/store/pga-store";
import { storeToRefs } from "pinia";
const store = usePGAStore();
const torqueInput = ref(0)
const { driveWheelTorque, steerAngle, playAnimation } = storeToRefs(store);

const switchLabel = computed(() => playAnimation.value ? "Animate" : "Pause Animation")
function applyTorque() {
  driveWheelTorque.value = torqueInput.value
  setTimeout(() => { 
    driveWheelTorque.value = 0
  }, 500)
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
