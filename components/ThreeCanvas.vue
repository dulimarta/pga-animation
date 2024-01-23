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
  Clock,
  PointLightHelper,
  AxesHelper,
} from "three";
import * as THREE from "three";
import {
  PathSegment,
  RotationPath,
  TranslationPath,
  usePGAStore,
} from "~/store/pga-store";
// import CameraControls from "camera-controls";
import { useVisualStore } from "~/store/visual-store";
import { storeToRefs } from "pinia";
import { useWindowSize } from "@vueuse/core";
import { GAElement } from "~/composables/pga";
import Algebra from "ganja.js";
import { Path } from "twojs-ts";
const {
  makePoint,
  makeDirection,
  makePlane,
  makeRotor,
  makeScalar,
  parsePGAPoint,
  parsePGALine,
  parsePGAPlane,
  parsePGAMotor,
  sandwich,
  lerp,
} = usePGA3D();
const TIMER = new Clock();
const glcanvas: Ref<HTMLCanvasElement | null> = ref(null);
const GROUND_SIZE = 1000;
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
// CameraControls.install({ THREE });
let camera: PerspectiveCamera;
let animationFrameHandle: number | null = null;
const {
  driveWheelTorque,
  steerVelocity,
  steerDirection,
  bodyPosition,
  bikeInMotion,
  brakeApplied,
  bodyRotation,
  showGeometry,
  runMode,
  steerMotor,
  bodyMotor,
  rearHub,
  frontHub,
  rearWheelPlane,
  frontWheelPlane,
  paths,
} = storeToRefs(PGAStore);

const visualStore = useVisualStore();
const { makePipe, makeSphere, makeTire } = visualStore;
const {
  visualScene,
  visualCamera,
  mousePositionOnGround,
  mouseWheelScrollAmount,
} = storeToRefs(visualStore);

/*---------------------*
 * Kinematic variables *
 *---------------------*/
let driveWheelAngle = 0;
let driveWheelAngularVelocity = 0;
let steeringWheelAngle = 0;
let previousTimeStamp = 0;
let lastInterpolatedTorque = 0;
let currInterpolatedTorque = 0;
let lastInputTorque = 0;
let renderer: WebGLRenderer;

/*---------------*
 * PGA variables *
 *---------------*/
const upDirection = makeDirection(0, 0, 1);
const groundPlane = makePlane(0, 0, 1, 0);
let bikeRigidRotationAxis = frontWheelPlane.value.Wedge(rearWheelPlane.value);
const rotAxisObj = makePipe(WHEEL_RADIUS + TIRE_TUBE_RADIUS, 0.5, "green");

/*--------------------*
 * Executor variables *
 *--------------------*/
let travelDistanceSoFar = 0;
let travelDistanceRequired = 0;
let activePathIndex = -1;
let activePath: PathSegment | null = null;
let nextPath: PathSegment | null = null;

/*-----------------*
 * ThreeJS objects *
 *-----------------*/
let bike: Group;
let driveWheel: Group;
let steeringWheel: Group;
let mysteeringFork: Group = new Group();
let ground: Mesh;
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
const frontSphere = makeSphere(TIRE_TUBE_RADIUS * 2, "yellow");
const rearSphere = makeSphere(TIRE_TUBE_RADIUS * 2, "red");
const frontWheelPlaneMesh = new Mesh(
  new PlaneGeometry(WHEEL_RADIUS, 1),
  new MeshBasicMaterial({
    color: 0x008800,
    side: DoubleSide,
    transparent: true,
    opacity: 0.5,
  })
);
const rearWheelPlaneMesh = new Mesh(
  new PlaneGeometry(WHEEL_RADIUS, 1),
  new MeshBasicMaterial({
    color: 0x880000,
    side: DoubleSide,
    transparent: true,
    opacity: 0.5,
  })
);
const [rearPlane, rearPlaneHelper] = makeAuxPlane(
  rearWheelPlane.value,
  0xff0000
);
const [frontPlane, frontPlaneHelper] = makeAuxPlane(
  frontWheelPlane.value,
  0x00ff00
);

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

