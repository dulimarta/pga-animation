<template>
  <ClientOnly>
    <div id="main">
      <ThreeCanvas />
      <div>
        <InputControl />
        <ConfigVar :data="bodyPosition.x" />
      </div>
    </div>
  </ClientOnly>
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
