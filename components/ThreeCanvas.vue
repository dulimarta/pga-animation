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
  SphereGeometry,
} from "three";
import Algebra from "ganja.js";
import { usePGAStore } from "~/store/pga-store";
import { storeToRefs } from "pinia";
const { makePoint, makeDirection, makeRotor, parsePGALine, parsePGAPlane } = usePGA3D();
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
  showGeometry,
} = storeToRefs(PGAStore);
let driveWheelAngle = 0;
let driveWheelAngularVelocity = 0;
let driveWheelAngularIncrement = 0;
let steeringWheelAngle = 0;
let previousTimeStamp = 0;
let lastInterpolatedTorque = 0;
let currInterpolatedTorque = 0;
let lastInputTorque = 0;
let renderer: WebGLRenderer;
let bike: Group;
let driveWheel: Group;
let steeringWheel: Group;
let rotationalMotion = false;
let rigidRotationRadius = Number.POSITIVE_INFINITY
let rigidRotationAngle = 0
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
const rearWheelCtr = makePoint(0, 0, WHEEL_RADIUS);
const bikeForwardDirection = makeDirection(1, 0, 0);
const bikeSideDirection = makeDirection(0,1,0)
// Join the center of the rear wheel with a forward vector to make a line
const rearWheelPlaneNormal = rearWheelCtr.Vee(bikeForwardDirection).Normalized;
// Create a plane thru the rear wheel hub, perpendicular to the normal
const bikePlaneNormal = rearWheelCtr.Vee(bikeSideDirection).Normalized
let rearWheelPlane = rearWheelCtr.Dot(rearWheelPlaneNormal);
let bikeFramePlane = rearWheelCtr.Dot(bikePlaneNormal)

// Repeat the process for the front wheel
makePoint(10, 20, 30);
const frontWheelCtr = makePoint(WHEEL_BASE, 0, WHEEL_RADIUS);
// const frontHub = makeSphere(2)
// frontHub.position.set(WHEEL_BASE, 0, WHEEL_RADIUS)
// scene.add(frontHub)
const frontWheelPlaneNormal =
  frontWheelCtr.Vee(bikeForwardDirection).Normalized;
let frontWheelPlane = frontWheelCtr.Dot(frontWheelPlaneNormal);
// let rotatedFrontPlane = frontWheelPlane;
const upDirection = makeDirection(0, 0, 1);
const steeringAxis = frontWheelCtr.Vee(upDirection).Normalized;
parsePGALine("Steering axis", steeringAxis);
console.debug(
  "Steering axis",
  steeringAxis,
  steeringAxis.toString(),
  "FW plane",
  frontWheelPlane.toString()
);
const rotAxisObj = makePipe(20, 0.5, "green");
rotAxisObj.rotateX(MathUtils.degToRad(90));
// scene.add(rotAxisObj)
// render(scene, rearWheelCtr)
let bikeRigidRotationAxis = frontWheelPlane.Wedge(rearWheelPlane).Normalized;
parsePGALine("Rigid rotation axis", bikeRigidRotationAxis);
let steeringRotor = PGA3D.Mul(MathUtils.degToRad(1), steeringAxis).Exp()
  .Normalized;
const rearPlane = new Plane(
  new Vector3(rearWheelPlane.e1, rearWheelPlane.e2, rearWheelPlane.e3),
  rearWheelPlane.e0
);
const rearPlaneHelper = new PlaneHelper(rearPlane, 30, 0xff0000);

const frontPlane = new Plane(
  new Vector3(frontWheelPlane.e1, frontWheelPlane.e2, frontWheelPlane.e3),
  frontWheelPlane.e0
);
const frontPlaneHelper = new PlaneHelper(frontPlane, 30, 0xffff00);
const bikePlane = new Plane(
  new Vector3(bikeFramePlane.e1, bikeFramePlane.e2, bikeFramePlane.e3),
  bikeFramePlane.e0
)
const bikePlaneHelper = new PlaneHelper(bikePlane, 30, 0x00FF00)
// frontHub.add(frontPlaneHelper)
if (showGeometry.value) {
  scene.add(rearPlaneHelper);
  scene.add(frontPlaneHelper);
  scene.add(bikePlaneHelper)
}

