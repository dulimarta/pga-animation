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
  Raycaster,
  Line3,
  PointLightHelper,
  AxesHelper,
} from "three";
import { usePGAStore } from "~/store/pga-store";
import { useVisualStore } from "~/store/visual-store";
import { storeToRefs } from "pinia";
import { useWindowSize } from "@vueuse/core";
import { GAElement } from "~/composables/pga";
import Algebra from "ganja.js";
const {
  makePoint,
  makeDirection,
  makePlane,
  makeRotor,
  makeScalar,
  parsePGAPoint,
  parsePGALine,
  parsePGAPlane,
} = usePGA3D();
const glcanvas: Ref<HTMLCanvasElement | null> = ref(null);
const PGAStore = usePGAStore();
const PGA3D = Algebra({ p: 3, q: 0, r: 1, graded: false });
const TIRE_RADIUS = 13; // inches
const TIRE_TUBE_RADIUS = 1.5; // inches
const INCH_TO_METER = 0.0254;
const WHEEL_BASE = 46; // inches
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
  bikeInMotion,
  brakeApplied,
  bodyRotation,
  showGeometry,
  runMode,
  steerMotor, bodyMotor
} = storeToRefs(PGAStore);

const visualStore = useVisualStore();
const { makePipe, makeSphere, makeTire } = visualStore;
const {
  visualScene,
  visualCamera,
  mousePositionOnGround,
  mouseWheelScrollAmount,
} = storeToRefs(visualStore);
let driveWheelAngle = 0;
let driveWheelAngularVelocity = 0;
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
// let rigidRotationAngleOrTranslation = 0;
const textureLoader = new TextureLoader();
const rayCaster = new Raycaster();
const mousePointerPosition = new Vector2();
const scene = new Scene();
const cameraLine = new Line3();
const cameraStart = new Vector3();
const cameraEnd = new Vector3();
const lookAtLine = new Line3();
const lookAtStart = new Vector3();
const lookAtEnd = new Vector3();
visualScene.value = scene;
// scene.add(new AxesHelper(120));
scene.add(new AmbientLight());
const light = new PointLight(0xffffff, 10000);
// light.target.position.set(0,0,30)
light.position.set(0, 40, 80);
light.castShadow = true;
// scene.add(light)
// scene.add(new PointLightHelper(light, 3))
// scene.background = new Color("skyblue");
const bikeForwardDirection = makeDirection(1, 0, 0);
const groundPlane = makePlane(0, 0, 1, 0);
let rearHub = makePoint(13, 0, 0);
let frontHub = rearHub.Add(PGA3D.Mul(bikeForwardDirection, WHEEL_BASE));
const joinLine = rearHub.Vee(frontHub).Normalized;
// parsePGALine("Join RF", joinLine)
let rearWheelPlane = joinLine.Dot(rearHub);
// parsePGAPlane("RWP", rearWheelPlane);
const frontWheelPlaneMesh = new Mesh(
  new PlaneGeometry(WHEEL_RADIUS, 1),
  new MeshBasicMaterial({
    color: 0x008800,
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

let frontWheelPlane = joinLine.Dot(frontHub);
// parsePGAPlane("Front WP", frontWheelPlane)
// const frontSphere = makeSphere(TIRE_TUBE_RADIUS * 2, "yellow");
const rearSphere = makeSphere(TIRE_TUBE_RADIUS * 2, "red");
// Join the center of the rear wheel with a forward vector to make a line
// const rearWheelPlaneNormal = rearHub.Vee(bikeForwardDirection).Normalized;
// Create a plane thru the rear wheel hub, perpendicular to the normal
const upDirection = makeDirection(0, 0, 1);
const steeringAxis = frontHub.Vee(upDirection).Normalized;
// let steerMotor = makeScalar(1);
// let bodyMotor = makeScalar(1);
const rotAxisObj = makePipe(WHEEL_RADIUS + TIRE_TUBE_RADIUS, 0.5, "green");
rotAxisObj.rotateX(MathUtils.degToRad(90));
rotAxisObj.position.z = -100; // Initially hide it under the ground
scene.add(rotAxisObj);
let bikeRigidRotationAxis = frontWheelPlane.Wedge(rearWheelPlane);
// const [rearPlane, rearPlaneHelper] = makeAuxPlane(rearWheelPlane, 0xff0000);

// const [frontPlane, frontPlaneHelper] = makeAuxPlane(frontWheelPlane, 0xffff00);
// const [rearAxis, rearAxisVertices] = makeAuxLine(0xff0000);
// const [frontAxis, frontAxisVertices] = makeAuxLine(0xffff00);

// rearAxisVertices[0] = 0;
// rearAxisVertices[1] = 0;
// rearAxisVertices[2] = WHEEL_RADIUS;
// rearAxisVertices[3] = 0;
// rearAxisVertices[4] = 0;
// rearAxisVertices[5] = WHEEL_RADIUS;
// frontAxisVertices[0] = WHEEL_BASE;
// frontAxisVertices[1] = 0;
// frontAxisVertices[2] = WHEEL_RADIUS;
// frontAxisVertices[3] = WHEEL_BASE;
// frontAxisVertices[4] = 0;
// frontAxisVertices[5] = WHEEL_RADIUS;

function initializeSteeringGeometry() {
  console.debug("Re init PGA geometry");
  rearHub.e023 = -bodyPosition.value.x;
  rearHub.e013 = bodyPosition.value.y;
  const bikeForwardDirection = makeDirection(
    Math.cos(-bodyRotation.value),
    Math.sin(-bodyRotation.value),
    0
  );
  frontHub = rearHub.Add(PGA3D.Mul(bikeForwardDirection, WHEEL_BASE));
  const joinLine = rearHub.Vee(frontHub).Normalized;
  rearWheelPlane = joinLine.Dot(rearHub);
  frontWheelPlane = joinLine.Dot(frontHub);
  bikeRigidRotationAxis = frontWheelPlane.Wedge(rearWheelPlane);
  const rigidBodyRotationCenter = bikeRigidRotationAxis.Wedge(groundPlane);
  rigidBodyRotationCenter.e023 =
    rigidBodyRotationCenter.e023 / rigidBodyRotationCenter.e123;
  rigidBodyRotationCenter.e013 =
    rigidBodyRotationCenter.e013 / rigidBodyRotationCenter.e123;
  // parsePGAPoint("RB rotation center", rigidBodyRotationCenter);
  const steerDirSign = Math.sign(steerDirection);
  rotAxisObj.position.set(
    -rigidBodyRotationCenter.e023 * steerDirSign,
    rigidBodyRotationCenter.e013 * steerDirSign,
    TIRE_RADIUS / 2
  );
  // rearAxisVertices[0] = -rigidBodyRotationCenter.e023 * steerDirSign;
  // rearAxisVertices[1] = rigidBodyRotationCenter.e013 * steerDirSign;
  // rearAxis.geometry.attributes.position.needsUpdate = true;
  // frontAxisVertices[0] = -rigidBodyRotationCenter.e023 * steerDirSign;
  // frontAxisVertices[1] = rigidBodyRotationCenter.e013 * steerDirSign;
  // frontAxis.geometry.attributes.position.needsUpdate = true;
}

function removeVisualAccessories() {
  // scene.remove(frontPlaneHelper);
  // scene.remove(rearPlaneHelper);
  scene.remove(rotAxisObj);
  // scene.remove(frontSphere);
  scene.remove(rearSphere);
  // scene.remove(frontAxis);
  // scene.remove(rearAxis);
  steeringFork.remove(frontWheelPlaneMesh);
  bike.remove(rearWheelPlaneMesh);
}

function addVisualAccessories() {
  // scene.add(frontPlaneHelper);
  // scene.add(rearPlaneHelper);
  scene.add(rotAxisObj);
  // scene.add(frontSphere);
  scene.add(rearSphere);
  // scene.add(frontAxis);
  // scene.add(rearAxis);
  steeringFork.add(frontWheelPlaneMesh);
  bike.add(rearWheelPlaneMesh);
  bike.position.copy(rearSphere.position);
}

watch(
  () => runMode.value,
  (currentMode: "plan" | "run") => {
    if (currentMode == "plan") {
      steerDirection = 0;
      steeringFork.rotation.z = 0;
      if (showGeometry.value) removeVisualAccessories();
      // camera.position.set(0, -500, 700);
      // camera.lookAt(0, -200, 0);
      cameraStart.set(-1.8 * WHEEL_RADIUS, -100, 63);
      cameraEnd.set(0, -500, 700);
      cameraLine.set(cameraStart, cameraEnd);
      lookAtStart.set(WHEEL_BASE / 2, 0, 5);
      lookAtEnd.set(0, -200, 0);
      lookAtLine.set(lookAtStart, lookAtEnd);
      bike.remove(camera);
      scene.add(camera);
      let t = 0;
      const cameraTimer = setInterval(() => {
        if (t > 1) clearInterval(cameraTimer);
        else {
          cameraLine.at(t, cameraStart);
          lookAtLine.at(t, lookAtStart);
          camera.position.copy(cameraStart);
          camera.lookAt(lookAtStart);
          t += 0.02;
        }
      }, 30);
      glcanvas.value?.addEventListener("mousemove", trackMouseIn3D);
      glcanvas.value?.addEventListener("wheel", trackWheel);
    } else {
      if (showGeometry.value) addVisualAccessories();
      initializeSteeringGeometry();
      camera.position.set(-1.8 * WHEEL_RADIUS, -100, 63);
      camera.lookAt(WHEEL_BASE / 2, 0, 5);
      scene.remove(camera);
      bike.add(camera);
      glcanvas.value?.removeEventListener("mousemove", trackMouseIn3D);
      glcanvas.value?.removeEventListener("wheel", trackWheel);
    }
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
let ground: Mesh;
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
  ground = new Mesh(groundPlane, groundMaterial);
  ground.receiveShadow = true;
  ground.castShadow = false;
  // ground.add(new AxesHelper(6))
  scene.add(ground);

  camera = new PerspectiveCamera(50, 4 / 3, 0.1, 1000);
  // rayCaster.setFromCamera(mousePointerPosition, camera);
  visualCamera.value = camera;
  camera.position.set(-1.8 * WHEEL_RADIUS, -100, 50);
  camera.up.set(0, 0, 1);
  camera.lookAt(WHEEL_BASE / 2, 0, 5);
  bike = makeBike();
  bike.add(camera);
  // steeringFork.add(frontWheelPlaneMesh);
  bike.add(light);
  scene.add(bike);
  // bike.position.copy(rearSphere.position)
  renderer = new WebGLRenderer({
    canvas: glcanvas.value!,
    antialias: true,
  });
  renderer.shadowMap.enabled = true;
  renderer.setPixelRatio(window.devicePixelRatio);
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

function trackMouseIn3D(ev: MouseEvent) {
  if (!ev.ctrlKey && !ev.altKey) return;
  mousePointerPosition.x = 2 * (ev.clientX / glcanvas.value!.clientWidth) - 1;
  mousePointerPosition.y = 1 - 2 * (ev.clientY / glcanvas.value!.clientHeight);
  // console.debug("Mouse on canvas", mousePointerPosition.x.toFixed(3), mousePointerPosition.y.toFixed(3))
  rayCaster.setFromCamera(mousePointerPosition, camera);
  const what = rayCaster.intersectObject(ground);
  if (what.length > 0) {
    mousePositionOnGround.value.copy(what[0].point);
  }
  ev.preventDefault();
}
let wheelTimer: any = null;
function trackWheel(ev: WheelEvent) {
  if (!ev.ctrlKey && !ev.altKey) return;
  mouseWheelScrollAmount.value = ev.deltaY;
  clearTimeout(wheelTimer);
  wheelTimer = setTimeout(() => {
    wheelTimer = null;
    mouseWheelScrollAmount.value = 0;
  }, 100);
  ev.preventDefault();
}
onBeforeUnmount(() => {
  if (animationFrameHandle != null) cancelAnimationFrame(animationFrameHandle);
  glcanvas.value?.removeEventListener("mousemove", trackMouseIn3D);
  glcanvas.value?.removeEventListener("wheel", trackWheel);
});

function makeAuxPlane(
  pgaPlane: GAElement,
  color?: number
): [Plane, PlaneHelper] {
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

function sandwich(motor: GAElement, X: GAElement): GAElement {
  return motor.Mul(X).Mul(motor.Reverse);
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
    const deltaSteerRotor = makeRotor(steeringAxis, steerDirectionGain);
    // Premultiply the new motor
    steerMotor.value = deltaSteerRotor.Mul(steerMotor.value);
    // Recalculate the rotation axis (in the body coordinate)
    bikeRigidRotationAxis = sandwich(steerMotor.value, frontWheelPlane).Wedge(
      rearWheelPlane
    );
    parsePGALine("Rotation axis", bikeRigidRotationAxis);
    // We HAVE TO normalized the point to include the correct scaling factor
    let rigidBodyRotationCenter =
      bikeRigidRotationAxis.Wedge(groundPlane).Normalized;
    rigidBodyRotationCenter = sandwich(bodyMotor.value, rigidBodyRotationCenter);
    rigidBodyRotationCenter.e023 =
      rigidBodyRotationCenter.e023 / rigidBodyRotationCenter.e123;
    rigidBodyRotationCenter.e013 =
      rigidBodyRotationCenter.e013 / rigidBodyRotationCenter.e123;
    rotAxisObj.position.set(
      -rigidBodyRotationCenter.e023,
      rigidBodyRotationCenter.e013,
      TIRE_RADIUS / 2
    );
  }
  if (driveWheelAngularVelocity !== 0 && !brakeApplied.value) {
    bikeInMotion.value = true;
    const driveWheelAngleGain = driveWheelAngularVelocity * elapsed; // radians
    const linearDistanceGain =
      driveWheelAngleGain * (WHEEL_RADIUS + TIRE_TUBE_RADIUS) * INCH_TO_METER;
    let motionAmount = 0;
    if (Math.abs(steerDirection) < 1e-5) {
      // Translational motion
      motionAmount = linearDistanceGain; // in meter
    } else {
      // rotational motion
      const turnRadius =
        Math.abs(WHEEL_BASE / Math.tan(-steerDirection)) * INCH_TO_METER;
      motionAmount = linearDistanceGain / turnRadius;
      bodyRotation.value += motionAmount * Math.sign(-steerDirection);
    }
    steeringWheelAngle += driveWheelAngleGain / Math.cos(steerDirection);
    driveWheelAngle += driveWheelAngleGain;
    const deltaBodyMotor = makeRotor(
      bikeRigidRotationAxis.Normalized,
      motionAmount
    );
    bodyMotor.value = bodyMotor.value.Mul(deltaBodyMotor);
  } else {
    bikeInMotion.value = false;
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
  run_geometric_integrator(timeStamp);
  const rh = sandwich(bodyMotor.value, rearHub).Normalized;
  // const fh = sandwich(bodyMotor, frontHub).Normalized;
  driveWheel.rotation.z = -driveWheelAngle;
  steeringWheel.rotation.z = -steeringWheelAngle;
  bike.position.x = -rh.e023 / rh.e123;
  bike.position.y = rh.e013 / rh.e123;
  bike.rotation.z = -bodyRotation.value;
  // const rp = sandwich(bodyMotor, rearWheelPlane);
  // rearPlane.normal.set(rp.e1, rp.e2, rp.e3);
  // rearPlane.constant = rp.e0;
  // frontSphere.position.set(-fh.e023/fh.e123, fh.e013/fh.e123, -fh.e012);
  rearSphere.position.set(-rh.e023 / rh.e123, rh.e013 / rh.e123, -rh.e012);
  // const fp = sandwich(bodyMotor, sandwich(steerMotor, frontWheelPlane));
  // frontPlane.normal.set(fp.e1, fp.e2, fp.e3);
  // frontPlane.constant = fp.e0;
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
  const steerHandleAndFork = new Group();
  steeringFork.add(steerHandleAndFork);
  // steerHandleAndFork.add(new AxesHelper(200))
  steerHandleAndFork.position.set(0, 0, WHEEL_RADIUS);
  steerHandleAndFork.rotateY(MathUtils.degToRad(-15));
  const FORK_LENGTH = WHEEL_RADIUS + 2;
  const leftFork = makePipe(FORK_LENGTH, 0.6, "yellow");
  const rightFork = makePipe(FORK_LENGTH, 0.6, "yellow");
  const forkBridge = makePipe(5 * TIRE_TUBE_RADIUS, 0.6, "yellow");
  const handleSupport = makePipe(7, 0.6, "white");
  const handleBar = makePipe(26, 0.7, "white");
  leftFork.position.set(0, 3, FORK_LENGTH / 2);
  leftFork.rotateX(Math.PI / 2);
  rightFork.position.set(0, -3, FORK_LENGTH / 2);
  rightFork.rotateX(Math.PI / 2);
  forkBridge.position.set(0, 0, WHEEL_RADIUS + 2);
  handleSupport.position.set(0, 0, WHEEL_RADIUS + 5);
  handleSupport.rotateX(MathUtils.degToRad(90));
  handleBar.position.set(0, 0, WHEEL_RADIUS + 9);
  steerHandleAndFork.add(leftFork);
  steerHandleAndFork.add(rightFork);
  steerHandleAndFork.add(forkBridge);
  steerHandleAndFork.add(handleSupport);
  steerHandleAndFork.add(handleBar);
  // bikeFrame.rotation.z = Math.PI / 4;
  const bikeFrame = new Group();
  bikeGroup.add(bikeFrame);
  const seatTube = makePipe(24, 1, "yellow");
  seatTube.rotateX(Math.PI / 2);
  seatTube.translateY(12 + TIRE_RADIUS);
  seatTube.rotateZ(MathUtils.degToRad(15));
  seatTube.translateX(-8);
  // seatTube.add(new AxesHelper(10));
  bikeFrame.add(seatTube);
  const downTube = makePipe(33, 1, "yellow");
  downTube.rotateX(MathUtils.degToRad(90));
  downTube.translateY(9 + TIRE_RADIUS);
  downTube.translateX(7);
  downTube.rotateZ(MathUtils.degToRad(-45));
  bikeFrame.add(downTube);
  const topTube = makePipe(29, 1, "yellow");
  topTube.rotateZ(MathUtils.degToRad(90));
  topTube.translateZ(33);
  topTube.translateY(-4);
  bikeFrame.add(topTube);
  bikeFrame.translateX(WHEEL_BASE / 2);
  const leftChainStay = makePipe(WHEEL_RADIUS + 7, 0.7, "yellow")
  const rightChainStay = makePipe(WHEEL_RADIUS + 7, 0.7, "yellow")
  bikeFrame.add(leftChainStay)
  bikeFrame.add(rightChainStay)
  leftChainStay.rotateZ(MathUtils.degToRad(90))
  leftChainStay.rotateX(MathUtils.degToRad(10))
  leftChainStay.position.set(-0.5 * (WHEEL_RADIUS + 3.5) - 5, 1.8 * TIRE_TUBE_RADIUS, 14)
  rightChainStay.rotateZ(MathUtils.degToRad(90))
  rightChainStay.rotateX(MathUtils.degToRad(10))
  rightChainStay.position.set(-0.5 * (WHEEL_RADIUS + 3.5) - 5, -1.8 * TIRE_TUBE_RADIUS, 14)
  const leftSeatStay = makePipe(WHEEL_RADIUS + 8, 0.7, "yellow")
  bikeFrame.add(leftSeatStay)
  leftSeatStay.rotateX(MathUtils.degToRad(90))
  leftSeatStay.position.set(-WHEEL_RADIUS-1.9, 1.8 * TIRE_TUBE_RADIUS, 1.7*WHEEL_RADIUS)
  leftSeatStay.rotateZ(MathUtils.degToRad(-40))
  const rightSeatStay = makePipe(WHEEL_RADIUS + 8, 0.7, "yellow")
  bikeFrame.add(rightSeatStay)
  rightSeatStay.rotateX(MathUtils.degToRad(90))
  rightSeatStay.position.set(-WHEEL_RADIUS-1.9, -1.8 * TIRE_TUBE_RADIUS, 1.7*WHEEL_RADIUS)
  rightSeatStay.rotateZ(MathUtils.degToRad(-40))
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
