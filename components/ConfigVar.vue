<template>
  <div>
    <!-- {{ props.data.toFixed(2) }} -->
    Configuration Variables (x,y)
    <!-- {{
    chartData
      .toReversed()
      .slice(0, 3)
      .map((x) => x.toFixed(2))
  }} -->
  </div>
  <canvas ref="canvas2d" :width="432" :height="432" id="canvas2d">
    <!-- <ScatterChart :chart-data="testData" :options="chartOptions" /> -->
  </canvas>
</template>
<script setup lang="ts">
// import { LineChart, ScatterChart } from "vue-chart-3";
import { degToRad } from "three/src/math/MathUtils";
const canvas2d: Ref<HTMLCanvasElement | null> = ref(null);
type ComponentProps = {
  xValue: number;
  yValue: number;
};

type XYpair = {
  x: number;
  y: number;
};
let ctx: CanvasRenderingContext2D;
// const chartOptions = {
//   scales: {
//     type: "linear",
//     x: {
//       min: -500, max: +500
//     },
//     y: {
//       min: -500, max: +500
//     }
//   }
// };
// const xyPair: Ref<Array<XYpair>> = ref([]);
const props = defineProps<ComponentProps>();

watch([() => props.xValue, () => props.yValue], ([x, y], [oldX, oldY]) => {
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
    ctx.translate(canvas2d.value.width / 2, canvas2d.value.height / 2);
    ctx.transform(1, 0, 0, -1, 0, 0);
    ctx.save();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(200, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 200);
    ctx.stroke();
    ctx.restore();
    ctx.strokeText("X", 208, 0);

    // new Two({autostart:false, type: Two.Types.svg}).appendTo(twoCanvas.value)
  }

  // twoInstance.appendTo(twoCanvas.value!)
  // twoInstance.makeCircle(100, 40, 35)
});
</script>
<style scoped>
#canvas2d {
  border: 1px solid red;
}
</style>
