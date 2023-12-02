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
  steerAngle,
  bodyPosition,
  playAnimation,
  bodyRotation,
  showGeometry,
  rigidRotationAngleDebug,
} = storeToRefs(PGAStore);
let driveWheelAngle = 0;
let driveWheelAngularVelocity = 0;
// let driveWheelAngularIncrement = 0;
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
// let rigidRotationRadius = Number.POSITIVE_INFINITY;
let rigidRotationAngleOrTranslation = 0;
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
// const bikeForwardDirection = makeDirection(1, 0, 0);
const bikeSideDirection = makeDirection(0, 1, 0);
let rearHub = makePoint(0, 0, 0);
let rearWheelPlane = makePlane(1, 0, 0, 0);
let frontHub = makePoint(WHEEL_BASE, 0, 0);
let frontWheelPlane = makePlane(1, 0, 0, -WHEEL_BASE);
let frontAxle = frontHub.Vee(bikeSideDirection);
const frontSphere = makeSphere(3, "yellow");
scene.add(frontSphere);
const rearSphere = makeSphere(3, "red");
frontSphere.position.set(-frontHub.e023, frontHub.e013, -frontHub.e012);
rearSphere.position.set(-rearHub.e023, rearHub.e013, -rearHub.e012);
scene.add(rearSphere);
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
const steeringAxis = computed(() => frontHub.Vee(upDirection).Normalized);
parsePGALine("Steering axis", steeringAxis.value);
// console.debug(
//   "Steering axis",
//   steeringAxis.value,
//   steeringAxis.value.toString(),
//   "FW plane",
//   frontWheelPlane.toString()
// );
const rotAxisObj = makePipe(20, 0.5, "green");
rotAxisObj.rotateX(MathUtils.degToRad(90));
// scene.add(rotAxisObj)
// render(scene, rearHub)
let bikeRigidRotationAxis = frontWheelPlane.Wedge(rearWheelPlane);
// parsePGALine("Rigid rotation axis", bikeRigidRotationAxis);
const [rearPlane, rearPlaneHelper] = makeAuxPlane(rearWheelPlane, 0xff0000);

const [frontPlane, frontPlaneHelper] = makeAuxPlane(frontWheelPlane, 0xffff00);

if (showGeometry.value) {
  scene.add(rearPlaneHelper);
  scene.add(frontPlaneHelper);
}

watch(
  () => showGeometry.value,
  (showGeo: boolean) => {
    console.debug("Geometry control", showGeo);
    if (showGeo) {
      scene.add(frontPlaneHelper);
      scene.add(rearPlaneHelper);
      scene.add(rotAxisObj)
      scene.add(frontSphere)
      scene.add(rearSphere)
    } else {
      scene.remove(frontPlaneHelper);
      scene.remove(rearPlaneHelper);
      scene.remove(rotAxisObj)
      scene.remove(frontSphere)
      scene.remove(rearSphere)
    }
  }
);

