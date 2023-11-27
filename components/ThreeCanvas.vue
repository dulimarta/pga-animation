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
  Plane,
  MeshPhongMaterial,
  MeshStandardMaterial,
  Vector2,
  Vector3,
  BufferGeometry,
  Line,
  LineBasicMaterial,
  PlaneHelper,
} from "three";
import Algebra from "ganja.js";
import { usePGAStore } from "~/store/pga-store";
import { storeToRefs } from "pinia";
const { makePoint, makeDirection, makePlane, makeMotor, render } = usePGA3D();
const glcanvas: Ref<HTMLCanvasElement | null> = ref(null);
const PGAStore = usePGAStore();
const PGA3D = Algebra(3, 0, 1);
const TIRE_RADIUS = 13;
const TIRE_TUBE_RADIUS = 1.5;
const WHEEL_BASE = 48; // inches
const DRIVE_WHEEL_MASS = 200;
const DRIVE_WHEEL_INERTIA = 250;
const TOTAL_WHEEL_INERTIA =
  DRIVE_WHEEL_INERTIA +
  DRIVE_WHEEL_MASS * Math.pow(TIRE_RADIUS + TIRE_TUBE_RADIUS, 2);

const WHEEL_RADIUS = TIRE_RADIUS + TIRE_TUBE_RADIUS;
const ALPHA = 0.5; // Input averaging factor
let camera: PerspectiveCamera;
let animationFrameHandle: number | null = null;
let {
  driveWheelTorque,
  steerAngle,
  bodyPosition,
  playAnimation,
  bodyRotation,
} = storeToRefs(PGAStore);
let driveWheelAngle = 0;
let driveWheelAngularVelocity = 0;
let steeringWheelAngle = 0;
let previousTimeStamp = 0;
let lastInterpolatedTorque = 0;
let currInterpolatedTorque = 0;
let lastInputTorque = 0;
let renderer: WebGLRenderer;
let bike: Group;
let driveWheel: Group;
let steeringWheel: Group;
const textureLoader = new TextureLoader();
const scene = new Scene();
scene.add(new AxesHelper(12));
scene.add(new AmbientLight());
const light = new PointLight(0xffffff, 10000);
// light.target.position.set(0,0,30)
light.position.set(0, 40, 80);
light.castShadow = true;
// scene.add(light)
// scene.add(new PointLightHelper(light, 3))
// scene.background = new Color("skyblue");
const tanSteerAngle = computed(() =>
  Math.tan(MathUtils.degToRad(steerAngle.value))
);
const rearWheelCtr = makePoint(-WHEEL_BASE / 2, 0, WHEEL_RADIUS);
const bikeDirection = makeDirection(1, 0, 0);
const rearWheelPlaneNormal = rearWheelCtr.Vee(bikeDirection);
const rearWheelPlane = rearWheelCtr.Dot(rearWheelPlaneNormal);
const frontWheelCtr = makePoint(WHEEL_BASE / 2, 0, WHEEL_RADIUS);
let frontWheelPlane = frontWheelCtr.Dot(rearWheelPlaneNormal);
const upDirection = makeDirection(0, 0, 1);
const steeringAxis = frontWheelCtr.Vee(upDirection);
console.debug(
  "Steering axis",
  steeringAxis,
  "FW plane",
  frontWheelPlane.toString()
);
const rotAxisObj = makePipe(20, 0.5, "green")
rotAxisObj.rotateX(MathUtils.degToRad(90))
scene.add(rotAxisObj)
// render(scene, rearWheelCtr)
let bikeRigidRotationAxis: any | null = null;
let steeringRotor = PGA3D.Mul(MathUtils.degToRad(1), steeringAxis).Exp();
addPGAPlane(rearWheelPlane);
const frontPlane = addPGAPlane(frontWheelPlane);
const planeIntersection = frontWheelPlane.Wedge(rearWheelPlane);
if (isProperLine(planeIntersection)) {
  bikeRigidRotationAxis = planeIntersection;
  console.debug(
    "Bike rotation axis",
    bikeRigidRotationAxis,
    bikeRigidRotationAxis.toString()
  );
  addPGALine(bikeRigidRotationAxis);
} else {
  bikeRigidRotationAxis = null;
}

// render(scene, rearWheelPlane)
// const x = render(scene, frontWheelPlane) as PlaneHelper
// const xp = x.plane
// const rearAxle = rearWheelCtr.Vee(rearAxleDirection).Normalized
// const rearPlane = makePlane(1, 2, 3, -WHEEL_BASE / 2)

// render(scene, rearAxle)
// render(scene, rearPlane)
// const Q = makePoint(2, 2, 3)
// const line = P.Vee(Q)
// console.debug("Rear axle", rearAxle.toString(), rearAxle.Grade(2))

