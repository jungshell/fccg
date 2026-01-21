#!/usr/bin/env node
/**
 * 데이터베이스 백업 스크립트
 * PostgreSQL 데이터베이스를 SQL 덤프로 백업합니다.
 */

require('dotenv').config();
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// 백업 디렉토리
const BACKUP_DIR = path.join(__dirname, '../../backups');
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// DATABASE_URL에서 연결 정보 추출
function parseDatabaseUrl(url) {
  if (!url) {
    throw new Error('DATABASE_URL이 설정되지 않았습니다.');
  }

  try {
    const parsed = new URL(url);
    if (!/^postgres(?:ql)?:$/.test(parsed.protocol)) {
      throw new Error('DATABASE_URL 형식이 올바르지 않습니다.');
    }

    const user = decodeURIComponent(parsed.username || '');
    const password = decodeURIComponent(parsed.password || '');
    const host = parsed.hostname;
    const port = parsed.port || '5432';
    const database = parsed.pathname.replace('/', '');

    if (!user || !password || !host || !database) {
      throw new Error('DATABASE_URL 형식이 올바르지 않습니다.');
    }

    return { user, password, host, port, database };
  } catch (error) {
    throw new Error('DATABASE_URL 형식이 올바르지 않습니다.');
  }
}

// 백업 실행
async function backupDatabase() {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL 환경 변수가 설정되지 않았습니다.');
    }

    const dbInfo = parseDatabaseUrl(dbUrl);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const backupFileName = `backup-${timestamp}-${Date.now()}.sql`;
    const backupPath = path.join(BACKUP_DIR, backupFileName);

    console.log('📦 데이터베이스 백업 시작...');
    console.log(`   데이터베이스: ${dbInfo.database}`);
    console.log(`   호스트: ${dbInfo.host}`);

    // pg_dump 명령어 실행 (커스텀 형식)
    // -F c: 커스텀 형식 (압축됨)
    // -F p: 플레인 텍스트 SQL (읽기 쉬움, 선택 가능)
    const format = process.env.BACKUP_FORMAT || 'c'; // 'c' (custom) or 'p' (plain)
    const formatFlag = format === 'p' ? '-F p' : '-F c';
    const pgDumpCommand = `PGPASSWORD="${dbInfo.password}" pg_dump -h ${dbInfo.host} -p ${dbInfo.port} -U ${dbInfo.user} -d ${dbInfo.database} ${formatFlag} -f "${backupPath}"`;

    exec(pgDumpCommand, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ 백업 실패:', error.message);
        process.exit(1);
      }

      if (stderr && !stderr.includes('NOTICE')) {
        console.warn('⚠️ 경고:', stderr);
      }

      const stats = fs.statSync(backupPath);
      const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

      console.log('✅ 백업 완료!');
      console.log(`   파일: ${backupFileName}`);
      console.log(`   크기: ${fileSizeMB} MB`);
      console.log(`   경로: ${backupPath}`);

      // 오래된 백업 파일 정리 (30일 이상 된 파일 삭제)
      cleanupOldBackups();

      process.exit(0);
    });
  } catch (error) {
    console.error('❌ 백업 오류:', error.message);
    process.exit(1);
  }
}

// 오래된 백업 파일 정리
function cleanupOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const now = Date.now();
    const thirtyDaysAgo = 30 * 24 * 60 * 60 * 1000; // 30일 (밀리초)

    let deletedCount = 0;
    files.forEach(file => {
      if (file.startsWith('backup-') && file.endsWith('.sql')) {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        const fileAge = now - stats.mtimeMs;

        if (fileAge > thirtyDaysAgo) {
          fs.unlinkSync(filePath);
          deletedCount++;
          console.log(`🗑️  오래된 백업 삭제: ${file}`);
        }
      }
    });

    if (deletedCount > 0) {
      console.log(`✅ ${deletedCount}개의 오래된 백업 파일 삭제 완료`);
    }
  } catch (error) {
    console.warn('⚠️ 백업 정리 중 오류:', error.message);
  }
}

// 스크립트 실행
if (require.main === module) {
  backupDatabase();
}

module.exports = { backupDatabase };

