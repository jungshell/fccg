// A/B 테스트 유틸리티
interface ABTestConfig {
  id: string;
  name: string;
  variants: {
    id: string;
    name: string;
    weight: number;
  }[];
  startDate: string;
  endDate: string;
  isActive: boolean;
}

interface ABTestResult {
  testId: string;
  variantId: string;
  userId: string;
  timestamp: number;
}

class ABTesting {
  private tests: Map<string, ABTestConfig> = new Map();
  private results: ABTestResult[] = [];
  private userAssignments: Map<string, Map<string, string>> = new Map();

  constructor() {
    this.loadTests();
    this.loadResults();
  }

  // 테스트 등록
  registerTest(test: ABTestConfig) {
    this.tests.set(test.id, test);
    this.saveTests();
  }

  // 테스트 가져오기
  getTest(testId: string): ABTestConfig | undefined {
    return this.tests.get(testId);
  }

  // 활성 테스트 목록
  getActiveTests(): ABTestConfig[] {
    const now = new Date();
    return Array.from(this.tests.values()).filter(test => {
      if (!test.isActive) return false;
      
      const startDate = new Date(test.startDate);
      const endDate = new Date(test.endDate);
      
      return now >= startDate && now <= endDate;
    });
  }

  // 사용자에게 변형 할당
  assignVariant(testId: string, userId: string): string {
    // 이미 할당된 경우 반환
    const userTests = this.userAssignments.get(userId);
    if (userTests && userTests.has(testId)) {
      return userTests.get(testId)!;
    }

    const test = this.tests.get(testId);
    if (!test || !test.isActive) {
      return 'control'; // 기본값
    }

    // 가중치 기반 랜덤 할당
    const random = Math.random();
    let cumulativeWeight = 0;
    
    for (const variant of test.variants) {
      cumulativeWeight += variant.weight / 100;
      if (random <= cumulativeWeight) {
        this.assignUserToVariant(userId, testId, variant.id);
        return variant.id;
      }
    }

    // 기본값
    this.assignUserToVariant(userId, testId, 'control');
    return 'control';
  }

  // 사용자 변형 할당 저장
  private assignUserToVariant(userId: string, testId: string, variantId: string) {
    if (!this.userAssignments.has(userId)) {
      this.userAssignments.set(userId, new Map());
    }
    
    this.userAssignments.get(userId)!.set(testId, variantId);
    this.saveUserAssignments();
  }

  // 테스트 결과 기록
  recordResult(testId: string, variantId: string, userId: string, metric: string, value: number) {
    const result: ABTestResult = {
      testId,
      variantId,
      userId,
      timestamp: Date.now(),
    };

    this.results.push(result);
    this.saveResults();

    // Google Analytics에 이벤트 전송
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'ab_test', {
        test_id: testId,
        variant_id: variantId,
        metric: metric,
        value: value,
      });
    }
  }

  // 테스트 결과 분석
  analyzeTest(testId: string): {
    test: ABTestConfig;
    variants: {
      id: string;
      name: string;
      users: number;
      conversions: number;
      conversionRate: number;
    }[];
  } | null {
    const test = this.tests.get(testId);
    if (!test) return null;

    const testResults = this.results.filter(r => r.testId === testId);
    const variantResults = new Map<string, { users: Set<string>; conversions: number }>();

    // 각 변형별 사용자 수와 전환 수 계산
    for (const result of testResults) {
      if (!variantResults.has(result.variantId)) {
        variantResults.set(result.variantId, { users: new Set(), conversions: 0 });
      }
      
      const variant = variantResults.get(result.variantId)!;
      variant.users.add(result.userId);
      variant.conversions++;
    }

    // 결과 정리
    const variants = test.variants.map(variant => {
      const result = variantResults.get(variant.id) || { users: new Set(), conversions: 0 };
      return {
        id: variant.id,
        name: variant.name,
        users: result.users.size,
        conversions: result.conversions,
        conversionRate: result.users.size > 0 ? (result.conversions / result.users.size) * 100 : 0,
      };
    });

    return { test, variants };
  }

  // 통계적 유의성 검정 (간단한 버전)
  calculateSignificance(testId: string): {
    isSignificant: boolean;
    pValue: number;
    confidence: number;
  } {
    const analysis = this.analyzeTest(testId);
    if (!analysis || analysis.variants.length < 2) {
      return { isSignificant: false, pValue: 1, confidence: 0 };
    }

    // 간단한 카이제곱 검정
    const control = analysis.variants.find(v => v.id === 'control');
    const treatment = analysis.variants.find(v => v.id !== 'control');

    if (!control || !treatment) {
      return { isSignificant: false, pValue: 1, confidence: 0 };
    }

    // 간단한 신뢰구간 계산
    const controlRate = control.conversionRate / 100;
    const treatmentRate = treatment.conversionRate / 100;
    
    const pooledRate = (control.conversions + treatment.conversions) / (control.users + treatment.users);
    const standardError = Math.sqrt(pooledRate * (1 - pooledRate) * (1/control.users + 1/treatment.users));
    
    const zScore = Math.abs(treatmentRate - controlRate) / standardError;
    const pValue = 2 * (1 - this.normalCDF(zScore));
    const confidence = (1 - pValue) * 100;

    return {
      isSignificant: pValue < 0.05,
      pValue,
      confidence,
    };
  }

  // 정규분포 누적분포함수 (간단한 근사)
  private normalCDF(x: number): number {
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  private erf(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  // 데이터 저장/로드
  private saveTests() {
    try {
      localStorage.setItem('ab_tests', JSON.stringify(Array.from(this.tests.entries())));
    } catch (error) {
      console.error('A/B 테스트 저장 실패:', error);
    }
  }

  private loadTests() {
    try {
      const saved = localStorage.getItem('ab_tests');
      if (saved) {
        const testsArray = JSON.parse(saved);
        this.tests = new Map(testsArray);
      }
    } catch (error) {
      console.error('A/B 테스트 로드 실패:', error);
    }
  }

  private saveResults() {
    try {
      localStorage.setItem('ab_results', JSON.stringify(this.results));
    } catch (error) {
      console.error('A/B 테스트 결과 저장 실패:', error);
    }
  }

  private loadResults() {
    try {
      const saved = localStorage.getItem('ab_results');
      if (saved) {
        this.results = JSON.parse(saved);
      }
    } catch (error) {
      console.error('A/B 테스트 결과 로드 실패:', error);
    }
  }

  private saveUserAssignments() {
    try {
      const assignments = Array.from(this.userAssignments.entries()).map(([userId, tests]) => [
        userId,
        Array.from(tests.entries())
      ]);
      localStorage.setItem('ab_user_assignments', JSON.stringify(assignments));
    } catch (error) {
      console.error('사용자 할당 저장 실패:', error);
    }
  }

  private loadUserAssignments() {
    try {
      const saved = localStorage.getItem('ab_user_assignments');
      if (saved) {
        const assignmentsArray = JSON.parse(saved);
        this.userAssignments = new Map(
          assignmentsArray.map(([userId, tests]: [string, [string, string][]]) => [
            userId,
            new Map(tests)
          ])
        );
      }
    } catch (error) {
      console.error('사용자 할당 로드 실패:', error);
    }
  }
}

// 전역 인스턴스
export const abTesting = new ABTesting();

// React Hook
export const useABTest = (testId: string, userId: string) => {
  const variant = abTesting.assignVariant(testId, userId);
  
  const recordEvent = (metric: string, value: number = 1) => {
    abTesting.recordResult(testId, variant, userId, metric, value);
  };

  return {
    variant,
    recordEvent,
    isControl: variant === 'control',
  };
};
