/**
 * Mock employee data for local development and testing.
 * Replace with real backend calls in production.
 */

import type { Employee, AttendanceResult } from '@/types';

export const MOCK_EMPLOYEES: Employee[] = [
  {
    id: 'emp-001',
    fullName: 'Ramesh Kumar',
    employeeCode: 'SLBBC001',
    photoUrl: 'https://i.pravatar.cc/300?img=12',
    designation: 'BOILER_OPERATOR',
  },
  {
    id: 'emp-002',
    fullName: 'Suresh Reddy',
    employeeCode: 'SLBBC002',
    photoUrl: 'https://i.pravatar.cc/300?img=33',
    designation: 'BOILER_FIREMAN',
  },
  {
    id: 'emp-003',
    fullName: 'Latha Devi',
    employeeCode: 'SLBBC003',
    photoUrl: 'https://i.pravatar.cc/300?img=47',
    designation: 'BOILER_HELPER',
  },
  {
    id: 'emp-004',
    fullName: 'Vijay Naidu',
    employeeCode: 'SLBBC004',
    photoUrl: 'https://i.pravatar.cc/300?img=68',
    designation: 'BOILER_OPERATOR',
  },
];

export function getMockAttendanceResult(pin: string): AttendanceResult {
  // Map PIN last digit to employee index
  const lastDigit = parseInt(pin[pin.length - 1] ?? '0', 10);
  const index = lastDigit % MOCK_EMPLOYEES.length;
  const employee = MOCK_EMPLOYEES[index]!;

  // Alternate between check-in and check-out based on first digit
  const firstDigit = parseInt(pin[0] ?? '0', 10);
  const action = firstDigit % 2 === 0 ? 'CHECK_IN' : 'CHECK_OUT';

  return {
    action,
    employee,
    recordedAt: new Date().toISOString(),
    shiftType: 'GENERAL',
    confidenceScore: 1.0,
  };
}
