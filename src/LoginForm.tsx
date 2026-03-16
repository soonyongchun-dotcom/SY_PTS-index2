import React, { useState } from 'react';
import { Alert, Box, Button, TextField, Typography } from '@mui/material';

export interface LoginFormData {
  id: string;
  passcode: string;
  sessionDate: string;
}

interface LoginFormProps {
  onSubmit: (data: LoginFormData) => Promise<void>;
}

const today = new Date().toISOString().slice(0, 10);

export default function LoginForm({ onSubmit }: LoginFormProps) {
  const [id, setId] = useState('');
  const [passcode, setPasscode] = useState('');
  const [sessionDate, setSessionDate] = useState(today);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!id.trim() || !passcode.trim() || !sessionDate) {
      setError('ID, Passcode, 날짜를 모두 입력해주세요.');
      return;
    }

    setError('');
    try {
      await onSubmit({
        id: id.trim(),
        passcode: passcode.trim(),
        sessionDate,
      });
    } catch (err) {
      setError((err as Error).message || '로그인에 실패했습니다.');
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="subtitle1" align="center">
        로그인 (Login)
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <TextField
          label="ID"
          value={id}
          onChange={e => setId(e.target.value)}
          fullWidth
          size="small"
        />
        <TextField
          label="Passcode"
          type="password"
          value={passcode}
          onChange={e => setPasscode(e.target.value)}
          fullWidth
          size="small"
        />
      </Box>

      <TextField
        label="날짜 (Date)"
        type="date"
        value={sessionDate}
        onChange={e => setSessionDate(e.target.value)}
        fullWidth
        size="small"
        InputLabelProps={{ shrink: true }}
      />

      <Button type="submit" variant="contained" fullWidth>
        시작
      </Button>
    </Box>
  );
}
