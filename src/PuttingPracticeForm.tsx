import React, { useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  SelectChangeEvent,
  TextField,
} from '@mui/material';

export interface PracticeInput {
  distance: string;
  conditions: string[];
  result: string;
}

interface PuttingPracticeFormProps {
  onSubmit: (practice: PracticeInput) => void;
}

const CONDITION_OPTIONS = [
  '평지 (Flat)',
  '오르막경사 (Uphill)',
  '내리막경사 (Downhill)',
  '훅라이 (Hook Lie)',
  '슬라이스라이 (Slice Lie)',
  '기타 (Other)',
];

const RESULT_OPTIONS = [
  '홀인 (Made)',
  '우측미스 (Miss Right)',
  '좌측미스 (Miss Left)',
  '짧은미스 (Short)',
  '3퍼팅 (3-Putt)',
  '기타 (Other)',
];

const selectMenuProps = {
  PaperProps: {
    style: {
      maxHeight: 224,
      width: 250,
    },
  },
};

export default function PuttingPracticeForm({ onSubmit }: PuttingPracticeFormProps) {
  const [distance, setDistance] = useState('5');
  const [conditions, setConditions] = useState<string[]>([CONDITION_OPTIONS[0]]);
  const [result, setResult] = useState(RESULT_OPTIONS[0]);

  const handleConditionsChange = (event: SelectChangeEvent<string[]>) => {
    const {
      target: { value },
    } = event;
    setConditions(typeof value === 'string' ? value.split(',') : value);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!distance.trim() || !result.trim()) return;

    onSubmit({
      distance: distance.trim(),
      conditions,
      result: result.trim(),
    });

    setDistance('5');
    setConditions([CONDITION_OPTIONS[0]]);
    setResult(RESULT_OPTIONS[0]);
  };

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="거리 (yd)"
          value={distance}
          onChange={e => setDistance(e.target.value)}
          fullWidth
          size="small"
          type="number"
          inputProps={{ min: 0, step: 1 }}
        />

        <FormControl fullWidth size="small">
          <InputLabel>조건 (중복 선택)</InputLabel>
          <Select
            multiple
            value={conditions}
            onChange={handleConditionsChange}
            input={<OutlinedInput label="조건 (중복 선택)" />}
            renderValue={selected => (selected as string[]).join(', ')}
            MenuProps={selectMenuProps}
          >
            {CONDITION_OPTIONS.map(option => (
              <MenuItem key={option} value={option}>
                <Checkbox checked={conditions.includes(option)} />
                <ListItemText primary={option} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth size="small">
          <InputLabel>결과</InputLabel>
          <Select
            value={result}
            label="결과"
            onChange={e => setResult(e.target.value)}
          >
            {RESULT_OPTIONS.map(option => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button type="submit" variant="contained" fullWidth>
          추가
        </Button>
      </Box>
    </Box>
  );
}
