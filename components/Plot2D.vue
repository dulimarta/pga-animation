<template>
  <div ref="plotArea">Hey</div>
</template>
<script setup lang="ts">
const plotArea: Ref<HTMLDivElement | null> = ref(null)
import Two from "twojs-ts";
let twoInstance:Two

onMounted(() => {
  console.debug(plotArea.value)
  twoInstance = new Two({width: 200, height:200})
  // twoInstance.makeCircle(100, 100, 50)
})
</script>