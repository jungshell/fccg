#!/usr/bin/env node

// Cross-platform postbuild script
// Only runs osascript notification on macOS, fails silently on other platforms

const { exec } = require('child_process');

if (process.platform === 'darwin') {
  exec(
    'osascript -e \'display notification "백엔드 빌드 완료" with title "FCCGByGemini"\'',
    (error) => {
      // Silently fail if osascript is not available
      // This is expected on CI/CD systems or when osascript is not in PATH
      if (error) {
        process.exit(0); // Exit successfully even if osascript fails
      }
    }
  );
} else {
  // On non-macOS platforms, do nothing (script exits successfully)
  process.exit(0);
}

