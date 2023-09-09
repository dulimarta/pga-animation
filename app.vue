<template>
  <v-btn>Hans Here</v-btn>
  <v-icon>mdi-wifi-alert</v-icon>
  <canvas id="glcanvas" ref="glcanvas"></canvas>

  <!--div>
    <NuxtWelcome />
  </!--div-->
</template>
<script lang="ts" setup>
import { PerspectiveCamera, Scene, WebGLRenderer } from "three";
const glcanvas: Ref<HTMLCanvasElement | null> = ref(null);
const camera = new PerspectiveCamera(60, 4 / 3, 0.5, 500);
// camera.updateProjectionMatrix()
const scene = new Scene();
camera.position.z = 100;
let animationFrameHandle: number | null = null;
let renderer: WebGLRenderer;
onMounted(() => {
  console.debug("Canvas at", glcanvas.value)
  renderer = new WebGLRenderer({
    canvas: glcanvas.value!,
  });
  renderer.setSize(450, 300)
  
  renderer.setClearColor(0xffff00, 1);
  updateGraphics();
});

onBeforeUnmount(() => {
  if (animationFrameHandle != null) cancelAnimationFrame(animationFrameHandle);
});
function updateGraphics() {
  renderer.render(scene, camera);
  animationFrameHandle = requestAnimationFrame(() => updateGraphics());
}
// import Algebra from 'ts-geometric-algebra';

// const Complex = Algebra(0, 1)
// const a = new Complex([3, 2])
// const b = new Complex([-3,5])
// console.log("Is this a complex number", a, b)
// console.log("I'm here")
</script>
<style lang="scss">
@use "./settings";

#glcanvas {
  width: 450px;
  height: 300px;
  // background-color: red;
  border: 2px solid red;
}
</style>