watch(
  () => showGeometry.value,
  (showGeo: boolean) => {
    console.debug("Geometry control", showGeo);
    if (showGeo) {
      scene.add(frontPlaneHelper);
      scene.add(rearPlaneHelper);
      scene.add(bikePlaneHelper)
    } else {
      scene.remove(frontPlaneHelper);
      scene.remove(rearPlaneHelper);
      scene.remove(bikePlaneHelper)
    }
  }
);

// Steering Angle watcher
watch(
  () => steerAngle.value,
  (steer: number, oldSteer: number) => {
    console.debug(`Steering angle changed from ${oldSteer} to ${steer}`)
    const steerDelta = steer - oldSteer
    steeringRotor = makeRotor(steeringAxis, MathUtils.degToRad(-steerDelta));

    if (steer === 0) {
      if (rotationalMotion) scene.remove(rotAxisObj);
      rotationalMotion = false;
      bikeRigidRotationAxis = null;
      rigidRotationRadius = Number.POSITIVE_INFINITY
    } else {
      if (!rotationalMotion) scene.add(rotAxisObj);
      rotationalMotion = true;
      parsePGAPlane("Steering plane", frontWheelPlane);

      frontWheelPlane = steeringRotor
        .Mul(frontWheelPlane)
        .Mul(steeringRotor.Reverse);
      parsePGAPlane("Steering plane (rotated)", frontWheelPlane);
      const nx = frontWheelPlane.e1
      const ny = frontWheelPlane.e2;
      const nz = frontWheelPlane.e3;
      frontPlane.normal.set(nx, ny, nz);
      frontPlane.constant = frontWheelPlane.e0;
      const ax = frontWheelPlane.Wedge(rearWheelPlane).Normalized;
      let rigidBodyRotationCenter
      console.debug("Front and Re.r Plane intersection #1", ax, ax.toString());
      if (steer < 0) {
        rigidBodyRotationCenter = makePoint(ax[6], -ax[5], ax[7]);
        rotAxisObj.position.set(ax[6], -ax[5], ax[7]);
      } else {
        rigidBodyRotationCenter = makePoint(-ax[6], ax[5], -ax[7]);
        rotAxisObj.position.set(-ax[6], ax[5], -ax[7]);
      }
      bikeRigidRotationAxis =
        rigidBodyRotationCenter.Vee(upDirection).Normalized;
      // console.debug("Front and Rear Plane intersection #2", bikeRigidRotationAxis, bikeRigidRotationAxis.toString())
      parsePGALine("Bike rigid rotation axis", bikeRigidRotationAxis);
      rigidRotationRadius = rearWheelCtr.Vee(bikeRigidRotationAxis).Length
      console.debug("Rigid rotation radius", rigidRotationRadius)
    }
  }
);

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
  camera.position.set(1.5 * WHEEL_BASE, 100, 50);
  camera.up.set(0, 0, 1);
  camera.lookAt(WHEEL_BASE / 2, 0, 5);
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
  driveWheelAngularVelocity += driveWheelAngularVelocityGain; // radians/sec
  // prevent the vehicle from moving backward
  // if (driveWheelAngularVelocity < 0) driveWheelAngularVelocity = 0;
  const elapsed = (timeStamp - previousTimeStamp) / 1000;
  driveWheelAngularIncrement = driveWheelAngularVelocity * elapsed; // radians
  if (rigidRotationRadius !== Number.POSITIVE_INFINITY) {
    const linearDistanceIncrement = driveWheelAngularIncrement * (WHEEL_RADIUS + TIRE_TUBE_RADIUS)
    rigidRotationAngle = linearDistanceIncrement / rigidRotationRadius
  }
  const bodyAngularVelocity =
    (WHEEL_RADIUS / WHEEL_BASE) *
    tanSteerAngle.value *
    driveWheelAngularVelocity;
  const bodyLinearVelocity = WHEEL_RADIUS * driveWheelAngularVelocity;
  bodyRotation.value += bodyAngularVelocity * elapsed; // radians
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
    driveWheelAngularIncrement * Math.cos(MathUtils.degToRad(steerAngle.value));
  driveWheelAngle = driveWheelAngle + driveWheelAngularIncrement;
  previousTimeStamp = timeStamp;
}

