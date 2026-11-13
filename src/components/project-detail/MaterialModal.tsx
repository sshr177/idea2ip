import { useEffect, useRef, useState } from 'react';
import type { FormEvent, RefObject } from 'react';
import styled from 'styled-components';
import ModalShell from '../modal/ModalShell';
import ImageUploadBox from '../modal/ImageUploadBox';

import {
  CancelButton,
  Field,
  FieldLabel,
  ModalActions,
  ModalChip as Chip,
  SubmitButton,
  TextArea,
  TextInput,
  ToastAnchor,
} from '../modal/modalForm.styles';
import { useAlertModal } from '../../hooks/useAlertModal';
import { DEFAULT_MATERIAL_TYPE, MATERIAL_TYPES } from '../../constants/materialTypes';
import type { MaterialType } from '../../constants/materialTypes';
import { useProjectStore } from '../../store/projectStore';
import type { ProcessMaterial } from '../../types/project';
import { parseDotDate } from '../../utils/formatDate';
import { createRegisteredAt } from '../../utils/registeredAt';
import { createMaterial, updateMaterial as patchMaterial, uploadMaterialFiles } from '../../api/materials';
import type { CreateMaterialInput } from '../../api/materials';

interface Props {
  projectId: string;
  /** 넘기면 수정 모드 (기존 값으로 채워서 열림), 없으면 추가 모드 */
  material?: ProcessMaterial;
  onClose: () => void;
  onCreated?: () => void;
}

const EMPTY_DETAILS: Record<MaterialType, string> = { ai: '', manual: '', sketch: '' };
const API_MATERIAL_TYPES: Record<MaterialType, CreateMaterialInput['materialType']> = {
  ai: 'AI_ASSISTED',
  manual: 'MANUAL_EDIT',
  sketch: 'INITIAL_SKETCH',
};

// 제작 과정 탭의 제작자료 추가 / 수정 모달
// - "+ 새 제작자료" → 추가 모드: 열릴 때마다 새로 마운트되므로 항상 기본값(AI 활용 자료)으로 시작
// - 타임라인 항목 "수정" → 수정 모드: 해당 자료 값으로 채워서 시작, 저장하면 같은 자리에서 교체

