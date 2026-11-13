import type {
  ContributionEvidence,
  ContributionResult,
  ContributionStepKind,
  ContributionStepResult,
  ContributionTimelineItem,
} from '../types/contribution';

// TODO: 창작 기여 구조화 API 연동 시 교체 (지금은 시안 문구를 기본값으로 쓰는 목업)

type StepTemplate = Omit<ContributionStepResult, 'stepId' | 'evidence'> & {
  /** 사용자 진술 근거 출처 (시안 문구) */
  statementSource: string;
};

/** 단계 유형별 기본 문구 (Figma 시안 그대로) */
const TEMPLATES: Record<ContributionStepKind, StepTemplate> = {
  unknown: {
    summary: '창작 자료',
    description: '자료 유형 정보가 제공되지 않았습니다.',
    aiUsage: ['미확인'],
    humanContribution: ['미확인'],
    statementSource: '창작 자료 설명',
  },
  sketch: {
    summary: '작업 아이디어 구상',
    description: '캐릭터의 전체 콘셉트와 구도, 표정 방향을 직접 스케치한 단계예요.',
    aiUsage: ['AI 사용 없음'],
    humanContribution: ['전체 콘셉트 구상', '캐릭터 표정·귀 모양 스케치'],
    statementSource: 'AI 인터뷰 Q1 · 초기 구상',
  },
  ai: {
    summary: '색상·배경 참고',
    description: '색상과 배경 분위기를 참고하기 위해 AI로 여러 시안을 생성한 단계예요.',
    aiUsage: ['Midjourney 사용', '색상·배경 레퍼런스 탐색'],
    humanContribution: ['생성 결과 중 일부 시안 선택', '최종 작품에는 직접 재구성'],
    statementSource: 'AI 인터뷰 Q2 · AI 활용 목적',
  },
  manual: {
    summary: '표정·구도 변경',
    description: 'AI 시안을 그대로 사용하지 않고 캐릭터 형태와 배치, 구도를 직접 수정한 단계예요.',
    aiUsage: ['AI 시안 참고'],
    humanContribution: ['표정·귀 모양 변경', '배치·색상 조정', '중간 수정본에서 구도 변경'],
    statementSource: 'AI 인터뷰 Q3 · 직접 수정 내용',
  },
  final: {
    summary: '최종 결과물',
    description: '직접 수정 과정을 거쳐 최종 결과물을 완성하고 작품 설명을 정리한 단계예요.',
    aiUsage: ['AI 활용 내용 정리 완료'],
    humanContribution: ['최종 구성 확정', '세부 색상·형태 보정'],
    statementSource: '최종 작품 설명',
  },
};

/**
 * 단계 하나 구조화 (목업)
 * 시안 문구를 기본으로, 사용자가 입력한 값이 있으면 반영
 * - AI 활용 자료: 사용한 AI 도구, AI 산출물 내용 → AI 활용 내용
 * - 초기 스케치 / 직접 수정 자료: 입력한 내용 → 직접 창작·수정한 부분 맨 앞
 * - 연결 파일이 없으면 첨부자료 근거는 "미확인"
 */
function structureStep(item: ContributionTimelineItem): ContributionStepResult {
  const template = TEMPLATES[item.kind];
  const { description, aiTool } = item.userInput;

  let aiUsage = template.aiUsage;
  let humanContribution = template.humanContribution;

  if (item.kind === 'ai') {
    aiUsage = [aiTool ? `${aiTool} 사용` : template.aiUsage[0], description || template.aiUsage[1]];
  } else if ((item.kind === 'sketch' || item.kind === 'manual') && description) {
    humanContribution = [description, ...template.humanContribution.slice(1)];
  }

  const evidence: ContributionEvidence[] = [
    { kind: 'user-statement', source: template.statementSource },
    item.fileNames[0]
      ? { kind: 'attachment', source: item.fileNames[0] }
      : { kind: 'unverified', source: '연결된 첨부 파일 없음' },
  ];

  return {
    stepId: item.id,
    summary: template.summary,
    description: template.description,
    aiUsage,
    humanContribution,
    evidence,
  };
}

/** 프로젝트 타임라인 전체 구조화 (서버 응답 형태로 반환) */
export function buildMockContribution(
  projectId: string,
  items: ContributionTimelineItem[],
): ContributionResult {
  return { projectId, steps: items.map(structureStep) };
}
