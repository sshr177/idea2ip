import { create } from 'zustand';
import type { FinalWork, ProcessMaterial, Project } from '../types/project';
import type { InterviewMessage, InterviewSession } from '../types/interview';
import {
  INITIAL_INTERVIEW,
  buildQuestionPlan,
  createMessage,
  getQuestion,
  isLastQuestion,
} from '../utils/interview';
import { GREETING_MESSAGE } from '../mocks/interview';
import { createRegisteredAt } from '../utils/registeredAt';
import type { BriefSectionKey, BriefState } from '../types/brief';
import { buildMockBrief } from '../mocks/brief';
import { BRIEF_GENERATION_TOTAL_MS } from '../utils/brief';

// 프로젝트 목록은 DashboardLayout에서 API 조회 후 채웁니다.

interface ProjectState {
  /** 최신순 (새로 만든 프로젝트가 맨 앞) */
  projects: Project[];
  /** 프로젝트 ID별 제작자료 (제작 과정 탭 타임라인) */
  materialsByProjectId: Record<string, ProcessMaterial[]>;
  addProject: (project: Project) => void;
  /** 프로젝트에 제작자료 추가 (타임라인 맨 뒤) */
  addMaterial: (projectId: string, material: ProcessMaterial) => void;
  /** 같은 id의 제작자료를 교체 (타임라인 순서 유지) */
  updateMaterial: (projectId: string, material: ProcessMaterial) => void;
  /** 프로젝트 ID별 최종 작품 (없으면 최종 작품 탭은 등록 화면) */
  finalWorkByProjectId: Record<string, FinalWork>;
  /** 최종 작품 저장 / 이미지 교체 / 설명 수정 (일부 값만 바꿀 때도 사용) */
  saveFinalWork: (projectId: string, finalWork: FinalWork) => void;

  /** 프로젝트 ID별 AI 인터뷰 (없으면 시작 전) */
  interviewByProjectId: Record<string, InterviewSession>;
  /** 인터뷰 시작: 보완 필요 필드로 질문 목록을 만들고 인사 + 첫 질문 */
  startInterview: (projectId: string) => void;
  /** 사용자가 현재 질문에 답변 전송 */
  sendInterviewAnswer: (projectId: string, text: string) => void;
  /** AI 메시지 추가 (답변 확인 메시지 등) */
  addInterviewMessage: (projectId: string, message: InterviewMessage) => void;
  /**
   * 현재 답변을 해당 필드에 저장 + 필드 "완료" 처리
   * 마지막 질문이면 인터뷰 완료, 아니면 다음 질문으로
   * @returns 보낸 답변이 없으면 'no-answer'
   */
  saveInterviewAnswer: (projectId: string) => 'no-answer' | 'next' | 'completed';

  /** 프로젝트 ID별 Copyright Brief (리포트 탭) */
  briefByProjectId: Record<string, BriefState>;
  /** 생성 / 업데이트 시작 → 생성 중 → (목업 시간 후) 새 버전 저장 */
  startBriefGeneration: (projectId: string) => void;
  /** 편집 모달에서 섹션 직접 수정 (사용자 수정 시각 기록) */
  updateBriefSection: (projectId: string, key: BriefSectionKey, content: string) => void;
}

