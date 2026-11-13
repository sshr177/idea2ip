import { useState } from 'react';
import defaultThumbnail from '../assets/empty-folder.svg';

/** 공개 이미지이므로 img의 GET 요청을 사용하며 JWT를 보내지 않습니다. */
export default function ProjectThumbnail({ src }: { src?: string }) {
  const [failedSource, setFailedSource] = useState<string>();
  const useDefault = !src || failedSource === src;
  return (
    <img
      src={useDefault ? defaultThumbnail : src}
      alt=""
      loading="lazy"
      onError={useDefault ? undefined : () => setFailedSource(src)}
    />
  );
}