// Steering Angle watcher
watch(
  () => steerAngle.value,
  (steer: number, oldSteer: number) => {
    const steerDelta = steer - oldSteer;
    parsePGALine("In ange watcher, steering axis", steeringAxis.value);
    const steeringRotor = makeRotor(
      steeringAxis.value,
      MathUtils.degToRad(-steerDelta)
    );

    if (steer === 0) {
      if (rotationalMotion) scene.remove(rotAxisObj);
      rotationalMotion = false;
    } else {
      if (!rotationalMotion) scene.add(rotAxisObj);
      rotationalMotion = true;
    }

    frontWheelPlane = steeringRotor
      .Mul(frontWheelPlane)
      .Mul(steeringRotor.Reverse);
    frontAxle = steeringRotor.Mul(frontAxle).Mul(steeringRotor.Reverse);
    parsePGAPlane("Steering plane", frontWheelPlane);
    parsePGALine("Front Axle", frontAxle);
    bikeRigidRotationAxis = frontWheelPlane.Wedge(rearWheelPlane);
    parsePGALine("Plane intersection", bikeRigidRotationAxis);
    frontPlane.normal.set(
      frontWheelPlane.e1,
      frontWheelPlane.e2,
      frontWheelPlane.e3
    );
    frontPlane.constant = frontWheelPlane.e0;
    // We HAVE TO normalized the point to include the correct scaling factor
    const rigidBodyRotationCenter = frontAxle.Wedge(rearWheelPlane).Normalized;
    parsePGAPoint("RB rotation center", rigidBodyRotationCenter);
    if (steer < 0)
      rotAxisObj.position.set(
        -rigidBodyRotationCenter.e023,
        rigidBodyRotationCenter.e013,
        0
      );
    else
      rotAxisObj.position.set(
        rigidBodyRotationCenter.e023,
        -rigidBodyRotationCenter.e013,
        0
      );
    // console.debug("Front and Rear Plane intersection #2", bikeRigidRotationAxis, bikeRigidRotationAxis.toString())
    // parsePGALine("Bike rigid rotation axis", bikeRigidRotationAxis);
    // rigidRotationRadius = rearHub.Vee(rigidBodyRotationCenter).Length;
    // console.debug("Rigid rotation radius", rigidRotationRadius);
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

function makeAuxPlane(pgaPlane: any, color?: number): [Plane, PlaneHelper] {
  const p = new Plane(
    new Vector3(pgaPlane.e1, pgaPlane.e2, pgaPlane.e3),
    pgaPlane.e0
  );
  const pH = new PlaneHelper(p, 30, color ?? 0x888888);
  return [p, pH];
}
// Bicycle Riding Model: https://ciechanow.ski/bicycle/
function run_geometric_integrator(timeMillisec: number) {
  lastInterpolatedTorque = currInterpolatedTorque; // f_{k-1+alpha}
  currInterpolatedTorque =
    ALPHA * lastInputTorque + (1 - ALPHA) * driveWheelTorque.value; // f_{k+alpha}
  // Unit of torque is Newton.m or kg.m.sec^{-2}.m or kg.m^2.sec^{-2}
  const elapsed = (timeMillisec - previousTimeStamp)/1000;
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

  if (driveWheelAngularVelocity !== 0) {
    const driveWheelAngleGain = driveWheelAngularVelocity * elapsed; // radians
    const linearDistanceGain = driveWheelAngleGain * (WHEEL_RADIUS + TIRE_TUBE_RADIUS) * INCH_TO_METER;
    if (steerAngle.value === 0) {
      // Translational motion
      rigidRotationAngleOrTranslation = linearDistanceGain;
    } else {
      // rotational motion
      const turnRadius = Math.abs(WHEEL_BASE/Math.tan(MathUtils.degToRad(steerAngle.value)))
      rigidRotationAngleOrTranslation = linearDistanceGain / (turnRadius * INCH_TO_METER)
      bodyRotation.value += rigidRotationAngleOrTranslation * Math.sign(steerAngle.value);
    }
    const bikeRigidMotionRotor = makeRotor(
      bikeRigidRotationAxis.Normalized,
      rigidRotationAngleOrTranslation
    );
    // console.debug("Bike rigid motion rotor", bikeRigidMotionRotor);
    frontWheelPlane = bikeRigidMotionRotor
      .Mul(frontWheelPlane)
      .Mul(bikeRigidMotionRotor.Reverse);
    // Update rear wheel plane
    rearWheelPlane = bikeRigidMotionRotor
      .Mul(rearWheelPlane)
      .Mul(bikeRigidMotionRotor.Reverse);
    rearHub = bikeRigidMotionRotor
      .Mul(rearHub)
      .Mul(bikeRigidMotionRotor.Reverse);
    frontHub = bikeRigidMotionRotor
      .Mul(frontHub)
      .Mul(bikeRigidMotionRotor.Reverse);
    steeringWheelAngle +=
      driveWheelAngleGain * Math.cos(MathUtils.degToRad(steerAngle.value));
    driveWheelAngle += driveWheelAngleGain;
  }
  previousTimeStamp = timeMillisec;
}

function updateGraphics(timeStamp: number) {
  // console.debug("Angular velo", driveWheelAngularVelocity)
  if (playAnimation.value) {
    run_geometric_integrator(timeStamp);
    driveWheel.rotation.z = -driveWheelAngle;
    steeringWheel.rotation.y = -MathUtils.degToRad(steerAngle.value);
    steeringWheel.rotation.z = -steeringWheelAngle;
    bike.position.x = -rearHub.e023;
    bike.position.y = rearHub.e013;
    bike.rotation.z = -bodyRotation.value;
    frontSphere.position.set(-frontHub.e023, frontHub.e013, -frontHub.e012);
    rearSphere.position.set(-rearHub.e023, rearHub.e013, -rearHub.e012);
    frontPlane.normal.set(
      frontWheelPlane.e1,
      frontWheelPlane.e2,
      frontWheelPlane.e3
    );
    frontPlane.constant = frontWheelPlane.e0;
    rearPlane.normal.set(
      rearWheelPlane.e1,
      rearWheelPlane.e2,
      rearWheelPlane.e3
    );
    rearPlane.constant = rearWheelPlane.e0;

  }
  animationFrameHandle = requestAnimationFrame((t) => updateGraphics(t));
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
