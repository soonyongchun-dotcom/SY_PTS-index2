import React, { useState } from 'react';
import { Box, Button, TextField, Typography } from '@mui/material';

interface GreenSpeedFormProps {
  onNext: (speed: string) => void;
}

export default function GreenSpeedForm({ onNext }: GreenSpeedFormProps) {
  const [speed, setSpeed] = useState('2.7');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = parseFloat(speed);
    if (Number.isNaN(value)) return;
    onNext(value.toFixed(2));
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="subtitle1" align="center">
        그린 스피드 입력 (Green Speed Input)
      </Typography>
      <TextField
        label="그린 스피드 (Green Speed)"
        type="number"
        value={speed}
        onChange={e => setSpeed(e.target.value)}
        inputProps={{ min: 1, max: 5, step: 'any' }}
        fullWidth
        size="small"
      />
      <Button type="submit" variant="contained" fullWidth>
        다음
      </Button>
    </Box>
  );
}
