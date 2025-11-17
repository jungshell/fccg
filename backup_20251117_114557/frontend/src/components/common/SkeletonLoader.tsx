import React from 'react';
import { Box, Skeleton, SkeletonText, SkeletonCircle } from '@chakra-ui/react';

interface SkeletonLoaderProps {
  variant?: 'text' | 'rectangular' | 'circular' | 'card' | 'calendar' | 'list';
  width?: string | number;
  height?: string | number;
  lines?: number;
  spacing?: number;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  variant = 'rectangular',
  width = '100%',
  height = '20px',
  lines = 3,
  spacing = 2
}) => {
  switch (variant) {
    case 'text':
      return (
        <SkeletonText
          mt={spacing}
          noOfLines={lines}
          spacing={spacing}
          skeletonHeight={height}
        />
      );
    
    case 'circular':
      return <SkeletonCircle size={width} />;
    
    case 'card':
      return (
        <Box p={4} borderWidth={1} borderRadius="md">
          <Skeleton height="20px" mb={2} />
          <SkeletonText noOfLines={2} spacing={2} />
          <Skeleton height="40px" mt={3} />
        </Box>
      );
    
    case 'calendar':
      return (
        <Box>
          {/* 달력 헤더 */}
          <Skeleton height="40px" mb={4} />
          {/* 달력 그리드 */}
          <Box display="grid" gridTemplateColumns="repeat(7, 1fr)" gap={2}>
            {Array.from({ length: 35 }).map((_, i) => (
              <Box key={i} p={2} borderWidth={1} borderRadius="md" minH="80px">
                <Skeleton height="16px" mb={1} />
                <Skeleton height="12px" mb={1} />
                <Skeleton height="12px" />
              </Box>
            ))}
          </Box>
        </Box>
      );
    
    case 'list':
      return (
        <Box>
          {Array.from({ length: lines }).map((_, i) => (
            <Box key={i} p={3} borderWidth={1} borderRadius="md" mb={2}>
              <Skeleton height="16px" mb={2} />
              <SkeletonText noOfLines={2} spacing={1} />
            </Box>
          ))}
        </Box>
      );
    
    default:
      return <Skeleton height={height} width={width} />;
  }
};

// 특화된 스켈레톤 컴포넌트들
export const GameCardSkeleton: React.FC = () => (
  <Box p={4} borderWidth={1} borderRadius="md" mb={3}>
    <Skeleton height="20px" mb={2} />
    <Skeleton height="16px" mb={1} />
    <Skeleton height="16px" mb={2} />
    <Box display="flex" gap={2}>
      <Skeleton height="24px" width="60px" />
      <Skeleton height="24px" width="80px" />
    </Box>
  </Box>
);

export const MemberListSkeleton: React.FC = () => (
  <Box>
    {Array.from({ length: 5 }).map((_, i) => (
      <Box key={i} p={3} borderWidth={1} borderRadius="md" mb={2} display="flex" alignItems="center">
        <SkeletonCircle size="40px" mr={3} />
        <Box flex={1}>
          <Skeleton height="16px" mb={1} />
          <Skeleton height="12px" width="60%" />
        </Box>
        <Skeleton height="24px" width="80px" />
      </Box>
    ))}
  </Box>
);

export const VoteSectionSkeleton: React.FC = () => (
  <Box p={4} borderWidth={1} borderRadius="md">
    <Skeleton height="24px" mb={3} />
    <Skeleton height="16px" mb={2} />
    <Box display="flex" gap={2} mb={3}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} height="32px" width="60px" />
      ))}
    </Box>
    <Skeleton height="20px" width="40%" />
  </Box>
);

export const CalendarSkeleton: React.FC = () => (
  <Box>
    {/* 월/년 헤더 */}
    <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
      <Skeleton height="32px" width="120px" />
      <Box display="flex" gap={2}>
        <Skeleton height="32px" width="32px" />
        <Skeleton height="32px" width="32px" />
      </Box>
    </Box>
    
    {/* 요일 헤더 */}
    <Box display="grid" gridTemplateColumns="repeat(7, 1fr)" gap={2} mb={2}>
      {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
        <Skeleton key={day} height="24px" />
      ))}
    </Box>
    
    {/* 달력 그리드 */}
    <Box display="grid" gridTemplateColumns="repeat(7, 1fr)" gap={2}>
      {Array.from({ length: 35 }).map((_, i) => (
        <Box key={i} p={2} borderWidth={1} borderRadius="md" minH="100px">
          <Skeleton height="16px" mb={1} />
          <Skeleton height="12px" mb={1} />
          <Skeleton height="12px" mb={1} />
          <Skeleton height="12px" />
        </Box>
      ))}
    </Box>
  </Box>
);

export default SkeletonLoader;

