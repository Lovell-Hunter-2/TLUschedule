export interface SemesterRegisterPeriod {
  id: string;
  name: string;
  semesterCode: string; // e.g. "2_2026_2027"
  yearName: string; // e.g. "2026-2027"
  timeText: string; // e.g. "Chưa cập nhật" or "01/02/2026 08:00 - 15/02/2026 17:00"
  isActive?: boolean;
}

export interface SchoolYearRegistration {
  year: string;
  periods: SemesterRegisterPeriod[];
}

export const SCHOOL_YEAR_REGISTRATIONS: SchoolYearRegistration[] = [
  {
    year: '2026-2027',
    periods: [
      {
        id: '2627_2_main',
        name: 'Học kỳ chính',
        semesterCode: '2_2026_2027',
        yearName: '2026-2027',
        timeText: 'Chưa cập nhật',
        isActive: false
      },
      {
        id: '2627_2_sub',
        name: 'Học kỳ phụ',
        semesterCode: '2_2026_2027',
        yearName: '2026-2027',
        timeText: 'Chưa cập nhật',
        isActive: false
      },
      {
        id: '2627_2_en_boost',
        name: 'Tiếng Anh tăng cường',
        semesterCode: '2_2026_2027',
        yearName: '2026-2027',
        timeText: 'Chưa cập nhật',
        isActive: false
      },
      {
        id: '2627_2_grad',
        name: 'Học phần tốt nghiệp',
        semesterCode: '2_2026_2027',
        yearName: '2026-2027',
        timeText: 'Chưa cập nhật',
        isActive: false
      },
      {
        id: '2627_2_en_exit',
        name: 'Chuẩn đầu ra ngoại ngữ',
        semesterCode: '2_2026_2027',
        yearName: '2026-2027',
        timeText: 'Chưa cập nhật',
        isActive: false
      },
      {
        id: '2627_2_en_review',
        name: 'Ôn thi Chuẩn đầu ra ngoại ngữ',
        semesterCode: '2_2026_2027',
        yearName: '2026-2027',
        timeText: 'Chưa cập nhật',
        isActive: false
      },
      {
        id: '2627_1_main',
        name: 'Học kỳ chính',
        semesterCode: '1_2026_2027',
        yearName: '2026-2027',
        timeText: '10/08/2026 08:00 - 25/08/2026 17:00',
        isActive: false
      },
      {
        id: '2627_1_sub',
        name: 'Học kỳ phụ',
        semesterCode: '1_2026_2027',
        yearName: '2026-2027',
        timeText: '26/08/2026 08:00 - 30/08/2026 17:00',
        isActive: false
      },
      {
        id: '2627_1_en_boost',
        name: 'Tiếng Anh tăng cường',
        semesterCode: '1_2026_2027',
        yearName: '2026-2027',
        timeText: '15/08/2026 08:00 - 22/08/2026 17:00',
        isActive: false
      },
      {
        id: '2627_1_grad',
        name: 'Học phần tốt nghiệp',
        semesterCode: '1_2026_2027',
        yearName: '2026-2027',
        timeText: 'Chưa cập nhật',
        isActive: false
      },
      {
        id: '2627_1_en_exit',
        name: 'Chuẩn đầu ra ngoại ngữ',
        semesterCode: '1_2026_2027',
        yearName: '2026-2027',
        timeText: 'Chưa cập nhật',
        isActive: false
      },
      {
        id: '2627_1_en_review',
        name: 'Ôn thi Chuẩn đầu ra ngoại ngữ',
        semesterCode: '1_2026_2027',
        yearName: '2026-2027',
        timeText: 'Chưa cập nhật',
        isActive: false
      }
    ]
  },
  {
    year: '2025-2026',
    periods: [
      {
        id: '2526_2_main',
        name: 'Học kỳ chính',
        semesterCode: '2_2025_2026',
        yearName: '2025-2026',
        timeText: '05/01/2026 08:00 - 20/01/2026 17:00',
        isActive: true
      },
      {
        id: '2526_2_sub',
        name: 'Học kỳ phụ',
        semesterCode: '2_2025_2026',
        yearName: '2025-2026',
        timeText: '21/01/2026 08:00 - 25/01/2026 17:00',
        isActive: false
      },
      {
        id: '2526_2_summer',
        name: 'Học kỳ hè',
        semesterCode: '2_2025_2026',
        yearName: '2025-2026',
        timeText: '10/05/2026 08:00 - 20/05/2026 17:00',
        isActive: false
      },
      {
        id: '2526_2_en_boost',
        name: 'Tiếng Anh tăng cường',
        semesterCode: '2_2025_2026',
        yearName: '2025-2026',
        timeText: 'Chưa cập nhật',
        isActive: false
      },
      {
        id: '2526_2_grad',
        name: 'Học phần tốt nghiệp',
        semesterCode: '2_2025_2026',
        yearName: '2025-2026',
        timeText: 'Chưa cập nhật',
        isActive: false
      },
      {
        id: '2526_2_en_exit',
        name: 'Chuẩn đầu ra ngoại ngữ',
        semesterCode: '2_2025_2026',
        yearName: '2025-2026',
        timeText: 'Chưa cập nhật',
        isActive: false
      },
      {
        id: '2526_2_en_review',
        name: 'Ôn thi Chuẩn đầu ra ngoại ngữ',
        semesterCode: '2_2025_2026',
        yearName: '2025-2026',
        timeText: 'Chưa cập nhật',
        isActive: false
      },
      {
        id: '2526_2_extra_1',
        name: 'Đợt đăng ký bổ sung đợt 1',
        semesterCode: '2_2025_2026',
        yearName: '2025-2026',
        timeText: '26/01/2026 08:00 - 28/01/2026 17:00',
        isActive: false
      },
      {
        id: '2526_2_extra_2',
        name: 'Đợt điều chỉnh môn học rút bớt',
        semesterCode: '2_2025_2026',
        yearName: '2025-2026',
        timeText: '01/02/2026 08:00 - 05/02/2026 17:00',
        isActive: false
      },
      {
        id: '2526_1_main',
        name: 'Học kỳ chính',
        semesterCode: '1_2025_2026',
        yearName: '2025-2026',
        timeText: '10/08/2025 08:00 - 25/08/2025 17:00',
        isActive: false
      },
      {
        id: '2526_1_sub',
        name: 'Học kỳ phụ',
        semesterCode: '1_2025_2026',
        yearName: '2025-2026',
        timeText: '26/08/2025 08:00 - 30/08/2025 17:00',
        isActive: false
      },
      {
        id: '2526_1_en_boost',
        name: 'Tiếng Anh tăng cường',
        semesterCode: '1_2025_2026',
        yearName: '2025-2026',
        timeText: 'Chưa cập nhật',
        isActive: false
      },
      {
        id: '2526_1_grad',
        name: 'Học phần tốt nghiệp',
        semesterCode: '1_2025_2026',
        yearName: '2025-2026',
        timeText: 'Chưa cập nhật',
        isActive: false
      },
      {
        id: '2526_1_en_exit',
        name: 'Chuẩn đầu ra ngoại ngữ',
        semesterCode: '1_2025_2026',
        yearName: '2025-2026',
        timeText: 'Chưa cập nhật',
        isActive: false
      },
      {
        id: '2526_1_en_review',
        name: 'Ôn thi Chuẩn đầu ra ngoại ngữ',
        semesterCode: '1_2025_2026',
        yearName: '2025-2026',
        timeText: 'Chưa cập nhật',
        isActive: false
      },
      {
        id: '2526_1_extra_1',
        name: 'Đợt đăng ký bổ sung đợt 1',
        semesterCode: '1_2025_2026',
        yearName: '2025-2026',
        timeText: '31/08/2025 08:00 - 02/09/2025 17:00',
        isActive: false
      },
      {
        id: '2526_1_extra_2',
        name: 'Đợt học cải thiện / nâng điểm',
        semesterCode: '1_2025_2026',
        yearName: '2025-2026',
        timeText: '05/09/2025 08:00 - 10/09/2025 17:00',
        isActive: false
      },
      {
        id: '2526_1_extra_3',
        name: 'Đợt học lại học phần',
        semesterCode: '1_2025_2026',
        yearName: '2025-2026',
        timeText: '11/09/2025 08:00 - 15/09/2025 17:00',
        isActive: false
      },
      {
        id: '2526_3_special',
        name: 'Đợt thực tập tốt nghiệp chuyên ngành',
        semesterCode: '2_2025_2026',
        yearName: '2025-2026',
        timeText: 'Chưa cập nhật',
        isActive: false
      },
      {
        id: '2526_3_thesis',
        name: 'Đợt đăng ký Đồ án tốt nghiệp',
        semesterCode: '2_2025_2026',
        yearName: '2025-2026',
        timeText: 'Chưa cập nhật',
        isActive: false
      },
      {
        id: '2526_3_cert',
        name: 'Đợt xét chuẩn Tin học & Kỹ năng mềm',
        semesterCode: '2_2025_2026',
        yearName: '2025-2026',
        timeText: 'Chưa cập nhật',
        isActive: false
      }
    ]
  },
  {
    year: '2024-2025',
    periods: Array.from({ length: 16 }, (_, i) => {
      const names = [
        'Học kỳ chính (Kỳ 2)',
        'Học kỳ phụ (Kỳ 2)',
        'Tiếng Anh tăng cường (Kỳ 2)',
        'Học phần tốt nghiệp (Kỳ 2)',
        'Chuẩn đầu ra ngoại ngữ (Kỳ 2)',
        'Ôn thi Chuẩn đầu ra ngoại ngữ',
        'Học kỳ hè (Kỳ 3)',
        'Đợt học cải thiện hè',
        'Học kỳ chính (Kỳ 1)',
        'Học kỳ phụ (Kỳ 1)',
        'Tiếng Anh tăng cường (Kỳ 1)',
        'Học phần tốt nghiệp (Kỳ 1)',
        'Chuẩn đầu ra ngoại ngữ (Kỳ 1)',
        'Đăng ký bổ sung Kỳ 1',
        'Xét chuẩn đầu ra Tin học',
        'Đồ án tốt nghiệp đợt 1'
      ];
      return {
        id: `2425_${i + 1}`,
        name: names[i] || `Đợt đăng ký ${i + 1}`,
        semesterCode: i < 8 ? '2_2024_2025' : '1_2024_2025',
        yearName: '2024-2025',
        timeText: 'Đã kết thúc',
        isActive: false
      };
    })
  },
  {
    year: '2023-2024',
    periods: Array.from({ length: 13 }, (_, i) => ({
      id: `2324_${i + 1}`,
      name: i === 0 ? 'Học kỳ chính' : i === 1 ? 'Học kỳ phụ' : i === 2 ? 'Tiếng Anh tăng cường' : `Đợt đăng ký ${i + 1}`,
      semesterCode: i < 7 ? '2_2023_2024' : '1_2023_2024',
      yearName: '2023-2024',
      timeText: 'Đã kết thúc',
      isActive: false
    }))
  },
  {
    year: '2022-2023',
    periods: Array.from({ length: 11 }, (_, i) => ({
      id: `2223_${i + 1}`,
      name: i === 0 ? 'Học kỳ chính' : i === 1 ? 'Học kỳ phụ' : i === 2 ? 'Tiếng Anh tăng cường' : `Đợt đăng ký ${i + 1}`,
      semesterCode: i < 6 ? '2_2022_2023' : '1_2022_2023',
      yearName: '2022-2023',
      timeText: 'Đã kết thúc',
      isActive: false
    }))
  },
  {
    year: '2021-2022',
    periods: Array.from({ length: 8 }, (_, i) => ({
      id: `2122_${i + 1}`,
      name: i === 0 ? 'Học kỳ chính' : i === 1 ? 'Học kỳ phụ' : `Đợt đăng ký ${i + 1}`,
      semesterCode: i < 4 ? '2_2021_2022' : '1_2021_2022',
      yearName: '2021-2022',
      timeText: 'Đã kết thúc',
      isActive: false
    }))
  },
  {
    year: '2020-2021',
    periods: Array.from({ length: 7 }, (_, i) => ({
      id: `2021_${i + 1}`,
      name: i === 0 ? 'Học kỳ chính' : i === 1 ? 'Học kỳ phụ' : `Đợt đăng ký ${i + 1}`,
      semesterCode: i < 4 ? '2_2020_2021' : '1_2020_2021',
      yearName: '2020-2021',
      timeText: 'Đã kết thúc',
      isActive: false
    }))
  }
];
