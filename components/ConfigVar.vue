<template>
  <div>
  {{ props.data.toFixed(2) }}
  Configuration Variable
  {{
    chartData
      .toReversed()
      .slice(0, 3)
      .map((x) => x.toFixed(2))
  }}
  </div>
  <div>
    <LineChart :chart-data="testData" :options="chartOptions" />
  </div>
</template>
<script setup lang="ts">
import { LineChart } from "vue-chart-3";

type ComponentProps = {
  data: number;
};

const chartOptions = {};
const chartData: Ref<Array<number>> = ref([]);
const props = defineProps<ComponentProps>();
watch(
  () => props.data,
  (x) => {
    // console.debug("Getting new data");
    chartData.value.push(x);
    if (chartData.value.length > 100) chartData.value.shift();
  }
);
const testData = ref({
  labels: Array.from({ length: 100 }, (_, pos) => pos),
  mode: "",
  datasets: [
    {
      label: "body X position",
      data: chartData.value,
      // backgroundColor: ["#77CEFF", "#0079AF", "#123E6B", "red"],
    },
  ],
});

// onMounted(() => {});
</script>
