import { TextureLoader } from 'three';
<template>
  <div>
    <canvas ref="glcanvas" id="glcanvas" />
  </div>
</template>
<script setup lang="ts">
import {
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  Mesh,
  Group,
  MathUtils,
  PlaneGeometry,
  TextureLoader,
  AmbientLight,
  RepeatWrapping,
  PointLight,
  Plane,
  MeshStandardMaterial,
  Vector3,
  BufferGeometry,
  Line,
  LineBasicMaterial,
  PlaneHelper,
  BufferAttribute,
  Vector2,
  MeshBasicMaterial,
  DoubleSide,
} from "three";
import { usePGAStore } from "~/store/pga-store";
import { useVisualStore } from "~/store/visual-store";
import { storeToRefs } from "pinia";
import { useWindowSize, useResizeObserver } from "@vueuse/core";

const {
  makePoint,
  makeDirection,
  makePlane,
  makeRotor,
  parsePGAPoint,
  parsePGALine,
  parsePGAPlane,
} = usePGA3D();
const glcanvas: Ref<HTMLCanvasElement | null> = ref(null);
const PGAStore = usePGAStore();
const TIRE_RADIUS = 13; // inches
const TIRE_TUBE_RADIUS = 1.5; // inches
const INCH_TO_METER = 0.0254;
const WHEEL_BASE = 48; // inches
const DRIVE_WHEEL_MASS = 2; // in kilogram
const DRIVE_WHEEL_INERTIA = 3; // kg m^2
const TOTAL_INERTIA =
  DRIVE_WHEEL_INERTIA +
  DRIVE_WHEEL_MASS *
    Math.pow((TIRE_RADIUS + TIRE_TUBE_RADIUS) * INCH_TO_METER, 2);

const WHEEL_RADIUS = TIRE_RADIUS + TIRE_TUBE_RADIUS;
const ALPHA = 0.5; // Input averaging factor
let camera: PerspectiveCamera;
let animationFrameHandle: number | null = null;
let {
  driveWheelTorque,
  steerVelocity,
  bodyPosition,
  brakeApplied,
  bodyRotation,
  showGeometry,
  runMode,
} = storeToRefs(PGAStore);
const visualStore = useVisualStore();
const { makePipe, makeSphere, makeTire } = visualStore;
const { visualScene } = storeToRefs(visualStore);
const initialMarker = makePipe(10, 5, "purple");
let driveWheelAngle = 0;
let driveWheelAngularVelocity = 0;
// let driveWheelAngularIncrement = 0;
let steeringWheelAngle = 0;
let steerDirection = 0; // in radians
let previousTimeStamp = 0;
let lastInterpolatedTorque = 0;
let currInterpolatedTorque = 0;
let lastInputTorque = 0;
let renderer: WebGLRenderer;
let bike: Group;
let driveWheel: Group;
let steeringWheel: Group;
let steeringFork: Group = new Group();
let rotationalMotion = false;
// let rigidRotationRadius = Number.POSITIVE_INFINITY;
let rigidRotationAngleOrTranslation = 0;
const textureLoader = new TextureLoader();
const scene = new Scene();
visualScene.value = scene;
// scene.add(new AxesHelper(12));
scene.add(new AmbientLight());
const light = new PointLight(0xffffff, 10000);
// light.target.position.set(0,0,30)
light.position.set(0, 40, 80);
light.castShadow = true;
// scene.add(light)
// scene.add(new PointLightHelper(light, 3))
// scene.background = new Color("skyblue");
const bikeSideDirection = makeDirection(0, 1, 0);
let rearHub = makePoint(0, 0, 0);
let rearWheelPlane = makePlane(1, 0, 0, 0);
const frontWheelPlaneMesh = new Mesh(
  new PlaneGeometry(WHEEL_RADIUS, 1),
  new MeshBasicMaterial({
    color: 0x888800,
    side: DoubleSide,
    transparent: true,
    opacity: 0.5,
  })
);
frontWheelPlaneMesh.rotateY(Math.PI / 2);
frontWheelPlaneMesh.position.set(0, 0, WHEEL_RADIUS / 2);
const rearWheelPlaneMesh = new Mesh(
  new PlaneGeometry(WHEEL_RADIUS, 1),
  new MeshBasicMaterial({
    color: 0x880000,
    side: DoubleSide,
    transparent: true,
    opacity: 0.5,
  })
);
rearWheelPlaneMesh.rotateY(Math.PI / 2);
rearWheelPlaneMesh.position.set(0, 0, WHEEL_RADIUS / 2);

