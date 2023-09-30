import { TextureLoader } from 'three';
<template>
  <canvas ref="glcanvas" id="glcanvas" />
</template>
<script setup lang="ts">
import {
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  Mesh,
  TorusGeometry,
  Group,
  CylinderGeometry,
  Matrix4,
  MathUtils,
  AxesHelper,
  PlaneGeometry,
  TextureLoader,
  AmbientLight,
RepeatWrapping,
PointLight,
MeshPhongMaterial,
MeshStandardMaterial,
BasicShadowMap,
} from "three";
import { usePGAStore } from "~/store/pga-store";
import { storeToRefs } from "pinia";
import { mul } from "ts-geometric-algebra";
const glcanvas: Ref<HTMLCanvasElement | null> = ref(null);
const PGAStore = usePGAStore();
const TIRE_RADIUS = 13;
const TIRE_TUBE_RADIUS = 1.5;
const WHEEL_BASE = 48; // inches

const WHEEL_RADIUS = TIRE_RADIUS + TIRE_TUBE_RADIUS;

let camera: PerspectiveCamera;
let animationFrameHandle: number | null = null;
let { driveWheelSpeed, steerAngle, bodyPosition } = storeToRefs(PGAStore);
let speedFlipFactor = 1;
let bodyRotation = 0;
// let bodyXPosition = 0;
// let bodyYPosition = 0;
let driveWheelAngle = 0;
// let tirePosition = 0;
let previousTimeStamp = 0;

let renderer: WebGLRenderer;
let bike: Group;
let driveWheel: Group;
let steeringWheel: Group;

const textureLoader = new TextureLoader();
const scene = new Scene();
scene.add(new AxesHelper(12));
scene.add(new AmbientLight());
const light = new PointLight(0xffffff, 10000)
// light.target.position.set(0,0,30)
light.position.set(0, 40, 80)
light.castShadow = true
// scene.add(light)
// scene.add(new PointLightHelper(light, 3))
// scene.background = new Color("skyblue");
const driveAngularVelocity = computed(
  // 2 * PI * RotationPerMinute / 60 radians/second
  () => (Math.PI * driveWheelSpeed.value) / 30
);
const tanSteerAngle = computed(() =>
  Math.tan((Math.PI * steerAngle.value) / 180)
);
onMounted(async () => {
  const floorTexture = await textureLoader.loadAsync("floor-wood.jpg");
  floorTexture.wrapS = RepeatWrapping
  floorTexture.wrapT = RepeatWrapping
  floorTexture.repeat.set(5,5)
  // console.debug("Texture", marbleTexture);
  const groundPlane = new PlaneGeometry(1000, 1000, 100, 100);
  const groundMaterial = new MeshStandardMaterial({
    map: floorTexture,
    // color: 'blue'
  });
  const ground = new Mesh(groundPlane, groundMaterial);
  ground.receiveShadow = true
  ground.castShadow = false
  // ground.add(new AxesHelper(6))
  scene.add(ground);
  // console.debug("Canvas at", glcanvas.value);
  const canvasHeight = glcanvas.value!.clientHeight;
  const canvasWidth = glcanvas.value!.clientWidth;
  camera = new PerspectiveCamera(45, canvasWidth / canvasHeight, 0.1, 1000);
  camera.position.set(50, 100, 50);
  camera.up.set(0, 0, 1);
  camera.lookAt(0, 0, 0);
  bike = makeBike();
  bike.add(camera);
  bike.add(light)
  scene.add(bike);
  renderer = new WebGLRenderer({
    canvas: glcanvas.value!,
    antialias: true,
  });
  renderer.shadowMap.enabled = true
  // renderer.shadowMap.type = BasicShadowMap
  renderer.setSize(
    glcanvas.value?.clientWidth ?? 800,
    glcanvas.value?.clientHeight ?? 600
  );

  renderer.setClearColor(Math.random() * 0xFFFFFF, 1);
  // if (animationFrameHandle != null) cancelAnimationFrame(animationFrameHandle);
  updateGraphics(0);
});

onBeforeUnmount(() => {
  if (animationFrameHandle != null) cancelAnimationFrame(animationFrameHandle);
});