watch(
  () => steerAngle.value,
  (steer: number) => {
    steeringRotor = makeMotor(
      steeringAxis,
      MathUtils.degToRad(-steerAngle.value)
    );

    // steeringRotor = Math.E**(MathUtils.degToRad(steerAngle.value) * steeringAxis)
    const rotated = steeringRotor
      .Mul(frontWheelPlane)
      .Mul(steeringRotor.Reverse);
    const distanceToOrig = rotated[1];
    const nx = rotated[2];
    const ny = rotated[3];
    const nz = rotated[4];
    frontPlane.normal.set(nx, ny, nz);
    frontPlane.constant = distanceToOrig;
    const ax = rotated.Wedge(rearWheelPlane).Normalized;
    console.debug(`Steer angle changed to ${steer} degrees`);
    parsePGALine(ax);
    if (steerAngle.value < 0)
      rotAxisObj.position.set(ax[6], -ax[5], ax[7])
    else
    rotAxisObj.position.set(-ax[6], ax[5], ax[7])
  }
);

function addPGAPlane(elem: any) {
  const distance = elem[1];
  const nx = elem[2];
  const ny = elem[3];
  const nz = elem[4];
  const plane = new Plane(new Vector3(nx, ny, nz), distance);
  const planeHelper = new PlaneHelper(plane, 20, 0xffff00);
  scene.add(planeHelper);
  return plane;
}

function parsePGALine(elem: any) {
  const thru_y = -elem[5];
  const thru_x = elem[6];
  const thru_z = elem[7];
  if (
    Math.abs(thru_x) > 1e-5 ||
    Math.abs(thru_y) > 1e-5 ||
    Math.abs(thru_z) > 1e-5
  ) {
    const dx = elem[8]; // pos
    const dy = elem[9];
    const dz = elem[10];
    console.debug(
      `Line thru (${thru_x},${thru_y}, ${thru_z}) with direction [${dx},${dy},${dz}]`
    );
  } else {
    console.error("Ideal line at infinity");
  }
}

function isProperLine(elem: any): boolean {
  const thru_x = elem[10];
  const thru_y = -elem[9];
  const thru_z = elem[8];
  return (
    Math.abs(thru_x) > 1e-5 ||
    Math.abs(thru_y) > 1e-5 ||
    Math.abs(thru_z) > 1e-5
  );
}

function addPGALine(elem: any) {}
onMounted(async () => {
  const floorTexture = await textureLoader.loadAsync("floor-wood.jpg");
  floorTexture.wrapS = RepeatWrapping;
  floorTexture.wrapT = RepeatWrapping;
  floorTexture.repeat.set(5, 5);
  // console.debug("Texture", marbleTexture);
  const groundPlane = new PlaneGeometry(1000, 1000, 100, 100);
  const groundMaterial = new MeshStandardMaterial({
    map: floorTexture,
    // color: 'blue'
  });
  const ground = new Mesh(groundPlane, groundMaterial);
  ground.receiveShadow = true;
  ground.castShadow = false;
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
  bike.add(light);
  // scene.add(camera)
  scene.add(bike);
  renderer = new WebGLRenderer({
    canvas: glcanvas.value!,
    antialias: true,
  });
  renderer.shadowMap.enabled = true;
  // renderer.shadowMap.type = BasicShadowMap
  renderer.setSize(
    glcanvas.value?.clientWidth ?? 800,
    glcanvas.value?.clientHeight ?? 600
  );

  renderer.setClearColor(Math.random() * 0xffffff, 1);
  // if (animationFrameHandle != null) cancelAnimationFrame(animationFrameHandle);
  updateGraphics(0);
});

onBeforeUnmount(() => {
  if (animationFrameHandle != null) cancelAnimationFrame(animationFrameHandle);
});

