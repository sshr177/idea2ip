/** 창작 기여 정리 단계 유형 → 패널 라벨 SKETCH / AI OUTPUT / EDITED / FINAL */
export type ContributionStepKind = 'sketch' | 'ai' | 'manual' | 'final' | 'unknown';

/** 근거 종류: 첨부자료 기반 / 사용자 진술 / 미확인 */
export type EvidenceKind = 'attachment' | 'user-statement' | 'unverified';

export interface ContributionEvidence {
  kind: EvidenceKind;
  /** 근거 출처 설명 (예: "AI 인터뷰 Q1 · 초기 구상", 파일 이름) */
  source: string;
}

/** 타임라인 한 단계 (프로젝트의 제작 자료 / 최종 작품에서 만듦) */
export interface ContributionTimelineItem {
  /** 제작 자료 id, 최종 작품은 'final' */
  id: string;
  kind: ContributionStepKind;
  title: string;
  /** 등록 시각 (ISO 8601, 오래된 순 정렬 기준) */
  registeredAt: string;
  /** 연결 자료 파일 이름 (업로드 파일 이름) */
  fileNames: string[];
  /** 사용자가 입력한 값 (구조화할 때 반영) */
  userInput: {
    description?: string;
    aiTool?: string;
  };
}

/**
 * 서버(AI)가 단계별로 정리해서 줄 결과 형태
 * 지금은 mocks/contribution.ts 의 목업으로 생성
 */
export interface ContributionStepResult {
  /** 타임라인 항목 id와 연결 */
  stepId: string;
  /** 타임라인 한 줄 요약 (예: 작업 아이디어 구상) */
  summary: string;
  /** 단계 설명 */
  description: string;
  /** AI 활용 내용 (글머리 목록) */
  aiUsage: string[];
  /** 직접 창작·수정한 부분 (글머리 목록) */
  humanContribution: string[];
  /** 근거 및 출처 */
  evidence: ContributionEvidence[];
}

export interface ContributionResult {
  projectId: string;
  steps: ContributionStepResult[];
}