let frontHub = makePoint(WHEEL_BASE, 0, 0);
let frontWheelPlane = makePlane(1, 0, 0, -WHEEL_BASE);
let frontAxle = frontHub.Vee(bikeSideDirection);
const frontSphere = makeSphere(TIRE_TUBE_RADIUS * 2, "yellow");
const rearSphere = makeSphere(TIRE_TUBE_RADIUS * 2, "red");
frontSphere.position.set(-frontHub.e023, frontHub.e013, -frontHub.e012);
rearSphere.position.set(-rearHub.e023, rearHub.e013, -rearHub.e012);
// Join the center of the rear wheel with a forward vector to make a line
// const rearWheelPlaneNormal = rearHub.Vee(bikeForwardDirection).Normalized;
// Create a plane thru the rear wheel hub, perpendicular to the normal

// Repeat the process for the front wheel
// const frontHub = makeSphere(2)
// frontHub.position.set(WHEEL_BASE, 0, WHEEL_RADIUS)
// scene.add(frontHub)
// const frontWheelPlaneNormal =
//   frontHub.Vee(bikeForwardDirection).Normalized;
// let rotatedFrontPlane = frontWheelPlane;
const upDirection = makeDirection(0, 0, 1);
const steeringAxis = () => frontHub.Vee(upDirection).Normalized;
parsePGALine("Steering axis", steeringAxis());
// console.debug(
//   "Steering axis",
//   steeringAxis.value,
//   steeringAxis.value.toString(),
//   "FW plane",
//   frontWheelPlane.toString()
// );
const rotAxisObj = makePipe(WHEEL_RADIUS + TIRE_TUBE_RADIUS, 0.5, "green");
// rotAxisObj.add(new AxesHelper(10))
rotAxisObj.rotateX(MathUtils.degToRad(90));
// scene.add(rotAxisObj)
// render(scene, rearHub)
let bikeRigidRotationAxis = frontWheelPlane.Wedge(rearWheelPlane);
// parsePGALine("Rigid rotation axis", bikeRigidRotationAxis);
const [rearPlane, rearPlaneHelper] = makeAuxPlane(rearWheelPlane, 0xff0000);

const [frontPlane, frontPlaneHelper] = makeAuxPlane(frontWheelPlane, 0xffff00);
const [rearAxis, rearAxisVertices] = makeAuxLine(0xff0000);
const [frontAxis, frontAxisVertices] = makeAuxLine(0xffff00);

rearAxisVertices[0] = 0;
rearAxisVertices[1] = 0;
rearAxisVertices[2] = WHEEL_RADIUS;
rearAxisVertices[3] = 0;
rearAxisVertices[4] = 0;
rearAxisVertices[5] = WHEEL_RADIUS;
frontAxisVertices[0] = WHEEL_BASE;
frontAxisVertices[1] = 0;
frontAxisVertices[2] = WHEEL_RADIUS;
frontAxisVertices[3] = WHEEL_BASE;
frontAxisVertices[4] = 0;
frontAxisVertices[5] = WHEEL_RADIUS;

function removeVisualAccessories() {
  scene.remove(frontPlaneHelper);
  scene.remove(rearPlaneHelper);
  scene.remove(rotAxisObj);
  // scene.remove(frontSphere);
  // scene.remove(rearSphere);
  scene.remove(frontAxis);
  scene.remove(rearAxis);
  steeringFork.remove(frontWheelPlaneMesh);
  bike.remove(rearWheelPlaneMesh);
}
function addVisualAccessories() {
  scene.add(frontPlaneHelper);
  scene.add(rearPlaneHelper);
  scene.add(rotAxisObj);
  // scene.add(frontSphere);
  // scene.add(rearSphere);
  scene.add(frontAxis);
  scene.add(rearAxis);
  steeringFork.add(frontWheelPlaneMesh);
  bike.add(rearWheelPlaneMesh);
}
watch(
  () => runMode.value,
  (currentMode: "plan" | "run") => {
    if (currentMode == "plan") {
      if (showGeometry.value) removeVisualAccessories();
      camera.position.set(0, -500, 800);
      camera.lookAt(0, -200, 0);
      bike.remove(camera);
      scene.add(camera);
    } else {
      if (showGeometry.value) addVisualAccessories();
      camera.position.set(WHEEL_RADIUS, -100, 50);
      camera.lookAt(WHEEL_BASE / 2, 0, 5);
      scene.remove(camera);
    }

    // if (currentMode == 'plan') {
    //   scene.add(initialMarker)
    // }
  }
);

