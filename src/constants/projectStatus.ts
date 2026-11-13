import type { ProjectStatus } from '../types/project';

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  'in-progress': '진행 중',
  done: '완료',
  unknown: '상태 미제공',
};
