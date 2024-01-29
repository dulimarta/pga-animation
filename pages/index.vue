<template>
  <div id="main">
    <ThreeCanvas id="canvas"/>
    <div class="flex-child">
      <v-tabs v-model="currentTab" @update:modelValue="setRunMode">
        <v-tab>Run</v-tab>
        <v-tab :disabled="bikeInMotion">Path Planner</v-tab>
      </v-tabs>
      <v-window v-model="currentTab" >
        <v-window-item>
          <InputControl/>
          <!--XYPlot
            :x-value="bodyPosition.x"
            :y-value="bodyPosition.y"
            title="XY Position"
          /-->
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
  runMode.value = currentTab.value === 0 ? "manual-control" : "plan"    
}
</script>
<style scoped lang="scss">
#main {
  display: flex;
  flex-direction: row;
}

.flex-child {
  min-width: 24em;
}
</style>
