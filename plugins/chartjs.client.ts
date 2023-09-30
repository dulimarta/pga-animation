import { defineNuxtPlugin } from "nuxt/app";
import * as ChartJS from "chart.js"
const {Chart, registerables} = ChartJS
export default defineNuxtPlugin(() => {
  Chart.register(...registerables)
})