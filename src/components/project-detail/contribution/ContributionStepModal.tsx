import { useEffect, useState } from 'react';
import { getContributionStep } from '../../../api/contributions';
import type { ContributionStepDetail } from '../../../api/contributions';
import ModalShell from '../../modal/ModalShell';
import MaterialImage from '../MaterialImage';
import { useArtworkImage } from '../../../hooks/useArtworkImage';

function FinalImage({ projectId }: { projectId: string }) {
  const image = useArtworkImage(projectId, true);
  if (image.error) return <div role="alert"><p>{image.error}</p><button type="button" onClick={image.retry}>이미지 재시도</button></div>;
  return image.url ? <img src={image.url} alt="연결된 최종 작품" style={{ maxWidth: '100%', maxHeight: 320 }} /> : <p role="status">이미지 로딩 중…</p>;
}

export default function ContributionStepModal({ projectId, stepId, onClose }: { projectId: string; stepId: number; onClose: () => void }) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ attempt: number; data?: ContributionStepDetail; error?: string }>();
  useEffect(() => {
    const controller = new AbortController();
    const token = localStorage.getItem('accessToken');
    getContributionStep(projectId, stepId, controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      if (localStorage.getItem('accessToken') !== token) throw new Error('로그인 상태가 변경되었습니다. 다시 로그인해주세요.');
      setResult({ attempt, data });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setResult({ attempt, error: error instanceof Error ? error.message : '단계 조회에 실패했습니다.' });
    });
    return () => controller.abort();
  }, [projectId, stepId, attempt]);
  const current = result?.attempt === attempt ? result : undefined;
  const data = current?.data;
  const reviews = { UNREVIEWED: '미검토', EDITED: '수정됨', CONFIRMED: '확정', EXCLUDED: '제외됨' };
  const kinds = { MATERIAL: '창작 자료', FINAL_ARTWORK: '최종 작품', INTERVIEW_STATEMENT: '인터뷰 진술' };
  const metadata = { edition: '판본', effectiveFrom: '시행 시작일', effectiveTo: '시행 종료일', publisher: '발행처', publishedOn: '발행일', retrievedOn: '조회일' } as const;
  return <ModalShell titleId="contribution-step-title" title="창작 기여 단계 상세" width={680} onClose={onClose}>
    {!current ? <p role="status">단계 정보를 불러오는 중입니다.</p> : current.error ? <div role="alert"><p>{current.error}</p><button type="button" onClick={() => setAttempt((value) => value + 1)}>다시 시도</button></div> : data && <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', paddingBottom: 24 }}>
      <h3>{data.order}. {data.title}</h3><p>{kinds[data.kind]} · {reviews[data.reviewStatus]}</p>
      <h4>연결 자료</h4>
      {!data.materialRefs.length && !data.finalArtworkRef && <p>연결 자료 없음</p>}
      {data.materialRefs.map((ref) => <section key={ref.materialId}><h5>{ref.title}</h5>{!ref.files.length && <p>첨부 이미지 없음</p>}{ref.files.map((file) => <figure key={file.fileId}>
        <MaterialImage materialId={String(ref.materialId)} fileId={file.fileId} fileName={file.originalFileName} /><figcaption>{file.originalFileName}</figcaption>
      </figure>)}</section>)}
      {data.finalArtworkRef && <section><h5>{data.finalArtworkRef.title}</h5>{data.finalArtworkRef.fileUrl ? <FinalImage projectId={projectId} /> : <p>첨부 이미지 없음</p>}</section>}
      <h4>AI 활용</h4>{data.aiUsage ? <dl><dt>도구</dt><dd>{data.aiUsage.tools.join(', ') || '미입력'}</dd><dt>목적</dt><dd>{data.aiUsage.purpose || '미입력'}</dd><dt>결과 활용</dt><dd>{data.aiUsage.outputUsage || '미입력'}</dd></dl> : <p>정보 없음</p>}
      <h4>직접 창작한 요소</h4>{data.humanCreatedElements.length ? <ul>{data.humanCreatedElements.map((text, index) => <li key={index}>{text}</li>)}</ul> : <p>정보 없음</p>}
      <h4>직접 수정한 요소</h4>{data.humanEdits.length ? <ul>{data.humanEdits.map((text, index) => <li key={index}>{text}</li>)}</ul> : <p>정보 없음</p>}
      <h4>출처</h4>{!data.sources.length && <p>출처 없음</p>}
      {data.sources.map((source, index) => <section key={`${source.sourceId}/${index}`}>
        <h5>{source.title}</h5><p>{source.kind === 'USER_STATEMENT' ? '사용자 진술' : source.kind}</p>
        {source.quote && <blockquote>{source.quote}</blockquote>}{source.locator && <p>{source.locator}</p>}
        {source.officialUrl && /^https?:\/\//i.test(source.officialUrl) && <a href={source.officialUrl} target="_blank" rel="noreferrer">공식 자료 보기</a>}
        <dl>{(Object.keys(metadata) as (keyof typeof metadata)[]).map((key) => source[key] && <div key={key}><dt>{metadata[key]}</dt><dd>{source[key]}</dd></div>)}</dl>
      </section>)}
    </div>}
  </ModalShell>;
}