function updateGraphics(timeStamp: number) {
  // console.debug("Angular velo", driveWheelAngularVelocity)
  if (playAnimation.value) {
    run_integrator(timeStamp);
    driveWheel.rotation.z = -driveWheelAngle;
    steeringWheel.rotation.y = -MathUtils.degToRad(steerAngle.value);
    steeringWheel.rotation.z = -steeringWheelAngle;
    bike.position.x = bodyPosition.value.x;
    bike.position.y = bodyPosition.value.y;
    bike.rotation.z = -bodyRotation.value;
    if (driveWheelAngularIncrement !== 0) {
      const bikeRigidMotionRotor = makeRotor(
        bikeRigidRotationAxis,
        rigidRotationAngle // radians
      );
      console.debug("Bike rigid motion rotor");
      const rotatedFrontWheelPlane = bikeRigidMotionRotor
        .Mul(frontWheelPlane)
        .Mul(bikeRigidMotionRotor.Reverse);
      frontPlane.normal.set(
        rotatedFrontWheelPlane.e1,
        rotatedFrontWheelPlane.e2,
        rotatedFrontWheelPlane.e3
      );
      frontPlane.constant = rotatedFrontWheelPlane.e0;
      frontWheelPlane = rotatedFrontWheelPlane;
      // Update rear wheel plane
      const rotatedRearWheelPlane = bikeRigidMotionRotor
        .Mul(rearWheelPlane)
        .Mul(bikeRigidMotionRotor.Reverse);
      rearPlane.normal.set(
        rotatedRearWheelPlane.e1,
        rotatedRearWheelPlane.e2,
        rotatedRearWheelPlane.e3
      );
      rearPlane.constant = rotatedRearWheelPlane.e0;
      rearWheelPlane = rotatedRearWheelPlane;
    } else {
      
    }

    animationFrameHandle = requestAnimationFrame((t) => updateGraphics(t));
  }
  previousTimeStamp = timeStamp;
  renderer.render(scene, camera);
}

function makeBike(): Group {
  const bikeGroup = new Group();
  // bikeFrame.add(new AxesHelper(24))
  // X-positive is forward travel direction
  driveWheel = makeTire(TIRE_RADIUS, TIRE_TUBE_RADIUS);
  // driveWheel.position.x = WHEEL_BASE;
  bikeGroup.add(driveWheel);
  steeringWheel = makeTire(TIRE_RADIUS, TIRE_TUBE_RADIUS);
  steeringWheel.translateX(WHEEL_BASE);
  bikeGroup.add(steeringWheel);
  // bikeFrame.rotation.z = Math.PI / 4;
  const bikeFrame = new Group();
  bikeGroup.add(bikeFrame);
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
  bikeFrame.translateX(WHEEL_BASE / 2);
  //   const rearAxlePoints: Array<Vector3> = []
  // rearAxlePoints.push(
  //   new Vector3(-WHEEL_BASE / 2, -40, WHEEL_RADIUS),
  //   new Vector3(-WHEEL_BASE / 2, 40, WHEEL_RADIUS))
  // const rearAxleGeo = new BufferGeometry().setFromPoints(rearAxlePoints)
  // const rearAxle = new Line(rearAxleGeo, new LineBasicMaterial({color: 0xFF0000}))
  // bikeFrame.add(rearAxle)
  return bikeGroup;
}

function makeSphere(radius: number, color?: string): Mesh {
  const sphereGeo = new SphereGeometry(radius, 20, 10);
  const sphereMat = new MeshPhongMaterial({ color: color ?? "grey" });
  return new Mesh(sphereGeo, sphereMat);
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
