import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line
} from 'recharts';
import { Box, Text, VStack, HStack, Badge, SimpleGrid, useColorModeValue } from '@chakra-ui/react';

interface DayVoteResult {
  count: number;
  participants: Array<{
    userId: number;
    userName: string;
    votedAt: string;
  }>;
}

interface VoteResults {
  sessionId: number;
  weekStartDate: string;
  weekRange: string;
  isActive: boolean;
  isCompleted: boolean;
  results: {
    MON: DayVoteResult;
    TUE: DayVoteResult;
    WED: DayVoteResult;
    THU: DayVoteResult;
    FRI: DayVoteResult;
  };
  participants: Array<{
    userId: number;
    userName: string;
    selectedDays: string[];
    votedAt: string;
  }>;
  totalParticipants: number;
  totalVotes: number;
}

interface VoteChartsProps {
  voteResults: VoteResults;
}

const COLORS = ['#3182CE', '#38A169', '#DD6B20', '#805AD5', '#E53E3E'];

export default function VoteCharts({ voteResults }: VoteChartsProps) {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  // 디버깅을 위한 로그
  console.log('📊 VoteCharts 렌더링:', {
    voteResults: voteResults ? '있음' : '없음',
    results: voteResults?.results,
    totalParticipants: voteResults?.totalParticipants,
    weekStartDate: voteResults?.weekStartDate
  });
  
  // 각 요일별 투표 수 상세 로그
  if (voteResults?.results) {
    Object.entries(voteResults.results).forEach(([day, data]) => {
      console.log(`📊 ${day}: ${data.count}명`, data.participants);
    });
  }

  // 막대 차트용 데이터 변환 (날짜 포함) - 간단하고 확실한 버전
  if (!voteResults || !voteResults.weekStartDate || !voteResults.results) {
    return (
      <Box p={6} bg={bgColor} borderRadius="lg" border="1px" borderColor={borderColor}>
        <Text textAlign="center" color="gray.500">
          투표 결과 데이터가 없습니다.
        </Text>
      </Box>
    );
  }

  const weekStartDate = new Date(voteResults.weekStartDate);
  const barChartData = Object.entries(voteResults.results).map(([day, data], index) => {
    const currentDate = new Date(weekStartDate.getTime() + index * 24 * 60 * 60 * 1000);
    const dayName = day === 'MON' ? '월' : day === 'TUE' ? '화' : day === 'WED' ? '수' : day === 'THU' ? '목' : '금';
    const chartData = {
      day: `${currentDate.getMonth() + 1}.${currentDate.getDate()}.(${dayName})`,
      votes: data.count,
      participants: data.participants.map(p => p.userName).join(', ') || '없음'
    };
    console.log(`📊 차트 데이터 변환: ${day} -> `, chartData);
    return chartData;
  });
  
  console.log('📊 최종 barChartData:', barChartData);
  
  // 차트 렌더링 여부 확인
  const hasVoteData = barChartData.some(data => data.votes > 0);
  console.log('📊 차트 렌더링 조건:', {
    hasVoteData,
    barChartDataLength: barChartData.length,
    shouldRenderChart: hasVoteData && barChartData.length > 0
  });

  // 데이터가 없으면 빈 상태 표시
  if (!voteResults || !voteResults.results) {
    return (
      <Box textAlign="center" py={8}>
        <Text color="gray.500">투표 데이터가 없습니다.</Text>
      </Box>
    );
  }

  // 도넛 차트용 데이터 변환
  const pieChartData = Object.entries(voteResults.results)
    .filter(([, data]) => data.count > 0)
    .map(([day, data]) => ({
      name: day === 'MON' ? '월' : day === 'TUE' ? '화' : day === 'WED' ? '수' : day === 'THU' ? '목' : '금',
      value: data.count,
      participants: data.participants.map(p => p.userName)
    }));

  // 시간대별 투표 분포 (참여자별)
  const timeDistributionData = voteResults.participants.map(participant => ({
    name: participant.userName,
    votes: participant.selectedDays.length,
    votedAt: new Date(participant.votedAt).toLocaleTimeString('ko-KR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <Box bg={bgColor} p={3} borderRadius="md" shadow="lg" border="1px" borderColor={borderColor}>
          <Text fontWeight="bold" mb={1}>{label}요일</Text>
          <Text color="blue.600">투표 수: {payload[0].value}명</Text>
          {payload[0].payload.participants && payload[0].payload.participants !== '없음' && (
            <Text color="gray.600" fontSize="sm" mt={1}>
              참여자: {payload[0].payload.participants}
            </Text>
          )}
        </Box>
      );
    }
    return null;
  };

  const PieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Box bg={bgColor} p={3} borderRadius="md" shadow="lg" border="1px" borderColor={borderColor}>
          <Text fontWeight="bold" mb={1}>{data.name}요일</Text>
          <Text color="blue.600">투표 수: {data.value}명</Text>
          {data.participants && data.participants.length > 0 && (
            <Text color="gray.600" fontSize="sm" mt={1}>
              참여자: {data.participants.join(', ')}
            </Text>
          )}
        </Box>
      );
    }
    return null;
  };

  return (
    <VStack spacing={8} align="stretch">
      {/* 요일별 투표 수 막대 차트 */}
      <Box 
        bg={bgColor} 
        p={6} 
        borderRadius="lg" 
        shadow="sm" 
        border="1px" 
        borderColor={borderColor}
        role="img"
        aria-label="요일별 투표 분포 막대 차트"
      >
        <Text fontSize="xl" fontWeight="bold" mb={4} color="gray.700">
          📊 요일별 투표 분포
        </Text>
        {hasVoteData ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis 
                dataKey="day" 
                tick={{ fontSize: 14, fill: '#4A5568' }}
                axisLine={{ stroke: '#CBD5E0' }}
              />
              <YAxis 
                tick={{ fontSize: 14, fill: '#4A5568' }}
                axisLine={{ stroke: '#CBD5E0' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="votes" 
                fill="#3182CE" 
                radius={[4, 4, 0, 0]}
                stroke="#2B6CB0"
                strokeWidth={1}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Box textAlign="center" py={8}>
            <Text color="gray.500" fontSize="lg">투표 데이터가 없습니다.</Text>
            <Text color="gray.400" fontSize="sm" mt={2}>
              barChartData: {JSON.stringify(barChartData, null, 2)}
            </Text>
          </Box>
        )}
        {/* 접근성을 위한 데이터 테이블 */}
        <Box mt={4} p={3} bg="gray.50" borderRadius="md" display={{ base: "block", md: "none" }}>
          <Text fontSize="sm" fontWeight="bold" mb={2}>데이터 요약:</Text>
          {barChartData.map((data, index) => (
            <Text key={index} fontSize="sm" color="gray.600">
              {data.day}요일: {data.votes}명 투표
            </Text>
          ))}
        </Box>
      </Box>

      {/* 투표 비율 도넛 차트 */}
      {pieChartData.length > 0 && (
        <Box bg={bgColor} p={6} borderRadius="lg" shadow="sm" border="1px" borderColor={borderColor}>
          <Text fontSize="xl" fontWeight="bold" mb={4} color="gray.700">
            🍩 투표 비율 분포
          </Text>
          <VStack spacing={6} align="stretch" display={{ base: "block", md: "flex" }} direction={{ base: "column", md: "row" }}>
            <Box flex={1}>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={120}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value, entry) => (
                      <span style={{ color: entry.color, fontSize: '14px' }}>
                        {value}요일
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </Box>
            <Box flex={1}>
              <VStack spacing={3} align="stretch">
                {pieChartData.map((data, index) => (
                  <HStack key={data.name} justify="space-between" p={3} bg="gray.50" borderRadius="md">
                    <HStack>
                      <Box w={4} h={4} bg={COLORS[index % COLORS.length]} borderRadius="sm" />
                      <Text fontWeight="medium">{data.name}요일</Text>
                    </HStack>
                    <VStack spacing={1} align="end">
                      <Badge colorScheme="blue" variant="solid">
                        {data.value}명
                      </Badge>
                      <Text fontSize="xs" color="gray.500">
                        {((data.value / voteResults.totalParticipants) * 100).toFixed(1)}%
                      </Text>
                    </VStack>
                  </HStack>
                ))}
              </VStack>
            </Box>
          </VStack>
        </Box>
      )}

      {/* 참여자별 투표 현황 - 8열 그리드 */}
      <Box bg={bgColor} p={6} borderRadius="lg" shadow="sm" border="1px" borderColor={borderColor}>
        <Text fontSize="xl" fontWeight="bold" mb={4} color="gray.700">
          👥 참여자별 투표 현황
        </Text>
        <SimpleGrid columns={{ base: 2, sm: 3, md: 4, lg: 8 }} spacing={4}>
          {voteResults.participants.map((participant, index) => (
            <VStack key={participant.userId} p={3} bg="gray.50" borderRadius="md" spacing={2}>
              <Text fontSize="sm" fontWeight="bold" textAlign="center" color="blue.600">
                {participant.userName}
              </Text>
              <VStack spacing={1}>
                {participant.selectedDays
                  .sort((a, b) => {
                    // 날짜 문자열을 파싱하여 정렬
                    const parseDate = (dateStr: string) => {
                      // 한글 날짜 형식 (예: "10월 15일(수)")
                      const koreanMatch = dateStr.match(/(\d+)월 (\d+)일/);
                      if (koreanMatch) {
                        const month = parseInt(koreanMatch[1]);
                        const day = parseInt(koreanMatch[2]);
                        return month * 100 + day; // 월*100 + 일로 정렬
                      }
                      
                      // 영어 요일 코드 (예: "WED", "FRI")
                      const dayOrder = { 'MON': 1, 'TUE': 2, 'WED': 3, 'THU': 4, 'FRI': 5 };
                      return (dayOrder[a as keyof typeof dayOrder] || 0) - (dayOrder[b as keyof typeof dayOrder] || 0);
                    };
                    
                    return parseDate(a) - parseDate(b);
                  })
                  .map((day, dayIndex) => {
                    // 영어 요일 코드를 한글 날짜로 변환
                    const convertToKoreanDate = (dayStr: string) => {
                      const dayMapping = {
                        'MON': '월', 'TUE': '화', 'WED': '수', 'THU': '목', 'FRI': '금'
                      };
                      
                      // 이미 한글 날짜 형식인 경우 그대로 반환
                      if (dayStr.includes('월') && dayStr.includes('일')) {
                        return dayStr;
                      }
                      
                      // 영어 요일 코드인 경우 한글 날짜로 변환
                      const weekStartDate = new Date(voteResults.weekStartDate);
                      const dayIndex = Object.keys(dayMapping).indexOf(dayStr);
                      if (dayIndex !== -1) {
                        const targetDate = new Date(weekStartDate.getTime() + dayIndex * 24 * 60 * 60 * 1000);
                        const month = targetDate.getMonth() + 1;
                        const date = targetDate.getDate();
                        const dayName = dayMapping[dayStr as keyof typeof dayMapping];
                        return `${month}월 ${date}일(${dayName})`;
                      }
                      
                      return dayStr;
                    };
                    
                    return (
                      <Text key={dayIndex} fontSize="xs" color="gray.600" textAlign="center">
                        {convertToKoreanDate(day)}
                      </Text>
                    );
                  })}
              </VStack>
            </VStack>
          ))}
        </SimpleGrid>
      </Box>

    </VStack>
  );
}