watch(
  () => showGeometry.value,
  (showGeo: boolean) => {
    if (showGeo) {
      addVisualAccessories();
    } else {
      removeVisualAccessories();
    }
  }
);

watch(
  [() => bodyPosition.value, () => bodyRotation.value],
  ([position, orientation]: [Vector2, number]) => {
    // console.debug(`Changing bike position to (${position.x},${position.y})`);
    bike.position.x = position.x;
    bike.position.y = position.y;
    bike.rotation.z = orientation;
  },
  { deep: true }
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

  camera = new PerspectiveCamera(50, 4 / 3, 0.1, 1000);
  camera.position.set(WHEEL_RADIUS, -100, 50);
  camera.up.set(0, 0, 1);
  camera.lookAt(WHEEL_BASE / 2, 0, 5);
  bike = makeBike();
  bike.add(camera);
  // steeringFork.add(frontWheelPlaneMesh);
  bike.add(light);
  scene.add(bike);
  renderer = new WebGLRenderer({
    canvas: glcanvas.value!,
    antialias: true,
  });
  renderer.shadowMap.enabled = true;
  // renderer.shadowMap.type = BasicShadowMap
  // renderer.setSize(
  //   glcanvas.value?.clientWidth ?? 400,
  //   glcanvas.value?.clientHeight ?? 300
  // );

  renderer.setClearColor(Math.random() * 0xffffff, 1);
  handleResize();
  if (showGeometry.value) {
    addVisualAccessories();
  }
  updateGraphics(0);
  window.addEventListener("resize", handleResize);
});

onBeforeUnmount(() => {
  if (animationFrameHandle != null) cancelAnimationFrame(animationFrameHandle);
});

function makeAuxPlane(pgaPlane: any, color?: number): [Plane, PlaneHelper] {
  const p = new Plane(
    new Vector3(pgaPlane.e1, pgaPlane.e2, pgaPlane.e3),
    pgaPlane.e0
  );
  const pH = new PlaneHelper(p, 29, color ?? 0x888888);
  return [p, pH];
}

function makeAuxLine(color?: number): [Line, Float32Array] {
  const geo = new BufferGeometry();
  const vertices = new Float32Array(6); // two endpoints (x,y,z)
  geo.setAttribute("position", new BufferAttribute(vertices, 3));
  geo.setDrawRange(0, 2); // Draw the first two points
  const mat = new LineBasicMaterial({ color: color ?? 0 });
  const line = new Line(geo, mat);
  return [line, vertices];
}

