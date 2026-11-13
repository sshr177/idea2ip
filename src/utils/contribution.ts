import type { ContributionStepKind, ContributionTimelineItem } from '../types/contribution';
import type { FinalWork, ProcessMaterial } from '../types/project';
import { resolveRegisteredAt } from './registeredAt';

/** 상세 패널 유형 라벨 */
export const STEP_KIND_LABEL: Record<ContributionStepKind, string> = {
  sketch: 'SKETCH',
  ai: 'AI OUTPUT',
  manual: 'EDITED',
  final: 'FINAL',
  unknown: '유형 미제공',
};

/**
 * 프로젝트 데이터로 작업 과정 타임라인 만들기
 * 제작 자료(초기 스케치 / AI 활용 / 직접 수정) + 최종 작품을 등록 시각 오래된 순으로 정렬
 */
export function buildContributionTimeline(
  materials: ProcessMaterial[],
  finalWork: FinalWork | undefined,
): ContributionTimelineItem[] {
  const items: ContributionTimelineItem[] = materials.map((material) => ({
    id: material.id,
    kind: material.type ?? 'unknown',
    title: material.title,
    registeredAt: resolveRegisteredAt(material, material.createdAt),
    fileNames: material.files ? material.files.map((file) => file.fileName) : material.imageName ? [material.imageName] : [],
    userInput: { description: material.description, aiTool: material.aiTool },
  }));

  if (finalWork) {
    items.push({
      id: 'final',
      kind: 'final',
      title: '최종 작품',
      registeredAt: resolveRegisteredAt(finalWork, finalWork.updatedAt),
      fileNames: [finalWork.imageName],
      userInput: { description: finalWork.description },
    });
  }

  return items.sort((a, b) => Date.parse(a.registeredAt) - Date.parse(b.registeredAt));
}

/** 01, 02, 03 … */
export const formatStepNumber = (index: number) => String(index + 1).padStart(2, '0');
