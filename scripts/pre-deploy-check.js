#!/usr/bin/env node
/**
 * 배포 전 환경 검증 스크립트
 * 
 * 사용법: node scripts/pre-deploy-check.js
 */

const fs = require('fs');
const path = require('path');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let errors = [];
let warnings = [];

console.log('\n🔍 배포 전 환경 검증 시작...\n');

// 1. 환경 변수 파일 확인
console.log('1️⃣ 환경 변수 파일 확인...');
const frontendEnvExample = path.join(__dirname, '../frontend/env.example');
if (!fs.existsSync(frontendEnvExample)) {
  warnings.push('frontend/env.example 파일이 없습니다.');
} else {
  console.log(`${GREEN}✅${RESET} frontend/env.example 존재`);
}

// 2. 하드코딩된 localhost 검색
console.log('\n2️⃣ 하드코딩된 localhost 검색...');
function findLocalhost(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // node_modules, dist, .git 등 제외
      if (!['node_modules', 'dist', '.git', '.vercel', '.render'].includes(file)) {
        findLocalhost(filePath, fileList);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
      const content = fs.readFileSync(filePath, 'utf8');
      // localhost를 찾되, 주석이나 설명이 아닌 실제 코드에서
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (line.includes('localhost') && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
          // 허용되는 경우: env.example, README, 주석
          if (!filePath.includes('example') && !filePath.includes('README') && !line.trim().startsWith('//')) {
            fileList.push({
              file: path.relative(path.join(__dirname, '..'), filePath),
              line: index + 1,
              content: line.trim()
            });
          }
        }
      });
    }
  });
  return fileList;
}

const frontendSrc = path.join(__dirname, '../frontend/src');
const backendSrc = path.join(__dirname, '../backend/src');

const localhostFiles = [
  ...findLocalhost(frontendSrc),
  ...findLocalhost(backendSrc)
];

if (localhostFiles.length > 0) {
  console.log(`${YELLOW}⚠️${RESET} 하드코딩된 localhost 발견:`);
  localhostFiles.slice(0, 5).forEach(({ file, line, content }) => {
    console.log(`   ${file}:${line} - ${content.substring(0, 60)}...`);
  });
  warnings.push(`${localhostFiles.length}개의 localhost 참조 발견`);
} else {
  console.log(`${GREEN}✅${RESET} 하드코딩된 localhost 없음`);
}

// 3. API 엔드포인트 상수 확인
console.log('\n3️⃣ API 엔드포인트 상수 확인...');
const constantsFile = path.join(__dirname, '../frontend/src/constants/index.ts');
if (fs.existsSync(constantsFile)) {
  const content = fs.readFileSync(constantsFile, 'utf8');
  if (content.includes('VITE_API_BASE_URL') || content.includes('import.meta.env')) {
    console.log(`${GREEN}✅${RESET} API_ENDPOINTS가 환경 변수 사용`);
  } else {
    errors.push('API_ENDPOINTS가 환경 변수를 사용하지 않습니다.');
  }
} else {
  errors.push('constants/index.ts 파일이 없습니다.');
}

// 4. 환경 변수 사용 확인
console.log('\n4️⃣ 환경 변수 사용 확인...');
const backendApp = path.join(__dirname, '../backend/src/app.ts');
if (fs.existsSync(backendApp)) {
  const content = fs.readFileSync(backendApp, 'utf8');
  if (content.includes('process.env.DATABASE_URL')) {
    console.log(`${GREEN}✅${RESET} DATABASE_URL 환경 변수 사용`);
  } else {
    warnings.push('DATABASE_URL을 하드코딩했을 수 있습니다.');
  }
  
  if (content.includes('process.env.JWT_SECRET')) {
    console.log(`${GREEN}✅${RESET} JWT_SECRET 환경 변수 사용`);
  } else {
    warnings.push('JWT_SECRET을 하드코딩했을 수 있습니다.');
  }
}

// 5. 결과 출력
console.log('\n' + '='.repeat(50));
console.log('📊 검증 결과');
console.log('='.repeat(50));

if (errors.length === 0 && warnings.length === 0) {
  console.log(`${GREEN}✅ 모든 검증 통과!${RESET}`);
  console.log('\n🚀 배포 준비 완료!\n');
  process.exit(0);
} else {
  if (errors.length > 0) {
    console.log(`\n${RED}❌ 에러 (${errors.length}개):${RESET}`);
    errors.forEach(err => console.log(`   - ${err}`));
  }
  
  if (warnings.length > 0) {
    console.log(`\n${YELLOW}⚠️ 경고 (${warnings.length}개):${RESET}`);
    warnings.forEach(warn => console.log(`   - ${warn}`));
  }
  
  if (errors.length > 0) {
    console.log(`\n${RED}배포 전 에러를 수정해주세요!${RESET}\n`);
    process.exit(1);
  } else {
    console.log(`\n${YELLOW}경고가 있지만 배포는 가능합니다.${RESET}\n`);
    process.exit(0);
  }
}