// Bicycle Riding Model: https://ciechanow.ski/bicycle/
function run_geometric_integrator(timeMillisec: number) {
  lastInterpolatedTorque = currInterpolatedTorque; // f_{k-1+alpha}
  currInterpolatedTorque =
    ALPHA * lastInputTorque + (1 - ALPHA) * driveWheelTorque.value; // f_{k+alpha}
  // Unit of torque is Newton.m or kg.m.sec^{-2}.m or kg.m^2.sec^{-2}
  const elapsed = (timeMillisec - previousTimeStamp) / 1000;
  lastInputTorque = driveWheelTorque.value; // f_{k-1} = f_k
  const driveWheelMomentumGain =
    elapsed *
    (ALPHA * lastInterpolatedTorque + (1 - ALPHA) * currInterpolatedTorque);
  // Unit of angular momentum is kg.m^2.sec^{-1}
  // Unit of inertia is kg.m^2
  const driveWheelAngularVelocityGain = driveWheelMomentumGain / TOTAL_INERTIA;
  // Unit of angular velocity is sec^{-1}
  driveWheelAngularVelocity += driveWheelAngularVelocityGain; // radians/sec
  // prevent the vehicle from moving backward
  if (driveWheelAngularVelocity < 0) driveWheelAngularVelocity = 0;
  const steerDirectionGain = steerVelocity.value * elapsed; // radians
  steerDirection += steerDirectionGain;
  if (Math.abs(steerVelocity.value) > 1e-3) {
    // steer angle changes
    if (Math.abs(steerDirection) < 1e-3) {
      // translational motion
      if (rotationalMotion) scene.remove(rotAxisObj);
      rotationalMotion = false;
    } else {
      // rotational motion
      if (!rotationalMotion && showGeometry.value) scene.add(rotAxisObj);
      rotationalMotion = true;
    }
    const steeringRotor = makeRotor(steeringAxis(), steerDirectionGain);
    const tempFP = steeringRotor
      .Mul(frontWheelPlane)
      .Mul(steeringRotor.Reverse);
    const tempFA = steeringRotor.Mul(frontAxle).Mul(steeringRotor.Reverse);
    // parsePGAPlane("Steering plane", frontWheelPlane);
    // parsePGALine("Front Axle", frontAxle);
    bikeRigidRotationAxis = tempFP.Wedge(rearWheelPlane);
    // parsePGALine("Plane intersection", bikeRigidRotationAxis);
    frontWheelPlane = tempFP;
    frontAxle = tempFA;
    frontPlane.normal.set(
      frontWheelPlane.e1,
      frontWheelPlane.e2,
      frontWheelPlane.e3
    );
    frontPlane.constant = frontWheelPlane.e0;
    // We HAVE TO normalized the point to include the correct scaling factor
    const rigidBodyRotationCenter = frontAxle.Wedge(rearWheelPlane).Normalized;
    // parsePGAPoint("RB rotation center", rigidBodyRotationCenter);
    const steerDirSign = Math.sign(steerDirection);
    rotAxisObj.position.set(
      -rigidBodyRotationCenter.e023 * steerDirSign,
      rigidBodyRotationCenter.e013 * steerDirSign,
      TIRE_RADIUS / 2
    );
    rearAxisVertices[0] = -rigidBodyRotationCenter.e023 * steerDirSign;
    rearAxisVertices[1] = rigidBodyRotationCenter.e013 * steerDirSign;
    rearAxis.geometry.attributes.position.needsUpdate = true;
    frontAxisVertices[0] = -rigidBodyRotationCenter.e023 * steerDirSign;
    frontAxisVertices[1] = rigidBodyRotationCenter.e013 * steerDirSign;
    frontAxis.geometry.attributes.position.needsUpdate = true;
  }
  if (driveWheelAngularVelocity !== 0) {
    const driveWheelAngleGain = driveWheelAngularVelocity * elapsed; // radians
    const linearDistanceGain =
      driveWheelAngleGain * (WHEEL_RADIUS + TIRE_TUBE_RADIUS) * INCH_TO_METER;
    if (Math.abs(steerDirection) < 1e-5) {
      // Translational motion
      rigidRotationAngleOrTranslation = linearDistanceGain; // in meter
    } else {
      // rotational motion
      const turnRadius =
        Math.abs(WHEEL_BASE / Math.tan(-steerDirection)) * INCH_TO_METER;
      rigidRotationAngleOrTranslation = linearDistanceGain / turnRadius;
      bodyRotation.value +=
        rigidRotationAngleOrTranslation * Math.sign(-steerDirection);
    }
    steeringWheelAngle += driveWheelAngleGain / Math.cos(steerDirection);
    driveWheelAngle += driveWheelAngleGain;
    const bikeRigidMotionRotor = makeRotor(
      bikeRigidRotationAxis.Normalized,
      rigidRotationAngleOrTranslation
    );
    // console.debug("Bike rigid motion rotor", bikeRigidMotionRotor);
    const tempFWP = bikeRigidMotionRotor
      .Mul(frontWheelPlane)
      .Mul(bikeRigidMotionRotor.Reverse);
    const tempFA = bikeRigidMotionRotor
      .Mul(frontAxle)
      .Mul(bikeRigidMotionRotor.Reverse);
    // Update rear wheel plane
    const tempRWP = bikeRigidMotionRotor
      .Mul(rearWheelPlane)
      .Mul(bikeRigidMotionRotor.Reverse);
    const tempRH = bikeRigidMotionRotor
      .Mul(rearHub)
      .Mul(bikeRigidMotionRotor.Reverse);
    const tempFH = bikeRigidMotionRotor
      .Mul(frontHub)
      .Mul(bikeRigidMotionRotor.Reverse);
    frontWheelPlane = tempFWP;
    rearWheelPlane = tempRWP;
    frontHub = tempFH;
    rearHub = tempRH;
    frontAxle = tempFA;
  }
  previousTimeStamp = timeMillisec;
}

