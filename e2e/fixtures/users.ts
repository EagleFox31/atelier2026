import path from 'path';

export type TestUser = {
  id: string;
  email: string;
  password: string;
  employeeCode: string;
  roleLabel: RegExp;
  authFile: string;
};

const authDir = path.join(__dirname, '../../playwright/.auth');

export const TEST_USERS: TestUser[] = [
  {
    id: 'admin',
    email: 'admin@atelier.cm',
    password: 'Atelier2026!',
    employeeCode: 'EMP-001',
    roleLabel: /admin/i,
    authFile: path.join(authDir, 'admin.json'),
  },
  {
    id: 'reception',
    email: 'reception@atelier.cm',
    password: 'Atelier2026!',
    employeeCode: 'EMP-004',
    roleLabel: /réception|receptionniste/i,
    authFile: path.join(authDir, 'reception.json'),
  },
  {
    id: 'chef',
    email: 'chef@atelier.cm',
    password: 'Atelier2026!',
    employeeCode: 'EMP-002',
    roleLabel: /chef/i,
    authFile: path.join(authDir, 'chef.json'),
  },
  {
    id: 'technicien',
    email: 'tech1@atelier.cm',
    password: 'Atelier2026!',
    employeeCode: 'EMP-003',
    roleLabel: /technicien/i,
    authFile: path.join(authDir, 'technicien.json'),
  },
  {
    id: 'caissier',
    email: 'caisse@atelier.cm',
    password: 'Atelier2026!',
    employeeCode: 'EMP-005',
    roleLabel: /caissier/i,
    authFile: path.join(authDir, 'caissier.json'),
  },
];

export const ADMIN_USER = TEST_USERS.find((u) => u.id === 'admin')!;