export default function MaterialModal({ projectId, material, onClose, onCreated }: Props) {
  const isEdit = !!material;
  const addMaterial = useProjectStore((state) => state.addMaterial);
  const updateMaterial = useProjectStore((state) => state.updateMaterial);
  const { showAlert, alertNode } = useAlertModal(1800, 'subtle');

  const [type, setType] = useState<MaterialType>(material?.type ?? DEFAULT_MATERIAL_TYPE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [image, setImage] = useState<File | null>(null);
  const [created, setCreated] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const createdMaterial = useRef<ProcessMaterial | undefined>(undefined);
  // 공통 칸 (유형을 바꿔도 유지)
  // 수정 모드에서 새 파일을 고르지 않으면 기존 이미지를 그대로 사용

  const [title, setTitle] = useState(material?.title ?? '');
  const [date, setDate] = useState(material?.productionDate?.replace(/-/g, '.') ?? '');
  // 유형별 칸 (유형마다 따로 보관 → 다시 돌아오면 입력값 그대로)
  const [details, setDetails] = useState(() =>
    material ? { ...EMPTY_DETAILS, [material.type ?? DEFAULT_MATERIAL_TYPE]: material.description } : EMPTY_DETAILS,
  );
  const [aiTool, setAiTool] = useState(material?.aiTool ?? '');


  const titleRef = useRef<HTMLInputElement>(null);
  const detailRef = useRef<HTMLTextAreaElement>(null);
  const aiToolRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  const config = MATERIAL_TYPES.find((t) => t.value === type) ?? MATERIAL_TYPES[0];
  const detail = details[type];

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  /** 화면 위에서부터 순서대로 첫 번째 문제 하나만 안내 */
  const validate = (): { message: string; ref?: RefObject<HTMLElement | null> } | null => {
    if (!title.trim()) return { message: '자료 제목을 입력해 주세요.', ref: titleRef };
    if (date.trim() && !parseDotDate(date))
      return { message: '실제 제작 날짜를 YYYY.MM.DD 형식으로 입력해 주세요.', ref: dateRef };
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    if (createdMaterial.current && !image) {
      showAlert('재시도할 이미지 파일을 선택해주세요.');
      return;
    }

    const error = validate();
    if (error) {
      showAlert(error.message);
      error.ref?.current?.focus();
      return;
    }

    if (!isEdit) {
      submittingRef.current = true;
      setIsSubmitting(true);
      try {
        let saved = createdMaterial.current;
        if (!saved) {
          const result = await createMaterial(projectId, {
          materialType: API_MATERIAL_TYPES[type],
          title: title.trim(),
          description: detail.trim() || null,
          usedAi: config.hasAiTool ? aiTool.trim() || null : null,
          productionDate: date.trim() ? date.trim().replace(/\./g, '-') : null,
        });
          saved = {
          id: String(result.materialId),
          type,
          title: result.title,
          description: detail.trim(),
          aiTool: config.hasAiTool ? aiTool.trim() || undefined : undefined,
          createdAt: parseDotDate(date)?.toISOString() ?? new Date().toISOString(),
          registeredAt: createRegisteredAt(),
          productionDate: date.trim() ? date.trim().replace(/\./g, '-') : null,
          };
          createdMaterial.current = saved;
          setCreated(true);
          addMaterial(projectId, saved);
        }
        if (image) {
          try {
            setUploadError('');
            const files = await uploadMaterialFiles(saved.id, [image]);
            updateMaterial(projectId, { ...saved, files, imageName: files[0]?.fileName });
          } catch (cause) {
            const message = `자료 내용은 등록됐지만 이미지 업로드에 실패했습니다. 다시 누르면 이미지만 재시도합니다. ${cause instanceof Error ? cause.message : ''}`;
            setUploadError(message);
            showAlert(message);
            return;
          }
        }
        if (onCreated) onCreated();
        else onClose();
      } catch (cause) {
        showAlert(cause instanceof Error ? cause.message : '창작 자료를 등록하지 못했습니다.');
      } finally {
        submittingRef.current = false;
        setIsSubmitting(false);
      }
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const result = await patchMaterial(material.id, {
        title: title.trim(), materialType: API_MATERIAL_TYPES[type],
        description: detail.trim() || null,
        usedAi: config.hasAiTool ? aiTool.trim() || null : null,
        productionDate: date.trim() ? date.trim().replace(/\./g, '-') : null,
      });
      updateMaterial(projectId, { ...material, ...result });
      if (onCreated) onCreated();
      else onClose();
    } catch (cause) {
      showAlert(cause instanceof Error ? cause.message : 'Save failed.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <ModalShell
      titleId="material-modal-title"
      title={isEdit ? '제작 과정 자료 수정' : '제작 과정 자료 추가'}
      subtitle={
        isEdit
          ? '등록한 자료의 내용을 수정해 주세요.'
          : '창작 과정에서 사용하거나 제작한 자료를 등록해 주세요.'
      }
      width={598}
      shadow
      onClose={() => { if (!submittingRef.current) onClose(); }}
    >
      <Form onSubmit={handleSubmit} noValidate aria-busy={isSubmitting}>
        <fieldset disabled={isSubmitting} style={{ display: 'contents' }}>
        <Body>
          <Field role="group" aria-labelledby="material-type-label">
            <TypeLabel as="p" id="material-type-label">
              자료 유형
            </TypeLabel>
            <Chips>
              {MATERIAL_TYPES.map(({ value, label, chipWidth }) => (
                <Chip
                  key={value}
                  type="button"
                  disabled={created}
                  aria-pressed={type === value}
                  $active={type === value}
                  style={{ width: chipWidth }}
                  onClick={() => setType(value)}
                >
                  {label}
                </Chip>
              ))}
            </Chips>
          </Field>

          <Fields>
            {!isEdit && <ImageUploadBox
              file={image}
              onChange={setImage}
              onInvalid={() => showAlert('JPG 또는 PNG 이미지 파일을 선택해주세요.')}
            />}
            {uploadError && <p role="alert">{uploadError}</p>}
            <Field>
              <FieldLabel htmlFor="material-title">자료 제목</FieldLabel>
              <TextInput
                ref={titleRef}
                id="material-title"
                autoComplete="off"
                placeholder="예: 캐릭터 초기 스케치"
                value={title}
                readOnly={created}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="material-detail">{config.detailLabel}</FieldLabel>
              <TextArea
                ref={detailRef}
                id="material-detail"
                placeholder={config.detailPlaceholder}
                value={detail}
                readOnly={created}
                onChange={(e) => setDetails((prev) => ({ ...prev, [type]: e.target.value }))}
              />
            </Field>

            {config.hasAiTool && (
              <Field>
                <FieldLabel htmlFor="material-ai-tool">사용한 AI 도구</FieldLabel>
                <TextInput
                  ref={aiToolRef}
                  id="material-ai-tool"
                  autoComplete="off"
                  placeholder="예: ChatGPT"
                  value={aiTool}
                  readOnly={created}
                  onChange={(e) => setAiTool(e.target.value)}
                />
              </Field>
            )}

            <DateField>
              <FieldLabel htmlFor="material-date">실제 제작 날짜</FieldLabel>
              <DateInput
                ref={dateRef}
                id="material-date"
                autoComplete="off"
                inputMode="numeric"
                maxLength={10}
                placeholder="YYYY.MM.DD"
                value={date}
                readOnly={created}
                onChange={(e) => setDate(e.target.value)}
              />
            </DateField>
          </Fields>
        </Body>

        <ModalActions>
          <ToastAnchor>{alertNode}</ToastAnchor>
          <CancelButton type="button" onClick={onClose}>
            취소
          </CancelButton>
          <AddButton type="submit">{isSubmitting ? '등록 중…' : isEdit ? '수정 완료' : created ? '이미지 업로드 재시도' : '자료 추가'}</AddButton>
        </ModalActions>
        </fieldset>
      </Form>
    </ModalShell>
  );
}

/* 제목 영역 아래 18px, 내용과 버튼 사이 14px, 아래 여백 14px (Figma) */
const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 18px;
  padding-bottom: 14px;
`;

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const Fields = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const TypeLabel = styled(FieldLabel)`
  margin-bottom: 14px;
`;

const Chips = styled.div`
  display: flex;
  gap: 10px;
`;

const DateField = styled(Field)`
  width: 194px;
`;

const DateInput = styled(TextInput)`
  padding: 0 16px;
  border-radius: 9px;
`;

const AddButton = styled(SubmitButton)`
  width: 148px;
`;
