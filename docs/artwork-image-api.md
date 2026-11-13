# 최종 작품 이미지 조회

- 요청: `GET /api/projects/{projectId}/artwork/image`
- 서버 주소: `.env`의 `VITE_API_BASE_URL` (예시는 `.env.example` 참고). 변경 후 개발 서버를 재시작합니다.
- 인증: `localStorage.getItem('accessToken')`에서 JWT를 읽어 `Authorization: Bearer ...`로 전달합니다. 로그인 API는 아직 목업이므로 로그인 연동 시 이 저장 규칙을 연결해야 합니다.
- 서버가 다른 origin에 있으면 프런트엔드 origin 및 Authorization 헤더에 대한 CORS 허용이 필요합니다.

`src/api/artwork.ts`가 PNG/JPEG 바이너리를 Blob으로 읽습니다. 오류 상태는 사용자 메시지로 표시하며, 오류 JSON을 이미지로 취급하지 않습니다. `useArtworkImage`는 요청 취소와 object URL 해제를 처리합니다.

최종 작품 탭에서 실제 서버 프로젝트 ID로 조회합니다. 현재 프로젝트 목록과 생성은 목업이므로 실제 조회에는 프로젝트 목록 API 연동 또는 스토어에 실제 숫자 ID를 가진 프로젝트가 필요합니다. 임시 UUID나 목업 ID를 서버 ID로 변환하지 않습니다. 잘못된 ID 또는 인증 오류에서도 등록 폼은 표시되지만 저장 요청은 유효한 숫자 ID와 토큰이 있어야 가능합니다.

서버 이미지가 있고 로컬 작품 정보가 없으면 이미지 카드와 교체 버튼을 표시합니다. 이 API에는 설명/등록 시각이 없으므로 해당 정보를 생성하지 않습니다.

## 이미지 등록·교체

`PATCH /api/projects/{projectId}/artwork/image`로 `FormData`의 `file` 필드를 전송합니다. multipart Content-Type과 boundary는 브라우저가 설정합니다. 성공 응답 `data.artworkId`, `data.projectId`, `data.fileName`을 확인한 뒤 GET을 다시 요청합니다. 중복 저장은 차단하고 실패 시 기존 작품과 폼 입력을 유지합니다.

등록 폼의 설명 및 등록 시각은 로컬에만 저장합니다. 설명 저장과 최종 작품 자체 생성은 별도 API 명세가 필요합니다. PATCH의 404는 프로젝트 또는 최종 작품이 없다는 의미이며 이미지 업로드가 최종 작품 생성까지 수행한다고 가정하지 않습니다.

검증: `npm run build`, `npm run lint`. 실제 서버 통합 검증에는 서버 주소, 유효한 JWT 및 접근 가능한 프로젝트 ID가 필요합니다.
