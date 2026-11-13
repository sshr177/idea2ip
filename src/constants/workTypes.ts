/** 새 프로젝트 모달의 작품 유형 목록 */
export const WORK_TYPES = [
  { value: 'digital-illustration', label: '디지털 일러스트', category: '미술 창작물' },
  { value: 'character-design', label: '캐릭터 디자인', category: '미술 창작물' },
  { value: 'graphic-design', label: '그래픽 디자인', category: '미술 창작물' },
] as const;

export type WorkType = (typeof WORK_TYPES)[number]['value'];

export const getWorkTypeLabel = (value: WorkType | null) =>
  WORK_TYPES.find((type) => type.value === value)?.label ?? '유형 미지정';

/** 최종 작품 탭의 저작물 유형 표시: "분류/ 유형" (예: 미술 창작물/ 디지털 일러스트) */
export const getWorkTypeSummary = (value: WorkType | null) => {
  const type = WORK_TYPES.find((t) => t.value === value);
  return type ? `${type.category}/ ${type.label}` : '유형 미지정';
};
