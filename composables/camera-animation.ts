import { Line3, type Camera, type Scene, Vector3 } from "three";

export type {};
export function useAnimation(s: Scene, c: Camera) {
  const cameraLine = new Line3();
  const pos = new Vector3();
  const lookAtLine = new Line3();
  const lookAt = new Vector3();
  // const lookAtEnd = new Vector3();
  async function animateCamera(
    posStart: Vector3,
    posEnd: Vector3,
    lookAtStart: Vector3,
    lookatEnd: Vector3
  ): Promise<void> {
    
    return new Promise((resolve) => {
      cameraLine.set(posStart, posEnd)
      lookAtLine.set(lookAtStart, lookatEnd)
      let t = 0;
      const cameraTimer = setInterval(() => {
        if (t > 1) {
          clearInterval(cameraTimer);
          resolve()
        }
        else {
          cameraLine.at(t, pos);
          lookAtLine.at(t, lookAt);
          c.position.copy(pos);
          c.lookAt(lookAt);
          t += 0.02;
        }
      }, 30);
  
    })
  }

  return { animateCamera };
}
