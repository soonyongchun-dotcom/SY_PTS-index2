import React, { useEffect, useState } from 'react';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import LoginForm, { LoginFormData, ADMIN_ID, ADMIN_PASSCODE } from './LoginForm';
import GreenSpeedForm from './GreenSpeedForm';
import PuttingPracticeForm, { PracticeInput } from './PuttingPracticeForm';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Collapse from '@mui/material/Collapse';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction';
import ListItemText from '@mui/material/ListItemText';
import TextField from '@mui/material/TextField';
import DownloadIcon from '@mui/icons-material/Download';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

export interface Practice {
  distance: string;
  conditions: string[];
  result: string;
  time: Date;
}

interface User {
  id: string;
  sessionDate: string;
  isAdmin: boolean;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [managedUsers, setManagedUsers] = useState<Array<{ id: string; passcode: string }>>(() => {
    try {
      const raw = localStorage.getItem('managedUsers');
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  });
  const [openManager, setOpenManager] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [greenSpeed, setGreenSpeed] = useState<string | null>(null);
  const [practices, setPractices] = useState<Practice[]>([]);
  const [entryTime, setEntryTime] = useState<Date | null>(null);
  const [exitTime, setExitTime] = useState<Date | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const storageKeyFor = (userId: string) => `puttingState:${userId}`;

  const loadStoredState = (userId: string) => {
    try {
      const raw = localStorage.getItem(storageKeyFor(userId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as {
        greenSpeed: string | null;
        practices: Practice[];
        entryTime: string | null;
        exitTime: string | null;
        showAnalysis: boolean;
      };
      return {
        greenSpeed: parsed.greenSpeed,
        practices: parsed.practices ?? [],
        entryTime: parsed.entryTime ? new Date(parsed.entryTime) : null,
        exitTime: parsed.exitTime ? new Date(parsed.exitTime) : null,
        showAnalysis: parsed.showAnalysis ?? false,
      };
    } catch {
      return null;
    }
  };

  const saveStateForUser = (userId: string) => {
    try {
      localStorage.setItem(
        storageKeyFor(userId),
        JSON.stringify({
          greenSpeed,
          practices,
          entryTime: entryTime?.toISOString() ?? null,
          exitTime: exitTime?.toISOString() ?? null,
          showAnalysis,
        }),
      );
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    saveStateForUser(user.id);
  }, [user?.id, greenSpeed, practices, entryTime, exitTime, showAnalysis]);

  const authenticate = async (id: string, passcode: string) => {
    // 서버리스 인증 함수 호출 (Vercel/Netlify 등에서 /api/auth로 구성)
    // GitHub Pages처럼 서버리스가 없으면 405 에러가 발생하므로 로컬 방식으로 폴백합니다.
    try {
      const resp = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, passcode }),
      });
      if (!resp.ok) throw new Error('인증 실패');
      const body = await resp.json();
      return body;
    } catch {
      // 로컬 인증 방식을 사용 (GitHub Pages 등에서는 /api/auth가 존재하지 않음)
      const isAdmin = id === ADMIN_ID && passcode === ADMIN_PASSCODE;
      if (isAdmin) return { isAdmin: true };
      const match = managedUsers.find(u => u.id === id && u.passcode === passcode);
      if (match) return { isAdmin: false };
      throw new Error('ID 또는 Passcode가 올바르지 않습니다.');
    }
  };

  const handleLogin = async (data: LoginFormData) => {
    const result = await authenticate(data.id, data.passcode);
    setUser({ id: data.id, sessionDate: data.sessionDate, isAdmin: !!result.isAdmin });

    const stored = loadStoredState(data.id);
    if (stored) {
      setGreenSpeed(stored.greenSpeed);
      setPractices(stored.practices ?? []);
      setEntryTime(stored.entryTime);
      setExitTime(stored.exitTime);
      setShowAnalysis(stored.showAnalysis);
    } else {
      setEntryTime(new Date());
    }
  };

  const handleAddUser = (id: string, passcode: string) => {
    setManagedUsers(prev => {
      const existingIndex = prev.findIndex(u => u.id === id);
      let next;
      if (existingIndex >= 0) {
        next = [...prev];
        next[existingIndex] = { id, passcode };
      } else {
        next = [...prev, { id, passcode }];
      }
      try {
        localStorage.setItem('managedUsers', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleRemoveUser = (id: string) => {
    setManagedUsers(prev => {
      const next = prev.filter(u => u.id !== id);
      try {
        localStorage.setItem('managedUsers', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const backgroundUrl =
    './background.jpg';

  const sanitizeFileName = (input: string) =>
    input.replace(/[^a-zA-Z0-9-_]/g, '_').replace(/_+/g, '_');

  const getFileBaseName = () => {
    if (!user) return 'putting_practice';
    const name = sanitizeFileName(user.id);
    const date = sanitizeFileName(user.sessionDate);
    return `${name}_${date}`;
  };

  const exportToPdf = async () => {
    const base = getFileBaseName();

    const stats = analyze();
    const successRate = stats.total ? (stats.madeCount / stats.total) * 100 : 0;

    const greenSpeedNum = greenSpeed ? parseFloat(greenSpeed) : null;
    const bayesian = (success: number, total: number) => {
      const alpha = 1;
      const beta = 1;
      let p = (alpha + success) / (alpha + beta + total);
      if (greenSpeedNum !== null && (greenSpeedNum < 2.7 || greenSpeedNum > 3.0)) {
        p = Math.min(1, p + 0.1);
      }
      return p * 100;
    };

    const bayesScore = bayesian(stats.madeCount, stats.total);
    const bayesWeightedByDistance = stats.total
      ? Object.values(stats.bucketStats).reduce((acc, stat) => {
          const weight = stat.total / stats.total;
          return acc + weight * bayesian(stat.success, stat.total);
        }, 0)
      : 0;

    const contentWrapper = document.createElement('div');
    contentWrapper.style.position = 'absolute';
    contentWrapper.style.left = '-9999px';
    contentWrapper.style.top = '0';
    contentWrapper.style.width = '900px';
    contentWrapper.style.padding = '24px';
    contentWrapper.style.background = 'white';
    contentWrapper.style.color = '#000';
    contentWrapper.style.fontFamily = 'sans-serif';
    contentWrapper.style.lineHeight = '1.5';

    const makeHeading = (text: string) => {
      const h = document.createElement('h1');
      h.textContent = text;
      h.style.margin = '0 0 12px 0';
      h.style.fontSize = '24px';
      contentWrapper.appendChild(h);
    };

    const makeSectionTitle = (text: string) => {
      const h = document.createElement('h2');
      h.textContent = text;
      h.style.margin = '18px 0 8px 0';
      h.style.fontSize = '16px';
      h.style.borderBottom = '1px solid rgba(0,0,0,0.2)';
      h.style.paddingBottom = '4px';
      contentWrapper.appendChild(h);
    };

    const makeRow = (label: string, value: string) => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.margin = '2px 0';
      row.style.fontSize = '12px';

      const left = document.createElement('div');
      left.textContent = label;
      const right = document.createElement('div');
      right.textContent = value;

      row.appendChild(left);
      row.appendChild(right);
      contentWrapper.appendChild(row);
    };

    const makeTable = (rows: { label: string; value: string }[]) => {
      const table = document.createElement('div');
      table.style.border = '1px solid rgba(0,0,0,0.2)';
      table.style.borderRadius = '6px';
      table.style.padding = '10px';
      table.style.margin = '6px 0 0 0';
      rows.forEach(r => makeRow(r.label, r.value));
      return table;
    };

    makeHeading('SY-Putting Training Platforms');
    makeRow('ID', user?.id ?? '');
    makeRow('세션일', user?.sessionDate ?? '');
    makeRow('그린스피드', greenSpeed ?? '');

    makeSectionTitle('결과 분석 (Result Analysis)');

    makeSectionTitle('거리별 성공률 (Success Rate by Distance)');
    const distanceRows = Object.entries(stats.bucketStats).map(([label, stat]) => {
      const rate = stat.total ? (stat.success / stat.total) * 100 : 0;
      const bayes = bayesian(stat.success, stat.total);
      return {
        label,
        value: `${rate.toFixed(1)}% (${stat.success}/${stat.total}) 예측 ${bayes.toFixed(1)}%`,
      };
    });
    contentWrapper.appendChild(makeTable(distanceRows));

    makeSectionTitle('조건별 성공률 (Success Rate by Condition)');
    const conditionRows = Object.values(stats.conditionStats).map(stat => {
      const rate = stat.total ? (stat.success / stat.total) * 100 : 0;
      return {
        label: stat.label,
        value: `${rate.toFixed(1)}% (${stat.success}/${stat.total})`,
      };
    });
    contentWrapper.appendChild(makeTable(conditionRows));

    makeSectionTitle('베이지안 예측 (Bayesian Estimate)');
    makeRow('온그린 시 평균 퍼팅 개수 예상', bayesScore.toFixed(1));
    makeRow('거리 가중 예측', `${bayesWeightedByDistance.toFixed(1)} (거리별 성공률 기반 가중 평균)`);
    makeRow('현재 성공률', `${successRate.toFixed(1)}% — ${stats.madeCount}/${stats.total}`);
    if (greenSpeedNum !== null && (greenSpeedNum < 2.7 || greenSpeedNum > 3.0)) {
      makeRow('보정 안내', '그린스피드가 2.7-3.0 범위를 벗어나므로 +10% 보정 적용');
    }

    if (stats.feedback.length) {
      makeSectionTitle('분석 피드백 (Feedback)');
      stats.feedback.forEach(line => {
        const p = document.createElement('div');
        p.textContent = `• ${line}`;
        p.style.margin = '2px 0';
        p.style.fontSize = '12px';
        contentWrapper.appendChild(p);
      });
    }

    document.body.appendChild(contentWrapper);
    const canvas = await html2canvas(contentWrapper, { scale: 2 });
    document.body.removeChild(contentWrapper);

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${base}.pdf`);
  };

  const exportToExcel = () => {
    const base = getFileBaseName();

    const worksheetData = practices.map((p, i) => ({
      번호: i + 1,
      거리: `${p.distance}yd`,
      조건: p.conditions.join(', '),
      결과: p.result,
      시간: p.time.toLocaleString(),
    }));
    const worksheet = XLSX.utils.json_to_sheet(worksheetData);

    const analysisData: any[] = [];
    Object.entries(stats.conditionDistanceCounts).forEach(([cond, distances]) => {
      Object.entries(distances).forEach(([bucket, count]) => {
        analysisData.push({
          조건: cond,
          거리구간: bucket,
          퍼팅횟수: count,
        });
      });
    });

    const analysisSheet = XLSX.utils.json_to_sheet(analysisData);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '연습기록');
    XLSX.utils.book_append_sheet(workbook, analysisSheet, '분석데이터');
    XLSX.writeFile(workbook, `${base}.xlsx`);
  };

  const HEADER_HEIGHT = 64;

  const Header = () => (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: HEADER_HEIGHT,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1300,
        background: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="h6" color="common.white">
          SY-Putting Training Platforms
        </Typography>
        <Typography variant="caption" color="common.white">
          ver26.3.1
        </Typography>
      </Box>
    </Box>
  );

  if (!user) {
    return (
      <Box
        sx={{
          position: 'relative',
          minHeight: '100vh',
          width: '100vw',
          backgroundImage: `url(${backgroundUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2,
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: 'rgba(0,0,0,0.45)',
            zIndex: 1,
          }}
        />
        <Header />
        <Card
          sx={{
            width: '100%',
            maxWidth: 380,
            zIndex: 2,
            opacity: 0.98,
            borderRadius: 3,
            boxShadow: 12,
          }}
        >
          <CardContent>
            <LoginForm onSubmit={handleLogin} />
          </CardContent>
        </Card>
      </Box>
    );
  }
  if (!greenSpeed) {
    return (
      <Box sx={{ pt: '84px', minHeight: '100vh', background: 'rgba(255,255,255,0.85)' }}>
        <Header />
        {user?.isAdmin && (
          <Box sx={{ position: 'fixed', top: HEADER_HEIGHT + 8, right: 16, zIndex: 1400, display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setOpenManager(true)}
            >
              선수관리 (Player Manager)
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                const data = JSON.stringify(managedUsers, null, 2);
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'managedUsers.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
            >
              내보내기 (Export)
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'application/json';
                input.onchange = e => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    try {
                      const parsed = JSON.parse(reader.result as string);
                      if (Array.isArray(parsed)) {
                        setManagedUsers(parsed);
                        localStorage.setItem('managedUsers', JSON.stringify(parsed));
                      }
                    } catch {
                      // ignore
                    }
                  };
                  reader.readAsText(file);
                };
                input.click();
              }}
            >
              불러오기 (Import)
            </Button>
          </Box>
        )}
        <Container maxWidth="xs" sx={{ mt: 2 }}>
          <GreenSpeedForm onNext={setGreenSpeed} />
        </Container>

        <Dialog open={openManager} onClose={() => setOpenManager(false)} fullWidth maxWidth="sm">
          <DialogTitle>선수 관리</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
              <TextField
                label="ID"
                value={newUserId}
                onChange={e => setNewUserId(e.target.value)}
                size="small"
                sx={{ flex: 1 }}
              />
              <TextField
                label="Passcode"
                value={newUserPass}
                onChange={e => setNewUserPass(e.target.value)}
                size="small"
                type="password"
                sx={{ flex: 1 }}
              />
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={() => {
                  if (!newUserId.trim() || !newUserPass.trim()) return;
                  handleAddUser(newUserId.trim(), newUserPass.trim());
                  setNewUserId('');
                  setNewUserPass('');
                }}
              >
                추가
              </Button>
            </Box>

            <List dense>
              {managedUsers.map(user => (
                <ListItem key={user.id} divider>
                  <ListItemText primary={user.id} secondary={`Passcode: ${user.passcode}`} />
                  <ListItemSecondaryAction>
                    <IconButton edge="end" onClick={() => handleRemoveUser(user.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
              {managedUsers.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  등록된 사용자가 없습니다.
                </Typography>
              )}
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenManager(false)}>닫기</Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  const handlePractice = (practice: PracticeInput) =>
    setPractices([...practices, { ...practice, time: new Date() }]);

  const handleDeletePractice = (index: number) => {
    setPractices(prev => prev.filter((_, i) => i !== index));
  };

  const distanceBuckets = [
    { label: '1-3yd', min: 1, max: 3 },
    { label: '3-5yd', min: 3, max: 5 },
    { label: '5-7yd', min: 5, max: 7 },
    { label: '7-9yd', min: 7, max: 9 },
    { label: '9+yd', min: 9, max: Infinity },
  ];

  const normalize = (value: string) => value.trim().toLowerCase();
  const isMade = (result: string) => normalize(result).includes('홀인') || normalize(result).includes('made');
  const isThreePutt = (result: string) => normalize(result).includes('3퍼팅') || normalize(result).includes('3-putt');

  type ConditionStat = { success: number; total: number; label: string };

  const analyze = () => {
    const total = practices.length;
    const missCounts: Record<string, number> = {};
    const conditionStats: Record<string, ConditionStat> = {};
    const bucketStats: Record<string, { success: number; total: number }> = {};
    const conditionDistanceCounts: Record<string, Record<string, number>> = {};
    let madeCount = 0;
    let threePuttCount = 0;


    distanceBuckets.forEach(b => {
      bucketStats[b.label] = { success: 0, total: 0 };
    });

    practices.forEach(p => {
      const distance = parseFloat(p.distance);
      const made = isMade(p.result);

      const bucket = distanceBuckets.find(b => distance >= b.min && distance < b.max) ?? distanceBuckets[distanceBuckets.length - 1];
      bucketStats[bucket.label].total += 1;
      if (made) bucketStats[bucket.label].success += 1;

      const combinedConditionKey = p.conditions
        .map(normalize)
        .filter(Boolean)
        .sort()
        .join('');
      const combinedLabel = p.conditions
        .map(c => c.split(' ')[0])
        .join('');
      if (combinedConditionKey) {
        if (!conditionStats[combinedConditionKey]) {
          conditionStats[combinedConditionKey] = { success: 0, total: 0, label: combinedLabel };
        }
        conditionStats[combinedConditionKey].total += 1;
        if (made) conditionStats[combinedConditionKey].success += 1;

        if (!conditionDistanceCounts[combinedConditionKey]) {
          conditionDistanceCounts[combinedConditionKey] = {};
        }
        const bucketKey = bucket.label;
        conditionDistanceCounts[combinedConditionKey][bucketKey] = (conditionDistanceCounts[combinedConditionKey][bucketKey] ?? 0) + 1;
      }

      const key = normalize(p.result);
      missCounts[key] = (missCounts[key] ?? 0) + 1;
      if (made) madeCount += 1;
      if (isThreePutt(p.result)) threePuttCount += 1;
    });

    const mostCommonMiss = Object.entries(missCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';

    const feedback = [] as string[];
    if (mostCommonMiss.includes('우측미스') || mostCommonMiss.includes('miss right')) {
      feedback.push('우측으로 미스가 많은 편입니다. 스탠스/임팩트 시 클로즈 페이스를 확인해보세요.');
    }
    if (mostCommonMiss.includes('좌측미스') || mostCommonMiss.includes('miss left')) {
      feedback.push('좌측으로 미스가 많은 편입니다. 페이스 각도를 다시 체크해보세요.');
    }
    if (mostCommonMiss.includes('짧은') || mostCommonMiss.includes('short')) {
      feedback.push('거리 부족 미스가 자주 발생합니다. 임팩트 강도와 페이스 컨트롤을 연습하세요.');
    }
    if (mostCommonMiss.includes('3퍼팅') || mostCommonMiss.includes('3-putt')) {
      feedback.push('3퍼팅이 많이 발생합니다. 퍼팅 라인 파악과 거리 감각 연습을 강화하세요.');
    }

    return { total, bucketStats, conditionStats, missCounts, feedback, conditionDistanceCounts, madeCount, threePuttCount };
  };

  const stats = analyze();
  const greenSpeedNum = greenSpeed ? parseFloat(greenSpeed) : null;

  const threePuttRate = stats.total ? (stats.threePuttCount / stats.total) * 100 : 0;

  const bayesianEstimate = (success: number, total: number) => {
    const alpha = 1;
    const beta = 1;
    let p = (alpha + success) / (alpha + beta + total);

    // 그린스피드가 너무 느리거나 빠르면 실제 경기와 매칭이 어려워
    // 성공률을 약간 더 긍정적으로 (약 +10%) 조정하여 예측을 보정합니다.
    if (greenSpeedNum !== null && (greenSpeedNum < 2.7 || greenSpeedNum > 3.0)) {
      p = Math.min(1, p + 0.1);
    }

    return 1 + 2 * (1 - p);
  };
  const bayesScore = bayesianEstimate(stats.madeCount, stats.total);
  const successRate = stats.total ? (stats.madeCount / stats.total) * 100 : 0;

  // 거리별 베이지안 예측을 전체에 가중평균으로 반영
  const bayesWeightedByDistance = stats.total
    ? Object.values(stats.bucketStats).reduce((acc, stat) => {
        const weight = stat.total / stats.total;
        return acc + weight * bayesianEstimate(stat.success, stat.total);
      }, 0)
    : 0;

  const recentPractices = [...practices].slice().reverse();

  const renderBar = (percent: number) => (
    <Box sx={{ width: '100%', bgcolor: '#eee', borderRadius: 1, overflow: 'hidden' }}>
      <Box sx={{ width: `${percent}%`, height: 8, bgcolor: 'primary.main' }} />
    </Box>
  );

  const bayesian = (success: number, total: number) => {
    const alpha = 1;
    const beta = 1;
    return ((alpha + success) / (alpha + beta + total)) * 100;
  };

  const handleResetSession = () => {
    if (user?.id) {
      try {
        localStorage.removeItem(storageKeyFor(user.id));
      } catch {
        // ignore
      }
    }
    setUser(null);
    setGreenSpeed(null);
    setPractices([]);
    setEntryTime(null);
    setExitTime(null);
    setShowAnalysis(false);
  };

  return (
    <Box sx={{ pt: '84px', pb: 4, minHeight: '100vh', background: 'rgba(255,255,255,0.85)' }}>
      <Header />
      {user?.isAdmin && (
        <Box sx={{ position: 'fixed', top: HEADER_HEIGHT + 8, right: 16, zIndex: 1400 }}>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setOpenManager(true)}
          >
            선수관리
          </Button>
        </Box>
      )}
      <Container maxWidth="sm" sx={{ mt: 2, mb: 6 }}>

        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              퍼팅 입력 (Putting Input)
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <Button
                onClick={() => setGreenSpeed(null)}
                color="secondary"
                variant="outlined"
                size="small"
              >
                뒤로가기 (Back)
              </Button>
              <Button
                onClick={handleResetSession}
                color="secondary"
                variant="contained"
                size="small"
              >
                새로운 퍼팅 (New Putting)
              </Button>
            </Box>
            <PuttingPracticeForm onSubmit={handlePractice} />
          </CardContent>
        </Card>

        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle1">연습 기록 (Practice Log)</Typography>
              <Box>
                <IconButton onClick={exportToPdf} size="small" title="PDF로 저장">
                  <DownloadIcon />
                </IconButton>
                <IconButton onClick={exportToExcel} size="small" title="Excel로 저장">
                  <DownloadIcon />
                </IconButton>
              </Box>
            </Box>
            <Divider sx={{ my: 1 }} />
            <Box
              component="ul"
              sx={{
                pl: 2,
                m: 0,
                listStyle: 'none',
                maxHeight: 160,
                overflowY: 'auto',
                fontSize: '0.85rem',
              }}
            >
              {recentPractices.map((p, i) => (
                <Box
                  key={i}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 0.5,
                    p: 1,
                    borderRadius: 1,
                    bgcolor: 'background.paper',
                    boxShadow: 1,
                  }}
                >
                  <Box sx={{ wordBreak: 'break-word' }}>
                    {p.distance}yd [{p.conditions.join(', ')}] - {p.result}
                  </Box>
                  <IconButton size="small" onClick={() => handleDeletePractice(practices.length - 1 - i)}>
                    <DeleteIcon />
                  </IconButton>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>

        <Button
          variant="outlined"
          fullWidth
          sx={{ mt: 2 }}
          onClick={() => setShowAnalysis(prev => !prev)}
        >
          {showAnalysis ? '결과 분석 접기 (Hide Result Analysis)' : '결과 분석 보기 (Show Result Analysis)'}
        </Button>

        <Collapse in={showAnalysis}>
          <Card sx={{ mt: 2, bgcolor: 'rgba(240, 248, 255, 0.8)', border: '1px solid rgba(0,0,0,0.12)' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                결과 분석 (Result Analysis)
              </Typography>

              <Typography variant="subtitle2" sx={{ mt: 1 }}>
                거리별 성공률 (Success Rate by Distance)
              </Typography>
              {Object.entries(stats.bucketStats).map(([label, stat]) => {
                const rate = stat.total ? (stat.success / stat.total) * 100 : 0;
                const bayes = bayesian(stat.success, stat.total);
                return (
                  <Box key={label} sx={{ mt: 1 }}>
                    <Typography variant="body2">
                      {label} - 성공률: {rate.toFixed(1)}% ({stat.success}/{stat.total} 성공/시도, 예측 {bayes.toFixed(1)}%)
                    </Typography>
                    {renderBar(rate)}
                  </Box>
                );
              })}

              <Typography variant="subtitle2" sx={{ mt: 2 }}>
                조건별 성공률 (Success Rate by Condition)
              </Typography>
              {Object.values(stats.conditionStats).map(stat => {
                const rate = stat.total ? (stat.success / stat.total) * 100 : 0;
                return (
                  <Box key={stat.label} sx={{ mt: 1 }}>
                    <Typography variant="body2">
                      {stat.label} - 성공률: {rate.toFixed(1)}% ({stat.success}/{stat.total} 성공/시도)
                    </Typography>
                    {renderBar(rate)}
                  </Box>
                );
              })}

              <Box sx={{ p: 2, borderRadius: 1, bgcolor: 'rgba(200, 230, 255, 0.7)', mb: 2 }}>
                <Typography variant="subtitle2">베이지안 예측 (Bayesian Estimate)</Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  온그린 시 평균 퍼팅 개수 예상: <strong>{bayesScore.toFixed(2)}</strong>
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  <strong>거리 가중 예측:</strong> <strong>{bayesWeightedByDistance.toFixed(2)}</strong> (거리별 성공률 기반 가중 평균)
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  퍼팅성공율 (퍼팅성공/총퍼팅시도): <strong>{stats.madeCount}/{stats.total}</strong> ({successRate.toFixed(1)}%)
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  3퍼팅확율 (3퍼팅수/총퍼팅횟수): <strong>{stats.threePuttCount}/{stats.total}</strong> ({threePuttRate.toFixed(1)}%)
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  (베이시안 모델: α=1, β=1 사전분포 + 관측 성공/실패 값 기반)
                </Typography>
                {greenSpeedNum !== null && (greenSpeedNum < 2.7 || greenSpeedNum > 3.0) && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    ※ 현재 그린스피드 {greenSpeedNum.toFixed(1)}는 2.7-3.0 범위를 벗어나므로 성공률에 10% 가감 보정이 적용됩니다.
                  </Typography>
                )}
              </Box>

              <Box sx={{ p: 2, borderRadius: 1, bgcolor: 'rgba(255, 240, 240, 0.7)' }}>
                <Typography variant="subtitle2">분석 피드백 (Feedback)</Typography>
                {stats.feedback.length ? (
                  stats.feedback.map((line, idx) => (
                    <Typography variant="body2" key={idx} sx={{ mt: 0.5 }}>
                      - {line}
                    </Typography>
                  ))
                ) : (
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    충분한 데이터가 없습니다. 더 많은 퍼팅 데이터를 추가하세요.
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Collapse>


        <Box sx={{ height: 70 }} /> {/* 하단 버튼 공간 확보 */}
      </Container>

      <Dialog open={openManager} onClose={() => setOpenManager(false)} fullWidth maxWidth="sm">
        <DialogTitle>선수 관리</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            <TextField
              label="ID"
              value={newUserId}
              onChange={e => setNewUserId(e.target.value)}
              size="small"
              sx={{ flex: 1 }}
            />
            <TextField
              label="Passcode"
              value={newUserPass}
              onChange={e => setNewUserPass(e.target.value)}
              size="small"
              type="password"
              sx={{ flex: 1 }}
            />
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => {
                if (!newUserId.trim() || !newUserPass.trim()) return;
                handleAddUser(newUserId.trim(), newUserPass.trim());
                setNewUserId('');
                setNewUserPass('');
              }}
            >
              추가
            </Button>
          </Box>

          <List dense>
            {managedUsers.map(user => (
              <ListItem key={user.id} divider>
                <ListItemText primary={user.id} secondary={`Passcode: ${user.passcode}`} />
                <ListItemSecondaryAction>
                  <IconButton edge="end" onClick={() => handleRemoveUser(user.id)}>
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
            {managedUsers.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                등록된 사용자가 없습니다.
              </Typography>
            )}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenManager(false)}>닫기</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
