import { defineStore } from "pinia"
export type SegmentType = {
  kind: "Rot" | "Trans" | "Final"; //| "Start";
  startX: number,
  startY: number
  startHeading: number
};
export type RotationPath = SegmentType & {
  // kind: SegmentType,
  centerX: number;
  centerY: number;
  arcAngleDegree: number;
  radius: number
};

export type TranslationPath = SegmentType & {
  distance: number;
};
export type PathSegment = SegmentType | RotationPath | TranslationPath; //| Terminal;

export const usePlannerStore = defineStore('planner', () => { 
  const selectedPath = ref(0)
  const paths: Ref<Array<PathSegment>> = ref([]);

  function selectActivePath(pos: number) {
    
  }

  return {selectedPath, paths, selectActivePath}
})