function updatePoseOnly(timeStamp: number) {
  bike.rotation.z = -bodyRotation.value;
  animationFrameHandle = requestAnimationFrame((t) =>
    runMode.value === "run" ? updateGraphics(t) : updatePoseOnly(t)
  );
  previousTimeStamp = timeStamp;
  renderer.render(scene, camera);
}

function updateGraphics(timeStamp: number) {
  // console.debug("Angular velo", driveWheelAngularVelocity)
  if (!brakeApplied.value) {
    run_geometric_integrator(timeStamp);
    driveWheel.rotation.z = -driveWheelAngle;
    steeringWheel.rotation.z = -steeringWheelAngle;
    bike.position.x = -rearHub.e023;
    bike.position.y = rearHub.e013;
    bike.rotation.z = -bodyRotation.value;
    rearPlane.normal.set(
      rearWheelPlane.e1,
      rearWheelPlane.e2,
      rearWheelPlane.e3
    );
    rearPlane.constant = rearWheelPlane.e0;
    frontSphere.position.set(-frontHub.e023, frontHub.e013, -frontHub.e012);
    rearSphere.position.set(-rearHub.e023, rearHub.e013, -rearHub.e012);
    rearAxisVertices[3] = -rearHub.e023;
    rearAxisVertices[4] = rearHub.e013;
    rearAxis.geometry.attributes.position.needsUpdate = true;
  }
  frontPlane.normal.set(
    frontWheelPlane.e1,
    frontWheelPlane.e2,
    frontWheelPlane.e3
  );
  frontPlane.constant = frontWheelPlane.e0;
  frontAxisVertices[3] = -frontHub.e023;
  frontAxisVertices[4] = frontHub.e013;
  frontAxis.geometry.attributes.position.needsUpdate = true;
  steeringFork.rotation.z = steerDirection;
  if (Math.abs(steerDirection) > 1e-3) {
    const rigidRotationOuterRadius = WHEEL_BASE / Math.sin(steerDirection);
    const rigidRotationInnerRadius = WHEEL_BASE / Math.tan(steerDirection);
    frontWheelPlaneMesh.scale.y = rigidRotationOuterRadius;
    frontWheelPlaneMesh.position.y = rigidRotationOuterRadius / 2;
    rearWheelPlaneMesh.scale.y = rigidRotationInnerRadius;
    rearWheelPlaneMesh.position.y = rigidRotationInnerRadius / 2;
  } else {
    // make it "disappear"
    frontWheelPlaneMesh.scale.y = 0;
    rearWheelPlaneMesh.scale.y = 0;
  }
  animationFrameHandle = requestAnimationFrame((t) =>
    runMode.value === "run" ? updateGraphics(t) : updatePoseOnly(t)
  );
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
  bikeGroup.add(rearWheelPlaneMesh);
  steeringWheel = makeTire(TIRE_RADIUS, TIRE_TUBE_RADIUS);
  // steeringWheel.translateX(WHEEL_BASE);
  // steeringFork = new Group()
  steeringFork.translateX(WHEEL_BASE);
  steeringFork.add(frontWheelPlaneMesh);
  bikeGroup.add(steeringFork);
  steeringFork.add(steeringWheel);
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
  return bikeGroup;
}

function handleResize() {
  const { width, height } = useWindowSize();
  const ASPECT_RATIO = 4 / 3;
  const requestedWidth = height.value * ASPECT_RATIO;
  const requestedHeight = (0.8 * width.value) / ASPECT_RATIO;
  if (requestedWidth > 0.8 * width.value) {
    renderer.setSize(0.8 * width.value, requestedHeight);
  } else {
    renderer.setSize(requestedWidth, height.value);
  }
}
</script>
<style lang="scss" scoped>
#glcanvas {
  //width: 800px;
  //height: 600px;
  // border: 2px solid red;
}
</style>