function run_integrator(timeStamp: number /* in milliseconds */) {
  const elapsed = (timeStamp - previousTimeStamp) / 1000;
  const bodyAngularVelocity =
    (WHEEL_RADIUS / WHEEL_BASE) *
    tanSteerAngle.value *
    driveAngularVelocity.value;
  const bodyLinearVelocity = WHEEL_RADIUS * driveAngularVelocity.value;
  bodyRotation += bodyAngularVelocity * elapsed;
  if (Math.abs(bodyAngularVelocity) < 1e-6) {
    bodyPosition.value.x += Math.cos(bodyRotation) * elapsed * bodyLinearVelocity;
    bodyPosition.value.y -= Math.sin(bodyRotation) * elapsed * bodyLinearVelocity;
  } else {
    const multiplier = bodyLinearVelocity / bodyAngularVelocity;
    bodyPosition.value.x +=
      multiplier *
      (Math.sin(bodyRotation + elapsed * bodyAngularVelocity) -
        Math.sin(bodyRotation));
    bodyPosition.value.y -=
      multiplier *
      (-Math.cos(bodyRotation + elapsed * bodyAngularVelocity) +
        Math.cos(bodyRotation));
  }
  driveWheelAngle =
    driveWheelAngle - speedFlipFactor * driveAngularVelocity.value * elapsed;
  previousTimeStamp = timeStamp;
}
function updateGraphics(timeStamp: number) {
  run_integrator(timeStamp);
  driveWheel.rotation.z = driveWheelAngle;

  steeringWheel.rotation.z = driveWheelAngle // Math.cos(MathUtils.degToRad(steerAngle.value));
  steeringWheel.rotation.y = -MathUtils.degToRad(steerAngle.value);
  bike.position.x = bodyPosition.value.x;
  bike.position.y = bodyPosition.value.y;
  bike.rotation.z = -bodyRotation;
  renderer.render(scene, camera);
  animationFrameHandle = requestAnimationFrame((t) => updateGraphics(t));
}
// import Algebra from 'ts-geometric-algebra';

// const Complex = Algebra(0, 1)
// const a = new Complex([3, 2])
// const b = new Complex([-3,5])
// console.log("Is this a complex number", a, b)
// console.log("I'm here")

function makeBike(): Group {
  const bikeFrame = new Group();
  // bikeFrame.add(new AxesHelper(24))
  // X-positive is forward travel direction
  driveWheel = makeTire(TIRE_RADIUS, TIRE_TUBE_RADIUS);
  driveWheel.position.x = -WHEEL_BASE / 2;
  bikeFrame.add(driveWheel);
  steeringWheel = makeTire(TIRE_RADIUS, TIRE_TUBE_RADIUS);
  steeringWheel.translateX(WHEEL_BASE / 2);
  bikeFrame.add(steeringWheel);
  // bikeFrame.rotation.z = Math.PI / 4;
  const seatTube = makePipe(24, 1, "red");
  seatTube.rotateX(Math.PI / 2)
  seatTube.translateY(12 + TIRE_RADIUS)
  seatTube.rotateZ(MathUtils.degToRad(15))
  seatTube.translateX(-8)
  // seatTube.add(new AxesHelper(10));
  bikeFrame.add(seatTube);
  const downTube = makePipe(33, 1, 'red')
  downTube.rotateX(MathUtils.degToRad(90))
  downTube.translateY(9 + TIRE_RADIUS)
  downTube.translateX(7)
  downTube.rotateZ(MathUtils.degToRad(-45))
  bikeFrame.add(downTube)
  const topTube = makePipe(29, 1, 'red')
  topTube.rotateZ(MathUtils.degToRad(90))
  topTube.translateZ(33)
  topTube.translateY(-4)
  bikeFrame.add(topTube)
  // bikeFrame.position.x = 10
  return bikeFrame;
}
function makePipe(
  pipeLength: number,
  pipeRadius: number,
  color?: string
): Mesh {
  const cylinderGeometry = new CylinderGeometry(
    pipeRadius,
    pipeRadius,
    pipeLength
  );
  const cylinderMaterial = new MeshPhongMaterial({ color: color ?? "grey" });
  const mesh = new Mesh(cylinderGeometry, cylinderMaterial);
  mesh.castShadow = true
  // mesh.add(new AxesHelper(12))
  return mesh
}

function makeTire(tireRadius: number, tubeRadius: number): Group {
  const NUM_SPOKES = 5;
  const tireGroup = new Group();
  tireGroup.translateZ(tubeRadius + tireRadius);
  tireGroup.rotateX(Math.PI / 2);
  // tireGroup.add(new AxesHelper(10))
  const torusGeometry = new TorusGeometry(tireRadius, tubeRadius, 10);
  const torusMaterial = new MeshPhongMaterial({ color: 0x555555 });
  const tire = new Mesh(torusGeometry, torusMaterial);
  tire.castShadow = true
  tireGroup.add(tire);
  const translation = new Matrix4().makeTranslation(0, tireRadius / 2, 0);
  const rotation = new Matrix4();
  for (let k = 0; k < NUM_SPOKES; k++) {
    const spoke = makePipe(tireRadius, 0.6 * tubeRadius, "white");
    rotation.makeRotationZ((k * 2 * Math.PI) / NUM_SPOKES);
    spoke.applyMatrix4(translation);
    spoke.applyMatrix4(rotation);
    tireGroup.add(spoke);
  }
  return tireGroup;
}
</script>
<style lang="scss">
#glcanvas {
  width: 800px;
  height: 600px;
  // border: 2px solid red;
}
</style>
