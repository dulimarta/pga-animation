import { storeToRefs } from "pinia";
import {
  PathSegment,
  RotationPath,
  TranslationPath,
  usePGAStore,
} from "~/store/pga-store";
import Algebra from "ganja.js";
import { GAElement } from "./pga";
import { MathUtils } from "three/src/math/MathUtils";

const {
  parsePGAPoint,
  parsePGAMotor,
  parsePGALine,
  makePoint,
  makeRotor,
  makeDirection,
  squareRootMotor
} = usePGA3D();
const PGA3D = Algebra({ p: 3, q: 0, r: 1, graded: false });

export function usePathExecutor(paths: Ref<Array<PathSegment>>) {
  const { rearHub, bodyPosition, bodyRotation, bodyMotor } = storeToRefs(
    usePGAStore()
  );

  const UP_DIRECTION = makeDirection(0, 0, 1);
  const BIKE_INTERPOLATION_SPEED = 50; // inch/second

  function setupPath(p: PathSegment): GAElement {
    parsePGAPoint("RearHub", rearHub.value);
    let motorInterpolator: GAElement;

    console.debug(
      "Start position: [bike]",
      bodyPosition.value.x,
      bodyPosition.value.y
    );
    if (p.kind === "Trans") {
      const t = p as TranslationPath;
      //     // const E0 = new PGA3D().nVector(1, 1, 0, 0)
      //     // const translateDirection = make3DDirection(Math.cos(initialMarker.rotation.z), Math.sin(initialMarker.rotation.z), 0).Wedge(E0)
      const targetMotor = new PGA3D()
        .nVector(0, 1)
        .nVector(
          2,
          -t.distance * Math.cos(-bodyRotation.value),
          -t.distance * Math.sin(-bodyRotation.value),
          0
        );
      console.debug(parsePGAMotor("Target Translator", targetMotor));
      console.debug(parsePGAMotor("Current Motor", bodyMotor.value));
      motorInterpolator = squareRootMotor(targetMotor.Mul(bodyMotor.value));
      console.debug(parsePGAMotor("Sqrt Translator", motorInterpolator));
      return motorInterpolator;
      // interpolationTimeNeeded = Math.abs(t.distance) / BIKE_INTERPOLATION_SPEED; // in seconds
      // console.debug(
      //   `Translate ${t.distance.toFixed(
      //     2
      //   )} inches will be completed in ${interpolationTimeNeeded.toFixed(
      //     1
      //   )} seconds`
      // );
    } /*if (p.kind === "Rot") */ else {
      const r = p as RotationPath;
      // interpolationTimeNeeded = r.arcAngleDegree / BIKE_INTERPOLATION_SPEED;
      const axisOfRotation = makePoint(r.centerX, r.centerY, 0).Vee(
        PGA3D.Mul(UP_DIRECTION, Math.sign(r.arcAngleDegree))
      ).Normalized;
      parsePGALine("Axis of Rot", axisOfRotation);
      const arcAngleRad = MathUtils.degToRad(2 * Math.abs(r.arcAngleDegree));
      const targetMotor = makeRotor(axisOfRotation.Normalized, arcAngleRad);
      const arcLengthInch = Math.abs(arcAngleRad * r.radius);
      console.debug(parsePGAMotor("Target Rotor", targetMotor));
      console.debug(parsePGAMotor("Current Motor", bodyMotor.value));
      motorInterpolator = squareRootMotor(targetMotor.Mul(bodyMotor.value));
      console.debug(parsePGAMotor("Sqrt Rotor", motorInterpolator));
      return motorInterpolator;
      // interpolationTimeNeeded = arcLengthInch / BIKE_INTERPOLATION_SPEED
      // console.debug(
      //   `Rotate with arc angle ${r.arcAngleDegree.toFixed(
      //     2
      //   )} degrees/${arcLengthInch.toFixed(2)} inches will be completed in ${interpolationTimeNeeded.toFixed(
      //     2
      //   )} seconds`
      // );
    }
  }
  function selectActivePath(n: number): GAElement {
    console.debug("Selecting active path", n);
    return setupPath(paths.value[n]);
  }

  return { selectActivePath };
}
