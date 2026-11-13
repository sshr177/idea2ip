import type { WorkType } from '../constants/workTypes';
import type { MaterialType } from '../constants/materialTypes';

export type ProjectStatus = 'in-progress' | 'done' | 'unknown';

export interface Project {
  id: string;
  title: string;
  description?: string | null;
  workType: WorkType | null;
  createdAt?: string;
  status: ProjectStatus;
  /** ISO 8601 문자열 */
  updatedAt: string;
  thumbnailUrl?: string;
}

/** 최종 작품 탭에 저장한 최종 작품 (프로젝트당 1개) */
export interface FinalWork {
  artworkId?: number;
  fileUrl?: string | null;
  title?: string;
  /** 업로드 이미지 미리보기 URL (서버 업로드 전이라 blob URL, 새로고침하면 사라짐) */
  imageUrl: string;
  imageName: string;
  description: string;
  /** ISO 8601 문자열 */
  updatedAt: string;
  /** 처음 저장한 시각 (창작 기여 타임라인 정렬용, utils/registeredAt 참고) */
  registeredAt?: string;
}

/** 제작 과정 탭의 타임라인 항목 (제작자료) */
export interface ProcessMaterial {
  id: string;
  type: MaterialType | null;
  materialOrder?: number;
  productionDate?: string | null;
  files?: { fileId: number; fileName: string; imageUrl: string }[];
  title: string;
  /** 유형별 내용 (AI 산출물 내용·활용 방식 / 직접 수정·추가한 내용 / 구상·스케치 내용) */
  description: string;
  /** 사용한 AI 도구 (AI 활용 자료만) */
  aiTool?: string;
  /** ISO 8601 문자열 */
  createdAt: string;
  thumbnailUrl?: string;
  /** 업로드한 이미지 파일명 (수정 모달, 창작 기여 정리 "연결 자료"에서 표시) */
  imageName?: string;
  /** 등록한 시각 (창작 기여 타임라인 정렬용, 없으면 createdAt 사용. utils/registeredAt 참고) */
  registeredAt?: string;
}
