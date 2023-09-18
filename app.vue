<template>
  <v-btn>Hans Here</v-btn>
  <v-icon>mdi-wifi-alert</v-icon>
  <div>
  <canvas id="glcanvas" ref="glcanvas"></canvas>
</div>
  <!--div>
    <NuxtWelcome />
  </!--div-->
</template>
<script lang="ts" setup>
import { Color, PerspectiveCamera, Scene, WebGLRenderer, BoxGeometry, MeshBasicMaterial, Mesh, TorusGeometry } from "three";
const glcanvas: Ref<HTMLCanvasElement | null> = ref(null);
let camera: PerspectiveCamera
const scene = new Scene();
scene.background = new Color('skyblue')

let animationFrameHandle: number | null = null;

const geometry = new BoxGeometry(2,2,2)
const material = new MeshBasicMaterial({color: '#433F81'})
const cube = new Mesh(geometry, material)

const torusGeometry = new TorusGeometry(26, 3, 10)
const torusMaterial = new MeshBasicMaterial({color: 'black'})
const tire = new Mesh(torusGeometry, torusMaterial)
scene.add(cube)
scene.add(tire)
let renderer: WebGLRenderer;
onMounted(() => {
  console.debug("Canvas at", glcanvas.value)
  const canvasHeight = glcanvas.value!.clientHeight
  const canvasWidth = glcanvas.value!.clientWidth
  camera = new PerspectiveCamera(45, canvasWidth/canvasHeight, 0.1, 1000);
  camera.position.set(0,0,100);  renderer = new WebGLRenderer({
    canvas: glcanvas.value!,
    antialias: true,
  });
  renderer.setSize(glcanvas.value?.clientWidth ?? 450, glcanvas.value?.clientHeight ?? 300)
  
  renderer.setClearColor(0xffff00, 1);
  updateGraphics();
});

onBeforeUnmount(() => {
  if (animationFrameHandle != null) cancelAnimationFrame(animationFrameHandle);
});
function updateGraphics() {
  renderer.render(scene, camera);
  cube.rotation.x += 0.01
  cube.rotation.y += 0.01
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
// @use "./settings";

#glcanvas {
  width: 450px;
  height: 300px;
  // background-color: red;
  border: 2px solid red;
}
</style>