export const useProjectStore = create<ProjectState>()((set, get) => ({
  projects: [],
  materialsByProjectId: {},
  // 새 프로젝트는 제작자료가 빈 상태로 시작
  addProject: (project) =>
    set((state) => ({
      projects: [project, ...state.projects],
      materialsByProjectId: { ...state.materialsByProjectId, [project.id]: [] },
    })),
  addMaterial: (projectId, material) =>
    set((state) => ({
      materialsByProjectId: {
        ...state.materialsByProjectId,
        [projectId]: [...(state.materialsByProjectId[projectId] ?? []), material],
      },
    })),
  updateMaterial: (projectId, material) =>
    set((state) => ({
      materialsByProjectId: {
        ...state.materialsByProjectId,
        [projectId]: (state.materialsByProjectId[projectId] ?? []).map((m) =>
          m.id === material.id ? material : m,
        ),
      },
    })),
  // TODO: 최종 작품 API 연동 시 교체 (지금은 목업 프로젝트도 최종 작품 없이 시작)
  finalWorkByProjectId: {},
  saveFinalWork: (projectId, finalWork) =>
    set((state) => ({
      finalWorkByProjectId: { ...state.finalWorkByProjectId, [projectId]: finalWork },
    })),

  // TODO: AI 인터뷰 API 연동 시 교체 (질문 생성 / 답변 저장 / 종료 여부를 서버가 결정)
  interviewByProjectId: {},
  startInterview: (projectId) => {
    const base = get().interviewByProjectId[projectId] ?? INITIAL_INTERVIEW;
    const questionKeys = buildQuestionPlan(base.fields);
    const first = questionKeys[0];
    setInterview(projectId, {
      ...base,
      // 물어볼 필드가 없으면 바로 완료
      status: first ? 'in-progress' : 'completed',
      questionKeys,
      currentIndex: 0,
      draftAnswer: null,
      messages: first
        ? [createMessage('ai', GREETING_MESSAGE), createMessage('ai', getQuestion(first).question)]
        : [],
    });
  },
  sendInterviewAnswer: (projectId, text) => {
    const session = getInterview(projectId);
    setInterview(projectId, {
      ...session,
      messages: [...session.messages, createMessage('user', text)],
      draftAnswer: session.draftAnswer ? `${session.draftAnswer}\n${text}` : text,
    });
  },
  addInterviewMessage: (projectId, message) => {
    const session = getInterview(projectId);
    setInterview(projectId, { ...session, messages: [...session.messages, message] });
  },
  saveInterviewAnswer: (projectId) => {
    const session = getInterview(projectId);
    const fieldKey = session.questionKeys[session.currentIndex];
    if (!session.draftAnswer || !fieldKey) return 'no-answer';

    const saved: InterviewSession = {
      ...session,
      answers: { ...session.answers, [fieldKey]: session.draftAnswer },
      // TODO: 서버 연동 시 서버 기록 시각으로 교체 (utils/registeredAt 과 같은 방식)
      answeredAt: { ...session.answeredAt, [fieldKey]: createRegisteredAt() },
      fields: session.fields.map((field) =>
        field.key === fieldKey
          ? { ...field, status: 'done', summary: session.draftAnswer! }
          : field,
      ),
      draftAnswer: null,
    };

    if (isLastQuestion(session)) {
      setInterview(projectId, { ...saved, status: 'completed' });
      return 'completed';
    }

    const nextIndex = session.currentIndex + 1;
    setInterview(projectId, {
      ...saved,
      currentIndex: nextIndex,
      messages: [
        ...saved.messages,
        createMessage('ai', getQuestion(session.questionKeys[nextIndex]).question),
      ],
    });
    return 'next';
  },

  // TODO: Copyright Brief API 연동 시 교체 (생성 요청 → 완료 응답)
  briefByProjectId: {},
  startBriefGeneration: (projectId) => {
    const current = getBrief(projectId);
    if (current.status === 'generating') return;

    setBrief(projectId, {
      ...current,
      status: 'generating',
      generationStartedAt: new Date().toISOString(),
    });
    // 목업: 단계 진행 시간이 지나면 완료 (탭을 나가도 store에서 계속 진행)
    window.setTimeout(() => completeBriefGeneration(projectId), BRIEF_GENERATION_TOTAL_MS);
  },
  updateBriefSection: (projectId, key, content) => {
    const brief = getBrief(projectId);
    if (!brief.report) return;
    setBrief(projectId, {
      ...brief,
      report: {
        ...brief.report,
        sections: brief.report.sections.map((section) =>
          section.key === key
            ? { ...section, content, userEditedAt: new Date().toISOString() }
            : section,
        ),
      },
    });
  },
}));

const INITIAL_BRIEF: BriefState = { status: 'not-generated' };

function getBrief(projectId: string) {
  return useProjectStore.getState().briefByProjectId[projectId] ?? INITIAL_BRIEF;
}

function setBrief(projectId: string, brief: BriefState) {
  useProjectStore.setState((state) => ({
    briefByProjectId: { ...state.briefByProjectId, [projectId]: brief },
  }));
}

/** 생성 완료: 지금 프로젝트 데이터로 새 버전 생성, 직전 버전은 1개만 보관 */
function completeBriefGeneration(projectId: string) {
  const state = useProjectStore.getState();
  const brief = getBrief(projectId);
  const project = state.projects.find((p) => p.id === projectId);
  if (brief.status !== 'generating' || !project) return;

  const report = buildMockBrief(
    {
      project,
      materials: state.materialsByProjectId[projectId] ?? [],
      finalWork: state.finalWorkByProjectId[projectId],
      interview: getInterview(projectId),
    },
    brief.report,
  );
  setBrief(projectId, { status: 'generated', report, previous: brief.report });
}

/** 프로젝트의 Copyright Brief 상태 (없으면 생성 전) */
export const useBrief = (projectId: string) =>
  useProjectStore((state) => state.briefByProjectId[projectId] ?? INITIAL_BRIEF);

function getInterview(projectId: string) {
  return useProjectStore.getState().interviewByProjectId[projectId] ?? INITIAL_INTERVIEW;
}

function setInterview(projectId: string, session: InterviewSession) {
  useProjectStore.setState((state) => ({
    interviewByProjectId: { ...state.interviewByProjectId, [projectId]: session },
  }));
}

/** 프로젝트의 AI 인터뷰 상태 (없으면 시작 전 기본값) */
export const useInterview = (projectId: string) =>
  useProjectStore((state) => state.interviewByProjectId[projectId] ?? INITIAL_INTERVIEW);

/** 프로젝트의 최종 작품 (없으면 undefined) */
export const useFinalWork = (projectId: string) =>
  useProjectStore((state) => state.finalWorkByProjectId[projectId]);

// selector가 매번 새 배열을 반환하면 무한 렌더링이 생기므로 고정된 빈 배열 사용
const NO_MATERIALS: ProcessMaterial[] = [];

/** 프로젝트의 제작자료 목록 (없으면 빈 배열) */
export const useProjectMaterials = (projectId: string) =>
  useProjectStore((state) => state.materialsByProjectId[projectId] ?? NO_MATERIALS);
