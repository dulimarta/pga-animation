<template>
    <div id="main">
      <ThreeCanvas />
      <div>
        <InputControl />
        <FloorMap/>
        <XYPlot :x-value="bodyPosition.x" :y-value="bodyPosition.y" title="XY Position"/>
      </div>
    </div>
</template>
<script setup lang="ts">
import { storeToRefs } from "pinia";
import { usePGAStore } from "~/store/pga-store";
const store = usePGAStore();
const { bodyPosition } = storeToRefs(store);
</script>
<style scoped>
#main {
  display: flex;
  flex-direction: row;
}
</style>