frontWheelPlaneMesh.rotateY(Math.PI / 2);
frontWheelPlaneMesh.position.set(0, 0, WHEEL_RADIUS / 2);
rearWheelPlaneMesh.rotateY(Math.PI / 2);
rearWheelPlaneMesh.position.set(0, 0, WHEEL_RADIUS / 2);

// let frontWheelPlane = joinLine.Dot(frontHub.value);
// parsePGAPlane("Front WP", frontWheelPlane)
let steeringAxis = frontHub.value.Vee(upDirection).Normalized;

// parsePGALine("Steering Axis", steeringAxis);
// let steerMotor = makeScalar(1);
// let bodyMotor = makeScalar(1);
rotAxisObj.rotateX(MathUtils.degToRad(90));
rotAxisObj.position.z = -100; // Initially hide it under the ground
scene.add(rotAxisObj);

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

watch(
  () => runMode.value,
  (
    currentMode: "plan" | "manual-control" | "autonomous",
    prevMode: "plan" | "manual-control" | "autonomous"
  ) => {
    console.debug(`Switch run mode from "${prevMode}" to "${currentMode}"`);
    bike.remove(camera)
    scene.remove(camera)
    switch (currentMode) {
      case "plan":
        if (animationFrameHandle !== null) {
          cancelAnimationFrame(animationFrameHandle);
        }
        if (paths.value.length > 1) {
          const firstPath = paths.value[0]
          initializeSteeringGeometry(firstPath.startX, firstPath.startY, firstPath.startHeading)
        }
        updateGraphicsForPlanner(previousTimeStamp);
        console.debug("Plane Helper position", frontPlaneHelper.position);
        steerDirection.value = 0;
        mysteeringFork.rotation.z = 0;
        // frontWheelPlaneMesh.position.z = -1000;
        // rearWheelPlaneMesh.position.z = -1000;
        // frontPlaneHelper.size = 0;
        // rearPlaneHelper.size = 0;

        // if (showGeometry.value) removeVisualAccessories();
        // camera.position.set(0, -500, 700);
        // camera.lookAt(0, -200, 0);
        cameraStart.set(-1.8 * WHEEL_RADIUS, -100, 63);
        cameraEnd.set(0, -500, 700);
        cameraLine.set(cameraStart, cameraEnd);
        lookAtStart.set(WHEEL_BASE / 2, 0, 5);
        lookAtEnd.set(0, -200, 0);
        lookAtLine.set(lookAtStart, lookAtEnd);
        // bike.remove(camera);
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
        break;
      case "autonomous":
        // The path array should have at least two elements, the first
        // path and the end point
        console.debug("Generated path", paths.value);
        if (paths.value.length > 1) {
          activePathIndex = 0;
          const WHEEL_SPEED_RPM = 20;
          // Convert RPM to rads/second
          driveWheelAngularVelocity = (WHEEL_SPEED_RPM * Math.PI) / 30;
          activePath = paths.value[0];
          nextPath = paths.value[1];
          if (animationFrameHandle) cancelAnimationFrame(animationFrameHandle);
          configureGeometryForNewPath(activePath);
          updateGraphicsForExecutor(performance.now());
          glcanvas.value?.removeEventListener("mousemove", trackMouseIn3D);
          glcanvas.value?.removeEventListener("wheel", trackWheel);
          // camera.position.set(-2 * WHEEL_RADIUS, 20, 63)
          // camera.lookAt (WHEEL_BASE, 10, WHEEL_RADIUS)
          scene.add(camera)
        } else {
          activePathIndex = -1;
          activePath = null;
          nextPath = null;
        }
        break;
      case "manual-control":
        if (animationFrameHandle) cancelAnimationFrame(animationFrameHandle);
        updateGraphics(performance.now());
        frontWheelPlaneMesh.position.z = WHEEL_RADIUS / 2;
        rearWheelPlaneMesh.position.z = WHEEL_RADIUS / 2;
        frontPlaneHelper.size = 1;
        rearPlaneHelper.size = 1;
        // break
        // if (showGeometry.value) addVisualAccessories();
        // initializeSteeringGeometry(
        //   bodyPosition.value.x,
        //   bodyPosition.value.y,
        //   bodyRotation.value
        // );
        camera.position.set(-1.8 * WHEEL_RADIUS, -100, 63);
        camera.lookAt(WHEEL_BASE / 2, 0, 5);
        // scene.remove(camera);
        bike.add(camera);
        glcanvas.value?.removeEventListener("mousemove", trackMouseIn3D);
        glcanvas.value?.removeEventListener("wheel", trackWheel);
        break;
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
    if (runMode.value === "plan") {
      console.debug("this should not happen in execute mode");
      bodyMotor.value = makeScalar(1);
      steerMotor.value = makeScalar(1);
      // console.debug(`Changing bike position to (${position.x},${position.y})`);
      bike.position.x = position.x;
      bike.position.y = position.y;
      bike.rotation.z = -orientation;
      initializeSteeringGeometry(position.x, position.y, orientation);
      // rearHub.value = makePoint(position.x, position.y, 0);
      rearSphere.position.set(position.x, position.y, 0);
      frontSphere.position.set(
        -frontHub.value.e023 / frontHub.value.e123,
        frontHub.value.e013 / frontHub.value.e123,
        -frontHub.value.e012
      );
    }
  },
  { deep: true }
);

onBeforeMount(() => {
  initializeSteeringGeometry(13, 0, bodyRotation.value);
});

// let cameraControls: CameraControls;
onMounted(async () => {
  const floorTexture = await textureLoader.loadAsync("floor-wood.jpg");
  floorTexture.wrapS = RepeatWrapping;
  floorTexture.wrapT = RepeatWrapping;
  floorTexture.repeat.set(5, 5);
  // console.debug("Texture", marbleTexture);
  const groundPlane = new PlaneGeometry(GROUND_SIZE, GROUND_SIZE, 100, 100);
  const groundMaterial = new MeshStandardMaterial({
    map: floorTexture,
    // color: 'blue'
  });
  ground = new Mesh(groundPlane, groundMaterial);
  ground.receiveShadow = true;
  ground.castShadow = false;
  // ground.add(new AxesHelper(6))
  scene.add(ground);
  const northBorder = makePipe(GROUND_SIZE, 5, "blue");
  northBorder.position.y = GROUND_SIZE / 2;
  northBorder.rotation.z = Math.PI / 2;
  scene.add(northBorder);
  const southBorder = makePipe(GROUND_SIZE, 5, "green");
  southBorder.position.y = -GROUND_SIZE / 2;
  southBorder.rotation.z = Math.PI / 2;
  scene.add(southBorder);
  const westBorder = makePipe(GROUND_SIZE, 5, "orange");
  westBorder.position.x = -GROUND_SIZE / 2;
  scene.add(westBorder);
  const eastBorder = makePipe(GROUND_SIZE, 5, "yellow");
  eastBorder.position.x = GROUND_SIZE / 2;
  scene.add(eastBorder);
  camera = new PerspectiveCamera(50, 4 / 3, 0.1, 1000);
  // rayCaster.setFromCamera(mousePointerPosition, camera);
  visualCamera.value = camera;
  camera.position.set(-1.8 * WHEEL_RADIUS, -100, 50);
  camera.up.set(0, 0, 1);
  camera.lookAt(WHEEL_BASE / 2, 0, 5);
  bike = makeBike(mysteeringFork);
  bike.add(camera);
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
  // cameraControls = new CameraControls(camera, renderer.domElement);

  handleResize();
  if (showGeometry.value) {
    addVisualAccessories();
  }
  updateGraphics(0);
  window.addEventListener("resize", handleResize);
});

onBeforeUnmount(() => {
  if (animationFrameHandle != null) cancelAnimationFrame(animationFrameHandle);
  glcanvas.value?.removeEventListener("mousemove", trackMouseIn3D);
  glcanvas.value?.removeEventListener("wheel", trackWheel);
});

function configureGeometryForNewPath(p: PathSegment) {
  initializeSteeringGeometry(p.startX, p.startY, -p.startHeading)
  bodyMotor.value = makeScalar(1);
  console.debug(parsePGAMotor("Body motor for path-0", bodyMotor.value));
  if (p.kind === "Trans") {
    const t = activePath as TranslationPath;
    // console.debug("Configuring translational path", t)
    // The kinematics equations assume SI unit
    travelDistanceRequired = t.distance * INCH_TO_METER;
    steerDirection.value = 0
    steerMotor.value = makeScalar(1)
  } else if (p.kind === 'Rot') {
    const r = activePath as RotationPath
    // console.debug("Configuring rotational path", r.arcAngleDegree < 0 ? "CW" : "CCW", r)
    travelDistanceRequired = Math.abs(MathUtils.degToRad(r.arcAngleDegree) * r.radius) * INCH_TO_METER;
    // Both args to atan2 below are in inches, no need to convert to SI unit
    steerDirection.value = Math.atan2(WHEEL_BASE, r.radius) * Math.sign(r.arcAngleDegree)
    steerMotor.value = makeRotor(steeringAxis, steerDirection.value)
  }
  mysteeringFork.rotation.z = steerDirection.value
  travelDistanceSoFar = 0
  bikeRigidRotationAxis = sandwich(
    steerMotor.value,
    frontWheelPlane.value
  ).Wedge(rearWheelPlane.value).Normalized;
}

function initializeSteeringGeometry(
  bikeX: number,
  bikeY: number,
  bikeOrientationRad: number
) {
  console.debug("Re init PGA geometry");
  rearHub.value = makePoint(bikeX, bikeY, 0);
  const bikeForwardDirection = makeDirection(
    Math.cos(bikeOrientationRad),
    Math.sin(-bikeOrientationRad),
    0
  ).Normalized;
  frontHub.value = rearHub.value.Add(
    PGA3D.Mul(bikeForwardDirection, WHEEL_BASE)
  );

  const joinLine = rearHub.value.Vee(frontHub.value).Normalized;
  rearWheelPlane.value = joinLine.Dot(rearHub.value);
  rearPlane.normal.set(
    rearWheelPlane.value.e1,
    rearWheelPlane.value.e2,
    rearWheelPlane.value.e3
  );
  rearPlane.constant = rearWheelPlane.value.e0;
  frontWheelPlane.value = joinLine.Dot(frontHub.value);
  frontPlane.normal.set(
    frontWheelPlane.value.e1,
    frontWheelPlane.value.e2,
    frontWheelPlane.value.e3
  );
  frontPlane.constant = frontWheelPlane.value.e0;
  steeringAxis = frontHub.value.Vee(upDirection).Normalized;
}

function removeVisualAccessories() {
  scene.remove(frontPlaneHelper);
  scene.remove(rearPlaneHelper);
  scene.remove(rotAxisObj);
  scene.remove(frontSphere);
  scene.remove(rearSphere);
  // scene.remove(frontAxis);
  // scene.remove(rearAxis);
  mysteeringFork.remove(frontWheelPlaneMesh);
  bike.remove(rearWheelPlaneMesh);
}

function addVisualAccessories() {
  scene.add(frontPlaneHelper);
  scene.add(rearPlaneHelper);
  scene.add(rotAxisObj);
  scene.add(frontSphere);
  scene.add(rearSphere);
  // scene.add(frontAxis);
  // scene.add(rearAxis);
  mysteeringFork.add(frontWheelPlaneMesh);
  bike.add(rearWheelPlaneMesh);
  bike.position.set(
    -rearHub.value.e023 / rearHub.value.e123,
    rearHub.value.e013 / rearHub.value.e123,
    0
  );
}

function trackMouseIn3D(ev: MouseEvent) {
  if (!ev.ctrlKey && !ev.altKey) return;
  mousePointerPosition.x = 2 * (ev.clientX / glcanvas.value!.clientWidth) - 1;
  mousePointerPosition.y = 1 - 2 * (ev.clientY / glcanvas.value!.clientHeight);
  // console.debug("Mouse on canvas", mousePointerPosition.x.toFixed(3), mousePointerPosition.y.toFixed(3))
  rayCaster.setFromCamera(mousePointerPosition, camera);
  const what = rayCaster.intersectObject(ground);
  if (what.length > 0) {
    // console.debug(`Mouse on ground (${what[0].point.x.toFixed(2)},${what[0].point.y.toFixed(2)})`)
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

function makeAuxPlane(
  pgaPlane: GAElement,
  color?: number
): [Plane, PlaneHelper] {
  const p = new Plane(
    new Vector3(pgaPlane.e1, pgaPlane.e2, pgaPlane.e3),
    pgaPlane.e0
  );
  const pH = new PlaneHelper(p, WHEEL_RADIUS, color ?? 0x888888);
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
  steerDirection.value += steerDirectionGain;
  if (Math.abs(steerVelocity.value) > 1e-3) {
    // steer angle changes
    const deltaSteerRotor = makeRotor(steeringAxis, steerDirectionGain);
    // Premultiply the new motor
    steerMotor.value = deltaSteerRotor.Mul(steerMotor.value);
    // Recalculate the rotation axis (in the body coordinate)
    bikeRigidRotationAxis = sandwich(
      steerMotor.value,
      frontWheelPlane.value
    ).Wedge(rearWheelPlane.value).Normalized;
    // parsePGALine("Rotation axis", bikeRigidRotationAxis);
    // We HAVE TO normalized the point to include the correct scaling factor
    let rigidBodyRotationCenter =
      bikeRigidRotationAxis.Wedge(groundPlane).Normalized;
    rigidBodyRotationCenter = sandwich(
      bodyMotor.value,
      rigidBodyRotationCenter
    );
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
    updateMotors(driveWheelAngleGain);
  } else {
    bikeInMotion.value = false;
  }
  previousTimeStamp = timeMillisec;
}

function updateGraphicsForPlanner(timeStamp: number) {
  animationFrameHandle = requestAnimationFrame((t) =>
    updateGraphicsForPlanner(t)
  );
  previousTimeStamp = timeStamp;
  renderer.render(scene, camera);
}

function updateMotors(driveWheelAngleGain: number) {
  const linearDistanceGain = driveWheelAngleGain * WHEEL_RADIUS * INCH_TO_METER;
  // console.debug(`UpdateMotors: linear distance gain ${linearDistanceGain.toFixed(3)}`)
  let motionAmount = 0;
  if (Math.abs(steerDirection.value) < 1e-5) {
    // Translational motion
    motionAmount = linearDistanceGain; // in meter
  } else {
    // rotational motion
    const turnRadius =
      Math.abs(WHEEL_BASE / Math.tan(-steerDirection.value)) * INCH_TO_METER;
    motionAmount = linearDistanceGain / turnRadius;
    bodyRotation.value += motionAmount * Math.sign(-steerDirection.value);
  }
  steeringWheelAngle += driveWheelAngleGain / Math.cos(steerDirection.value);
  driveWheelAngle += driveWheelAngleGain;
  const deltaBodyMotor = makeRotor(
    bikeRigidRotationAxis.Normalized,
    motionAmount
  );
  bodyMotor.value = bodyMotor.value.Mul(deltaBodyMotor);
}

function updateGraphicsForExecutor(timeMilliSec: number) {
  const elapsed = TIMER.getDelta();
  console.debug("updateForExecutor")
  if (driveWheelAngularVelocity !== 0) {
    // console.debug(
    //   `Updating motor for angular gain ${driveWheelAngularVelocity * elapsed}`
    // );
    updateMotors(driveWheelAngularVelocity * elapsed);
    const rh = sandwich(bodyMotor.value, rearHub.value).Normalized;
    const fh = sandwich(bodyMotor.value, frontHub.value).Normalized;
    driveWheel.rotation.z = -driveWheelAngle;
    steeringWheel.rotation.z = -steeringWheelAngle;
    bike.position.x = -rh.e023 / rh.e123;
    bike.position.y = rh.e013 / rh.e123;
    bike.rotation.z = -bodyRotation.value;
    const rp = sandwich(bodyMotor.value, rearWheelPlane.value).Normalized;
    rearPlane.normal.set(rp.e1, rp.e2, rp.e3);
    rearPlane.constant = rp.e0;
    frontSphere.position.set(-fh.e023 / fh.e123, fh.e013 / fh.e123, -fh.e012);
    rearSphere.position.set(-rh.e023 / rh.e123, rh.e013 / rh.e123, -rh.e012);
    const fp = sandwich(
      bodyMotor.value,
      sandwich(steerMotor.value, frontWheelPlane.value).Normalized
    ).Normalized;
    frontPlane.normal.set(fp.e1, fp.e2, fp.e3);
    frontPlane.constant = fp.e0;
    let distanceGained =
      driveWheelAngularVelocity * WHEEL_RADIUS * elapsed * INCH_TO_METER;
    // if (activePath?.kind === 'Rot') {
    //   console.debug(`Linear distance gain ${distanceGained.toFixed(2)} meters`)
    //   distanceGained /= (activePath as RotationPath).radius * INCH_TO_METER
    //   console.debug(`Linear distance gain ${distanceGained.toFixed(2)} meters`)
    // }

    // const distanceError = Math.sqrt(
    //   Math.pow(bike.position.x - nextPath!.startX, 2) +
    //     Math.pow(bike.position.y - nextPath!.startY, 2)
    // );
    const directDistanceFromStart =
      Math.sqrt(
        Math.pow(bike.position.x - activePath!.startX, 2) +
          Math.pow(bike.position.y - activePath!.startY, 2)
      ) * INCH_TO_METER;
    // console.debug(`Executor linear distance gain ${distanceGained.toFixed(3)}`)
    travelDistanceSoFar += distanceGained;
    // console.debug(
    //   `Path progress: accumulated so far ${travelDistanceSoFar.toFixed(
    //     2
    //   )}, direct distance ${directDistanceFromStart.toFixed(
    //     2
    //   )} of ${travelDistanceRequired.toFixed(2)}`
    // );
    if (
      travelDistanceSoFar >= travelDistanceRequired ||
      directDistanceFromStart >= travelDistanceRequired
    ) {
      console.debug("Completed current path", activePath);
      if (nextPath?.kind !== 'Final') {
        if (animationFrameHandle) cancelAnimationFrame(animationFrameHandle);
        activePath = nextPath;
        activePathIndex++;
        nextPath = paths.value[activePathIndex + 1];
        configureGeometryForNewPath(activePath!)
      } else {
        driveWheelAngularVelocity = 0;
        activePathIndex = -1;
        activePath = null;
        nextPath = null;
      }
    }
  }
  animationFrameHandle = requestAnimationFrame((t) =>
    updateGraphicsForExecutor(t)
  );
  // previousTimeStamp = timeMilliSec;
  renderer.render(scene, camera);
}

function updateGraphics(timeStamp: number) {
  run_geometric_integrator(timeStamp);
  const rh = sandwich(bodyMotor.value, rearHub.value).Normalized;
  const fh = sandwich(bodyMotor.value, frontHub.value).Normalized;
  driveWheel.rotation.z = -driveWheelAngle;
  steeringWheel.rotation.z = -steeringWheelAngle;
  bike.position.x = -rh.e023 / rh.e123;
  bike.position.y = rh.e013 / rh.e123;
  bike.rotation.z = -bodyRotation.value;
  const rp = sandwich(bodyMotor.value, rearWheelPlane.value);
  rearPlane.normal.set(rp.e1, rp.e2, rp.e3);
  rearPlane.constant = rp.e0;
  frontSphere.position.set(-fh.e023 / fh.e123, fh.e013 / fh.e123, -fh.e012);
  rearSphere.position.set(-rh.e023 / rh.e123, rh.e013 / rh.e123, -rh.e012);
  const fp = sandwich(
    bodyMotor.value,
    sandwich(steerMotor.value, frontWheelPlane.value)
  );
  frontPlane.normal.set(fp.e1, fp.e2, fp.e3);
  frontPlane.constant = fp.e0;
  mysteeringFork.rotation.z = steerDirection.value;
  if (Math.abs(steerDirection.value) > 1e-3) {
    const rigidRotationOuterRadius =
      WHEEL_BASE / Math.sin(steerDirection.value);
    const rigidRotationInnerRadius =
      WHEEL_BASE / Math.tan(steerDirection.value);
    frontWheelPlaneMesh.scale.y = rigidRotationOuterRadius;
    frontWheelPlaneMesh.position.y = rigidRotationOuterRadius / 2;
    rearWheelPlaneMesh.scale.y = rigidRotationInnerRadius;
    rearWheelPlaneMesh.position.y = rigidRotationInnerRadius / 2;
  } else {
    // make it "disappear"
    frontWheelPlaneMesh.scale.y = 0;
    rearWheelPlaneMesh.scale.y = 0;
  }
  // const hasControlUpdated = cameraControls.update(
  //   timeStamp - previousTimeStamp
  // );
  animationFrameHandle = requestAnimationFrame((t) => updateGraphics(t));
  previousTimeStamp = timeStamp;

  renderer.render(scene, camera);
}

function makeBike(steerGroup: Group): Group {
  const bikeGroup = new Group();
  // X-positive is forward travel direction
  driveWheel = makeTire(TIRE_RADIUS, TIRE_TUBE_RADIUS);
  // driveWheel.position.x = WHEEL_BASE;
  bikeGroup.add(driveWheel);
  bikeGroup.add(rearWheelPlaneMesh);
  steeringWheel = makeTire(TIRE_RADIUS, TIRE_TUBE_RADIUS);
  // steeringWheel.translateX(WHEEL_BASE);
  // steeringFork = new Group()
  steerGroup.add(new AxesHelper(20));
  steerGroup.translateX(WHEEL_BASE);
  steerGroup.add(frontWheelPlaneMesh);
  bikeGroup.add(steerGroup);
  steerGroup.add(steeringWheel);
  const steerHandleAndFork = new Group();
  steerGroup.add(steerHandleAndFork);
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
  const leftChainStay = makePipe(WHEEL_RADIUS + 7, 0.7, "yellow");
  const rightChainStay = makePipe(WHEEL_RADIUS + 7, 0.7, "yellow");
  bikeFrame.add(leftChainStay);
  bikeFrame.add(rightChainStay);
  leftChainStay.rotateZ(MathUtils.degToRad(90));
  leftChainStay.rotateX(MathUtils.degToRad(10));
  leftChainStay.position.set(
    -0.5 * (WHEEL_RADIUS + 3.5) - 5,
    1.8 * TIRE_TUBE_RADIUS,
    14
  );
  rightChainStay.rotateZ(MathUtils.degToRad(90));
  rightChainStay.rotateX(MathUtils.degToRad(10));
  rightChainStay.position.set(
    -0.5 * (WHEEL_RADIUS + 3.5) - 5,
    -1.8 * TIRE_TUBE_RADIUS,
    14
  );
  const leftSeatStay = makePipe(WHEEL_RADIUS + 8, 0.7, "yellow");
  bikeFrame.add(leftSeatStay);
  leftSeatStay.rotateX(MathUtils.degToRad(90));
  leftSeatStay.position.set(
    -WHEEL_RADIUS - 1.9,
    1.8 * TIRE_TUBE_RADIUS,
    1.7 * WHEEL_RADIUS
  );
  leftSeatStay.rotateZ(MathUtils.degToRad(-40));
  const rightSeatStay = makePipe(WHEEL_RADIUS + 8, 0.7, "yellow");
  bikeFrame.add(rightSeatStay);
  rightSeatStay.rotateX(MathUtils.degToRad(90));
  rightSeatStay.position.set(
    -WHEEL_RADIUS - 1.9,
    -1.8 * TIRE_TUBE_RADIUS,
    1.7 * WHEEL_RADIUS
  );
  rightSeatStay.rotateZ(MathUtils.degToRad(-40));
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
