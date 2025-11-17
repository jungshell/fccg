import bcrypt from 'bcryptjs';

/**
 * 비밀번호를 해시합니다.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * 비밀번호와 해시를 비교합니다.
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