// Bicycle Riding Model: https://ciechanow.ski/bicycle/
function run_integrator(timeStamp: number /* in milliseconds */) {
  lastInterpolatedTorque = currInterpolatedTorque; // f_{k-1+alpha}
  currInterpolatedTorque =
    ALPHA * lastInputTorque + ((1 - ALPHA) * driveWheelTorque.value) / 10; // f_{k+alpha}
  lastInputTorque = driveWheelTorque.value / 10; // f_{k-1} = f_k
  const driveWheelMomentum =
    timeStamp *
    (ALPHA * lastInterpolatedTorque + (1 - ALPHA) * currInterpolatedTorque);
  const driveWheelAngularVelocityGain =
    driveWheelMomentum / TOTAL_WHEEL_INERTIA;
  driveWheelAngularVelocity += driveWheelAngularVelocityGain;
  // prevent the vehicle from moving backward
  if (driveWheelAngularVelocity < 0) driveWheelAngularVelocity = 0;
  const elapsed = (timeStamp - previousTimeStamp) / 1000;
  const bodyAngularVelocity =
    (WHEEL_RADIUS / WHEEL_BASE) *
    tanSteerAngle.value *
    driveWheelAngularVelocity;
  const bodyLinearVelocity = WHEEL_RADIUS * driveWheelAngularVelocity;
  bodyRotation.value += bodyAngularVelocity * elapsed;
  if (Math.abs(bodyAngularVelocity) < 1e-6) {
    bodyPosition.value.x +=
      Math.cos(bodyRotation.value) * elapsed * bodyLinearVelocity;
    bodyPosition.value.y -=
      Math.sin(bodyRotation.value) * elapsed * bodyLinearVelocity;
  } else {
    const multiplier = bodyLinearVelocity / bodyAngularVelocity;
    bodyPosition.value.x +=
      multiplier *
      (Math.sin(bodyRotation.value + elapsed * bodyAngularVelocity) -
        Math.sin(bodyRotation.value));
    bodyPosition.value.y -=
      multiplier *
      (-Math.cos(bodyRotation.value + elapsed * bodyAngularVelocity) +
        Math.cos(bodyRotation.value));
  }
  // Keep separate rotation accumulators for the steering wheel and drive wheel
  steeringWheelAngle =
    steeringWheelAngle +
    driveWheelAngularVelocity *
      elapsed *
      Math.cos(MathUtils.degToRad(steerAngle.value));
  driveWheelAngle = driveWheelAngle + driveWheelAngularVelocity * elapsed;
  previousTimeStamp = timeStamp;
}

function updateGraphics(timeStamp: number) {
  if (playAnimation.value) run_integrator(timeStamp);
  else previousTimeStamp = timeStamp;
  driveWheel.rotation.z = -driveWheelAngle;
  steeringWheel.rotation.y = -MathUtils.degToRad(steerAngle.value);
  steeringWheel.rotation.z = -steeringWheelAngle;
  bike.position.x = bodyPosition.value.x;
  bike.position.y = bodyPosition.value.y;
  bike.rotation.z = -bodyRotation.value;
  renderer.render(scene, camera);
  animationFrameHandle = requestAnimationFrame((t) => updateGraphics(t));
}

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
  seatTube.rotateX(Math.PI / 2);
  seatTube.translateY(12 + TIRE_RADIUS);
  seatTube.rotateZ(MathUtils.degToRad(15));
  seatTube.translateX(-8);
  // seatTube.add(new AxesHelper(10));
  bikeFrame.add(seatTube);
  const downTube = makePipe(33, 1, "red");
  downTube.rotateX(MathUtils.degToRad(90));
  downTube.translateY(9 + TIRE_RADIUS);
  downTube.translateX(7);
  downTube.rotateZ(MathUtils.degToRad(-45));
  bikeFrame.add(downTube);
  const topTube = makePipe(29, 1, "red");
  topTube.rotateZ(MathUtils.degToRad(90));
  topTube.translateZ(33);
  topTube.translateY(-4);
  bikeFrame.add(topTube);
  // bikeFrame.position.x = 10
  //   const rearAxlePoints: Array<Vector3> = []
  // rearAxlePoints.push(
  //   new Vector3(-WHEEL_BASE / 2, -40, WHEEL_RADIUS),
  //   new Vector3(-WHEEL_BASE / 2, 40, WHEEL_RADIUS))
  // const rearAxleGeo = new BufferGeometry().setFromPoints(rearAxlePoints)
  // const rearAxle = new Line(rearAxleGeo, new LineBasicMaterial({color: 0xFF0000}))
  // bikeFrame.add(rearAxle)
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
  mesh.castShadow = true;
  // mesh.add(new AxesHelper(12))
  return mesh;
}

function makeTire(tireRadius: number, tubeRadius: number): Group {
  const NUM_SPOKES = 6;
  const tireGroup = new Group();
  tireGroup.translateZ(tubeRadius + tireRadius);
  tireGroup.rotateX(Math.PI / 2);
  // tireGroup.add(new AxesHelper(10))
  const torusGeometry = new TorusGeometry(tireRadius, tubeRadius, 10);
  const torusMaterial = new MeshPhongMaterial({ color: 0x555555 });
  const tire = new Mesh(torusGeometry, torusMaterial);
  tire.castShadow = true;
  tireGroup.add(tire);
  const translation = new Matrix4().makeTranslation(0, tireRadius / 2, 0);
  const rotation = new Matrix4();
  for (let k = 0; k < NUM_SPOKES; k++) {
    const spoke = makePipe(
      tireRadius,
      0.6 * tubeRadius,
      k === 0 ? "lightgreen" : "white"
    );
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
~/lib/hanspga
