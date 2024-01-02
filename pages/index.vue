<template>
  <div id="main">
    <ThreeCanvas class="flex-child"/>
    <div class="flex-child">
      <v-tabs v-model="currentTab" @update:modelValue="setRunMode">
        <v-tab>Run</v-tab>
        <v-tab :disabled="bikeInMotion">Path Planner</v-tab>
      </v-tabs>
      <v-window v-model="currentTab" >
        <v-window-item>
          <InputControl />
          <XYPlot
            :x-value="bodyPosition.x"
            :y-value="bodyPosition.y"
            title="XY Position"
          />
        </v-window-item>
        <v-window-item>
          <PathPlanner />
        </v-window-item>
      </v-window>
    </div>
  </div>
</template>
<script setup lang="ts">
import { storeToRefs } from "pinia";
import { usePGAStore } from "~/store/pga-store";
const store = usePGAStore();
const { bodyPosition, runMode, bikeInMotion } = storeToRefs(store);
const currentTab = ref(0);

function setRunMode() {
  runMode.value = currentTab.value === 0 ? "run" : "plan"    
}
</script>
<style scoped lang="scss">
#main {
  display: flex;
  flex-direction: row;
}
.flex-child {
  &:nth-child(1) {
    flex-grow: 4;
    // border: 2px solid blue;
  }
  &:nth-child(2) {
    flex-grow: 1;
    // border: 2px solid red
  }
}
</style>
