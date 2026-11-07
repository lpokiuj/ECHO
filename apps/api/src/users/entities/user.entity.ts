import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum UserRole {
  ADMIN = 'ADMIN',
  PEMBINA = 'PEMBINA',
  MEMBER = 'MEMBER',
}

// With the unique constraint on email, this makes emails unique ignoring case
@Check('users_email_lowercase_chk', '"email" = lower("email")')
@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'name', type: 'varchar' })
  name: string;

  @Column({ name: 'email', type: 'varchar', unique: true })
  email: string;

  // Never loaded by default; only the auth code selects it explicitly
  @Column({ name: 'password_hash', type: 'varchar', select: false })
  passwordHash: string;

  @Column({
    name: 'role',
    type: 'enum',
    enum: UserRole,
    enumName: 'user_role',
    default: UserRole.MEMBER,
  })
  role: UserRole;

  @Column({ name: 'must_change_password', type: 'boolean', default: true })
  mustChangePassword: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
