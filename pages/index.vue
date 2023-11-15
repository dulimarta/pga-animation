<template>
    <div id="main">
      <ThreeCanvas />
      <div>
      <v-tabs v-model="currentTab">
        <v-tab>Run</v-tab>
        <v-tab>Setup</v-tab>
      </v-tabs>
      <v-window v-model="currentTab">
      <v-window-item>
        <InputControl />
        <XYPlot :x-value="bodyPosition.x" :y-value="bodyPosition.y" title="XY Position"/>
      </v-window-item>
        <v-window-item>
          <FloorMap/>
        </v-window-item>
      </v-window>
    </div>
      <div>
      </div>
    </div>
</template>
<script setup lang="ts">
import { storeToRefs } from "pinia";
import { usePGAStore } from "~/store/pga-store";
const store = usePGAStore();
const { bodyPosition } = storeToRefs(store);
const currentTab = ref(0)
</script>
<style scoped>
#main {
  display: flex;
  flex-direction: row;
}
</style>
