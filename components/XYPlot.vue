<template>
  <div class="text-h5">{{ title }}</div>
  <canvas ref="canvas2d" :width="CANVAS_SIZE" :height="CANVAS_SIZE" id="canvas2d">
  </canvas>
</template>
<script setup lang="ts">

import { storeToRefs } from "pinia";
import { degToRad } from "three/src/math/MathUtils";
import { usePGAStore } from "~/store/pga-store";
const canvas2d: Ref<HTMLCanvasElement | null> = ref(null);
const PGAStore = usePGAStore();
const {runMode} = storeToRefs(PGAStore)
type ComponentProps = {
  xValue: number;
  yValue: number;
  title: string
};

type XYpair = {
  x: number;
  y: number;
};
let ctx: CanvasRenderingContext2D;
// const xyPair: Ref<Array<XYpair>> = ref([]);
const props = defineProps<ComponentProps>();
const CANVAS_SIZE = 400
watch([() => props.xValue, () => props.yValue], ([x, y], [oldX, oldY]) => {
  if (runMode.value !== 'run') return
  ctx.beginPath();
  ctx.fillStyle = 'red'
  ctx.arc(
    (x / 500) * canvas2d.value!.width/2,
    (y / 500) * canvas2d.value!.height/2,
    2,
    degToRad(0),
    degToRad(360),
    false
  );
  ctx.fill();
  ctx.fillStyle = 'lightgreen'
  ctx.arc(
    (oldX / 500) * canvas2d.value!.width/2,
    (oldY / 500) * canvas2d.value!.height/2,
    2,
    degToRad(0),
    degToRad(360),
    false
  );
  ctx.fill();
  // console.debug("Getting new data", x, y);
  // if (xyPair.value.length > 100) xyPair.value.shift();
});
// const testData = ref({
//   // labels: Array.from({ length: 100 }, (_, pos) => pos),
//   datasets: [
//     {
//       label: "body position",
//       data: xyPair.value
//       // backgroundColor: ["#77CEFF", "#0079AF", "#123E6B", "red"],
//     },
//   ],
// });

onMounted(() => {
  if (canvas2d.value) {
    ctx = canvas2d.value.getContext("2d")!;
    // Move origin to center of the canvas and flip Y-axis
    ctx.strokeText("y", 0.52*CANVAS_SIZE, 10);
    ctx.strokeText("x", 0.95*CANVAS_SIZE, CANVAS_SIZE/2-10);
    ctx.transform(1, 0, 0, -1, CANVAS_SIZE / 2, CANVAS_SIZE / 2);
    ctx.save();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-CANVAS_SIZE/2, 0);
    ctx.lineTo(CANVAS_SIZE/2, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -CANVAS_SIZE/2);
    ctx.lineTo(0, CANVAS_SIZE/2);
    ctx.stroke();
    ctx.restore();
    // Draw the text without Y-flip

    // new Two({autostart:false, type: Two.Types.svg}).appendTo(twoCanvas.value)
  }

  // twoInstance.appendTo(twoCanvas.value!)
  // twoInstance.makeCircle(100, 40, 35)
});
</script>
<style scoped>
#canvas2d {
  border: 1px solid red;
  margin: 4px;
}
</style>
