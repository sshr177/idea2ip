import { useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import AuthLayout from '../components/AuthLayout';
import Button from '../components/Button';
import TextField from '../components/TextField';
import { AlertSlot, Fields, FooterLink, Form } from '../components/AuthForm.styles';
import { useAlertModal } from '../hooks/useAlertModal';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/auth';
import { useProjectStore } from '../store/projectStore';

// 로그인 페이지

export default function LoginPage() {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const idRef = useRef<HTMLInputElement>(null);
  const pwRef = useRef<HTMLInputElement>(null);
  const { showAlert, alertNode } = useAlertModal();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;

    if (!id.trim()) {
      showAlert('아이디를 입력해주세요.');
      idRef.current?.focus();
      return;
    }
    if (!password) {
      showAlert('비밀번호를 입력해주세요.');
      pwRef.current?.focus();
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const { accessToken } = await login({ loginId: id.trim(), password });
      try {
        localStorage.setItem('accessToken', accessToken);
      } catch {
        throw new Error('인증 정보를 저장할 수 없습니다. 브라우저 저장소 설정을 확인해주세요.');
      }
      useProjectStore.setState({ projects: [], materialsByProjectId: {}, finalWorkByProjectId: {}, interviewByProjectId: {}, briefByProjectId: {} });
      navigate('/', { replace: true });
    } catch (error) {
      showAlert(error instanceof Error ? error.message : '로그인하지 못했습니다.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <Form onSubmit={handleSubmit} noValidate aria-busy={isSubmitting}>
        <Fields>
          <TextField
            ref={idRef}
            label="아이디"
            name="id"
            autoComplete="username"
            placeholder="아이디를 입력해주세요."
            value={id}
            readOnly={isSubmitting}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setId(e.target.value)}
          />
          <TextField
            ref={pwRef}
            label="비밀번호"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="비밀번호를 입력해주세요."
            value={password}
            readOnly={isSubmitting}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
          />
        </Fields>
        <AlertSlot>{alertNode}</AlertSlot>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? '로그인 중…' : '로그인하기'}
        </Button>
        <FooterLink to="/signup">회원가입</FooterLink>
      </Form>
    </AuthLayout>
  );
}
