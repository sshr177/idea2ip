import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import styled from 'styled-components';
import ModalShell from './modal/ModalShell';
import ImageUploadBox from './modal/ImageUploadBox';
import {
  CancelButton,
  Field,
  FieldLabel,
  ModalActions,
  SubmitButton,
  TextInput,
  ToastAnchor,
} from './modal/modalForm.styles';
import { useAlertModal } from '../hooks/useAlertModal';
import { colors } from '../styles/theme';
import { WORK_TYPES } from '../constants/workTypes';
import type { WorkType } from '../constants/workTypes';

export interface NewProjectInput {
  name: string;
  image: File | null;
  workType: WorkType;
}

interface Props {
  projectCreated?: boolean;
  onClose: () => void;
  onSubmit: (input: NewProjectInput) => Promise<void>;
}

// 대시보드 / 내 프로젝트의 "새 프로젝트" 버튼으로 여는 생성 모달

export default function NewProjectModal({ onClose, onSubmit, projectCreated = false }: Props) {
  const [name, setName] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [workType, setWorkType] = useState<WorkType>(WORK_TYPES[0].value);
  const nameRef = useRef<HTMLInputElement>(null);
  const { showAlert, alertNode } = useAlertModal(1800, 'subtle');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;

    if (!name.trim()) {
      showAlert('프로젝트 이름을 작성해 주세요.');
      nameRef.current?.focus();
      return;
    }
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), image, workType });
    } catch (error) {
      showAlert(error instanceof Error ? error.message : '프로젝트를 생성하지 못했습니다.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <ModalShell titleId="new-project-title" title="새 프로젝트 시작" onClose={() => { if (!submittingRef.current) onClose(); }}>
      <Form onSubmit={handleSubmit} noValidate aria-busy={isSubmitting}>
        <fieldset disabled={isSubmitting} style={{ display: 'contents' }}>
        <Fields>
          <Field>
            <Label htmlFor="project-name">프로젝트 이름</Label>
            <NameInput
              ref={nameRef}
              id="project-name"
              name="name"
              autoComplete="off"
              placeholder="예: 달빛 정원 캐릭터"
              value={name}
              readOnly={projectCreated}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          <ImageUploadBox
            file={image}
            onChange={setImage}
            onInvalid={() => showAlert('지원하지 않는 이미지 형식입니다.')}
          />
          <p style={{ margin: 0, fontSize: 12 }}>{projectCreated ? '프로젝트는 생성되었습니다. 썸네일만 다시 저장할 수 있습니다.' : '썸네일은 선택 사항이며 프로젝트 생성 후 서버에 저장됩니다.'}</p>

          <Field role="group" aria-labelledby="work-type-label">
            <Label as="p" id="work-type-label">
              작품 유형
            </Label>
            <TypeList>
              {WORK_TYPES.map(({ value, label, category }) => (
                <TypeCard
                  key={value}
                  type="button"
                  disabled={projectCreated}
                  aria-pressed={workType === value}
                  $selected={workType === value}
                  onClick={() => setWorkType(value)}
                >
                  <TypeLabel>{label}</TypeLabel>
                  <TypeCategory>{category}</TypeCategory>
                </TypeCard>
              ))}
            </TypeList>
          </Field>
        </Fields>

        <ModalActions>
          <ToastAnchor>{alertNode}</ToastAnchor>
          <CancelButton type="button" onClick={onClose}>
            취소
          </CancelButton>
          <SubmitButton type="submit">{isSubmitting ? '저장 중…' : projectCreated ? '썸네일 저장' : '프로젝트 만들기'}</SubmitButton>
        </ModalActions>
        </fieldset>
      </Form>
    </ModalShell>
  );
}

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 32px;
  margin-top: 14px;
  padding-bottom: 18px;
`;

const Fields = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const Label = styled(FieldLabel)`
  margin-bottom: 15px;
  font-weight: 700;
`;

const NameInput = styled(TextInput)`
  border-radius: 9px;
`;

const TypeList = styled.div`
  display: flex;
  gap: 12px;
`;

const TypeCard = styled.button<{ $selected: boolean }>`
  flex: 1;
  height: 104px;
  padding: 17px 11px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 13px;
  text-align: left;
  line-height: normal;
  background: ${({ $selected }) => ($selected ? colors.selectedBg : colors.card)};
  border: 1px solid ${({ $selected }) => ($selected ? colors.selected : colors.border)};
  border-radius: 12px;
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s;

  & > span:last-child {
    color: ${({ $selected }) => ($selected ? colors.selected : colors.muted)};
  }

  &:hover {
    border-color: ${colors.selected};
  }
`;

const TypeLabel = styled.span`
  color: ${colors.text};
  font-size: 14px;
  font-weight: 700;
`;

const TypeCategory = styled.span`
  font-size: 12px;
  font-weight: 400;
`;
