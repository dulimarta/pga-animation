import Algebra from "ganja.js"
const PGA2D = Algebra(2, 0, 1)
console.debug("In composable", PGA2D, PGA2D.describe())
export function usePGA2D(): typeof PGA2D {
  function makePoint(x:number, y:number) {
    // const p = new PGA2D([0, 0, 0, 0, y, -x, 1])
    // console.debug("Using arg", p.toString())
    const p = new PGA2D() as typeof PGA2D
    p.nVector(2, y, -x, 1)
    console.debug(`Point (${x},${y}) => `, p.toString(), p)
    return p
  }
  return {makePoint}
}